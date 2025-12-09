// app/api/google/merchant/sync-products/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Catalogue from '@/models/meta/Catalogue';
import CatalogueCycle from '@/models/meta/CatalogueCycle';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import { NextResponse } from 'next/server';
import { initializeContentApi } from '@/lib/merchant/googleContentApi';

export const maxDuration = 300; // 5 minutes max on Vercel

// Concurrency settings
const CONCURRENCY_LIMIT = 10;
const BATCH_SIZE = 100;

export async function GET(request) {
  const startTime = Date.now();
  
  let totalProcessed = 0;
  let totalSynced = 0;
  let totalFailed = 0;
  const categoryCounts = {};
  const results = [];
  let latestCycle = null;
  let totalInCycle = 0;

  try {
    console.log(`[Google Merchant Sync] Starting...`);

    await connectToDatabase();
    const contentApi = initializeContentApi();

    // Cleanup: Delete old cycles (keep only last 2)
    await cleanupOldCycles();

    // Get latest COMPLETED catalogue cycle
    latestCycle = await CatalogueCycle.findOne({ status: 'completed' }).sort({ startedAt: -1 });
    if (!latestCycle) {
      return NextResponse.json({
        success: false,
        message: 'No completed catalogue cycle found. Run /api/cron/meta/generate-catalogue first.'
      }, { status: 400 });
    }

    // Pre-fetch categories for name lookup
    const allCategories = await SpecificCategory.find({}).select('_id name').lean();
    const categoryNameMap = new Map(allCategories.map(c => [c._id.toString(), c.name]));

    // Get counts
    totalInCycle = await Catalogue.countDocuments({ cycleId: latestCycle._id, processed: true });
    const unsyncedCount = await Catalogue.countDocuments({ 
      cycleId: latestCycle._id, 
      processed: true, 
      $or: [{ googleSynced: false }, { googleSynced: { $exists: false } }]
    });

    console.log(`[Google Merchant Sync] Cycle ${latestCycle._id}: Total ${totalInCycle}, Unsynced ${unsyncedCount}`);

    if (unsyncedCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'All products already synced to Google Merchant!',
        summary: {
          cycleId: latestCycle._id.toString(),
          totalInCycle,
          synced: totalInCycle,
          unsynced: 0,
          isComplete: true
        },
        timestamp: new Date().toISOString()
      });
    }

    // Pre-fetch product -> category mapping
    const allCatalogueEntries = await Catalogue.find({
      cycleId: latestCycle._id,
      processed: true,
      $or: [{ googleSynced: false }, { googleSynced: { $exists: false } }]
    }).select('productId').lean();
    
    const uniqueProductIds = [...new Set(allCatalogueEntries.map(e => e.productId?.toString()).filter(Boolean))];
    const products = await Product.find({ _id: { $in: uniqueProductIds } })
      .select('_id specificCategory')
      .lean();
    const productCategoryCache = new Map(products.map(p => [p._id.toString(), p.specificCategory?.toString() || null]));

    // Helper to update category counts
    const updateCategoryCount = (categoryId, categoryName, field) => {
      const key = categoryId || 'uncategorized';
      if (!categoryCounts[key]) {
        categoryCounts[key] = { name: categoryName || 'Uncategorized', total: 0, synced: 0, failed: 0 };
      }
      categoryCounts[key][field]++;
      if (field !== 'total') categoryCounts[key].total++;
    };

    // Sync function for single product
    const syncProduct = async (entry) => {
      const fd = entry.feedData || {};
      const offerId = fd.id;

      if (!offerId) {
        await Catalogue.updateOne({ _id: entry._id }, { googleSynced: true });
        return { skipped: true };
      }

      const productIdStr = entry.productId?.toString();
      const categoryId = productIdStr ? productCategoryCache.get(productIdStr) : null;
      const categoryName = categoryId ? (categoryNameMap.get(categoryId) || 'Unknown') : 'Uncategorized';

      const merchantProduct = {
        offerId,
        title: (fd.title || '').substring(0, 150),
        description: (fd.description || '').substring(0, 5000),
        availability: fd.availability === 'in stock' ? 'in stock' : 'out of stock',
        condition: fd.condition || 'new',
        price: {
          value: (fd.price_amount ?? parseFloat((fd.price || '0').split(' ')[0] || '0')).toFixed(2),
          currency: fd.price_currency || 'INR'
        },
        link: fd.link,
        imageLink: fd.image_link,
        brand: fd.brand || 'MaddyCustom',
        channel: fd.channel || 'online',
        contentLanguage: fd.content_language || 'en',
        targetCountry: fd.target_country || 'IN',
        googleProductCategory: fd.google_product_category,
        customAttributes: (fd.custom_attributes || []).map(a => ({ name: a.name, value: a.value })),
      };

      if (fd.sale_price_amount) {
        merchantProduct.salePrice = {
          value: fd.sale_price_amount.toFixed(2),
          currency: fd.sale_price_currency || fd.price_currency || 'INR'
        };
      }
      if (fd.additional_image_links?.length) {
        merchantProduct.additionalImageLinks = fd.additional_image_links;
      }

      let syncSuccess = false;
      let syncError = null;

      try {
        await contentApi.products.insert({
          merchantId: process.env.MERCHANT_ID,
          requestBody: merchantProduct,
        });
        syncSuccess = true;
      } catch (insertErr) {
        if (insertErr.code === 409) {
          try {
            await contentApi.products.update({
              merchantId: process.env.MERCHANT_ID,
              productId: `online:en:IN:${offerId}`,
              requestBody: merchantProduct,
            });
            syncSuccess = true;
          } catch (updateErr) {
            syncError = updateErr.message?.substring(0, 150) || 'Update failed';
          }
        } else {
          syncError = insertErr.message?.substring(0, 150) || 'Insert failed';
        }
      }

      if (syncSuccess) {
        await Catalogue.updateOne({ _id: entry._id }, { googleSynced: true });
      }

      return { success: syncSuccess, error: syncError, offerId, categoryId, categoryName };
    };

    // Process in batches with concurrency
    let hasMore = true;
    while (hasMore) {
      const batch = await Catalogue.find({
        cycleId: latestCycle._id,
        processed: true,
        $or: [{ googleSynced: false }, { googleSynced: { $exists: false } }]
      }).limit(BATCH_SIZE).lean();

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      // Process with concurrency limit
      for (let i = 0; i < batch.length; i += CONCURRENCY_LIMIT) {
        const chunk = batch.slice(i, i + CONCURRENCY_LIMIT);
        const chunkResults = await Promise.all(chunk.map(syncProduct));

        for (const result of chunkResults) {
          if (result.skipped) continue;
          totalProcessed++;
          
          if (result.success) {
            totalSynced++;
            updateCategoryCount(result.categoryId, result.categoryName, 'synced');
          } else {
            totalFailed++;
            updateCategoryCount(result.categoryId, result.categoryName, 'failed');
            results.push({ offerId: result.offerId, categoryName: result.categoryName, error: result.error });
          }
        }
      }

      console.log(`[Google Merchant Sync] Progress: ${totalProcessed} processed, ${totalSynced} synced, ${totalFailed} failed`);

      if (batch.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    // Final count
    const remainingUnsynced = await Catalogue.countDocuments({
      cycleId: latestCycle._id,
      processed: true,
      $or: [{ googleSynced: false }, { googleSynced: { $exists: false } }]
    });

    const processingTimeMs = Date.now() - startTime;
    console.log(`[Google Merchant Sync] Done: ${totalSynced} synced, ${totalFailed} failed, ${remainingUnsynced} remaining`);

    return NextResponse.json({
      success: true,
      message: remainingUnsynced === 0 
        ? 'Google Merchant sync completed!' 
        : `Sync in progress - ${remainingUnsynced} remaining`,
      summary: {
        cycleId: latestCycle._id.toString(),
        totalInCycle,
        processedThisRun: totalProcessed,
        synced: totalSynced,
        failed: totalFailed,
        remainingUnsynced,
        processingTimeMs,
        isComplete: remainingUnsynced === 0,
      },
      categoryBreakdown: Object.entries(categoryCounts)
        .map(([id, data]) => ({
          categoryId: id === 'uncategorized' ? null : id,
          categoryName: data.name,
          synced: data.synced,
          failed: data.failed,
        }))
        .sort((a, b) => (b.synced + b.failed) - (a.synced + a.failed)),
      ...(totalFailed > 0 && {
        errors: {
          sampleFailures: results.slice(0, 5),
          uniqueErrors: [...new Set(results.map(r => r.error))].slice(0, 10),
        }
      }),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Google Merchant Sync] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal Server Error',
      message: error.message,
      partialResults: totalProcessed > 0 ? { totalProcessed, totalSynced, totalFailed } : undefined
    }, { status: 500 });
  }
}

/**
 * Cleanup old catalogue cycles - keep only the last 2 cycles
 * Deletes both the CatalogueCycle and all associated Catalogue entries
 */
async function cleanupOldCycles() {
  try {
    const allCycles = await CatalogueCycle.find({})
      .sort({ startedAt: -1 })
      .select('_id')
      .lean();

    if (allCycles.length <= 2) {
      return;
    }

    const cycleIdsToDelete = allCycles.slice(2).map(c => c._id);

    if (cycleIdsToDelete.length > 0) {
      const catalogueDeleteResult = await Catalogue.deleteMany({
        cycleId: { $in: cycleIdsToDelete }
      });
      const cycleDeleteResult = await CatalogueCycle.deleteMany({
        _id: { $in: cycleIdsToDelete }
      });

      console.log(`[Sync Cleanup] Deleted ${cycleDeleteResult.deletedCount} old cycles and ${catalogueDeleteResult.deletedCount} catalogue entries`);
    }
  } catch (error) {
    console.error('[Sync Cleanup] Error:', error.message);
  }
}
