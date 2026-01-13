// app/api/google/merchant/update-categories/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import { initializeContentApi } from '@/lib/merchant/googleContentApi';
import { 
  getGoogleCategoryFromFullName, 
  GOOGLE_TAXONOMY_IDS 
} from '@/lib/google/categoryMapping';
import Catalogue from '@/models/meta/Catalogue';
import CatalogueCycle from '@/models/meta/CatalogueCycle';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import { NextResponse } from 'next/server';


export async function GET(request) {
  const startTime = Date.now();
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  const categoryCounts = {};

  try {
    const { searchParams } = new URL(request.url);
    const dryRun = ['true', '1'].includes(
      (searchParams.get('dryRun') || '').trim().toLowerCase()
    );

    console.log(`[Google Merchant Update Categories] Starting... dryRun: ${dryRun}`);

    // 1. Connect to database
    await connectToDatabase();

    // 2. Initialize Content API
    const contentApi = initializeContentApi();
    const merchantId = process.env.MERCHANT_ID;

    // 3. Get latest completed catalogue cycle
    const latestCycle = await CatalogueCycle.findOne({ status: 'completed' }).sort({ startedAt: -1 });
    if (!latestCycle) {
      return NextResponse.json({
        success: false,
        message: 'No completed catalogue cycle found.'
      }, { status: 400 });
    }

    // 4. Pre-fetch all categories for name lookup
    const allCategories = await SpecificCategory.find({}).select('_id name').lean();
    const categoryNameMap = new Map(allCategories.map(c => [c._id.toString(), c.name]));

    // 5. Get all synced products from this cycle
    const totalSynced = await Catalogue.countDocuments({
      cycleId: latestCycle._id,
      processed: true,
      googleSynced: true,
    });

    console.log(`[Google Merchant Update Categories] Found ${totalSynced} synced products to update`);

    // Concurrency settings
    const CONCURRENCY_LIMIT = 10;
    const BATCH_SIZE = 100;

    // Pre-fetch ALL products for category lookup
    const allEntries = await Catalogue.find({
      cycleId: latestCycle._id,
      processed: true,
      googleSynced: true,
    }).select('productId').lean();
    
    const uniqueProductIds = [...new Set(allEntries.map(e => e.productId?.toString()).filter(Boolean))];
    const products = await Product.find({ _id: { $in: uniqueProductIds } })
      .select('_id specificCategory')
      .lean();
    const productCategoryCache = new Map(products.map(p => [p._id.toString(), p.specificCategory?.toString() || null]));

    // Helper function to update a single product category
    const updateProductCategory = async (entry) => {
      const fd = entry.feedData || {};
      const offerId = fd.id;

      if (!offerId) {
        return { skipped: true, reason: 'no_offerId' };
      }

      // Get category info
      const productIdStr = entry.productId?.toString();
      const categoryId = productIdStr ? productCategoryCache.get(productIdStr) : null;
      const categoryName = categoryId ? (categoryNameMap.get(categoryId) || 'Unknown') : 'Unknown';

      // Determine the correct Google product category
      const googleCategory = getGoogleCategoryFromFullName(categoryName) || GOOGLE_TAXONOMY_IDS.DEFAULT;
      
      // Check if category needs updating
      const currentCategory = fd.google_product_category;
      if (currentCategory === googleCategory) {
        return { skipped: true, reason: 'already_correct' };
      }

      if (dryRun) {
        return { 
          success: true, 
          dryRun: true, 
          categoryName, 
          oldCategory: currentCategory, 
          newCategory: googleCategory 
        };
      }

      // Update the product in Google Merchant Center
      try {
        const googleProductId = `online:en:IN:${offerId}`;

        // Get the current product
        const existingProduct = await contentApi.products.get({
          merchantId,
          productId: googleProductId,
        }).catch(() => null);

        if (!existingProduct?.data) {
          return { success: false, error: 'Not found in Merchant Center', categoryName, offerId };
        }

        // Update with new category
        const updatedProduct = {
          ...existingProduct.data,
          googleProductCategory: googleCategory,
        };

        // Remove read-only fields
        delete updatedProduct.id;
        delete updatedProduct.kind;
        delete updatedProduct.source;
        delete updatedProduct.destinations;
        delete updatedProduct.issues;
        delete updatedProduct.offerId;

        await contentApi.products.insert({
          merchantId,
          requestBody: {
            ...updatedProduct,
            offerId: offerId,
          },
        });

        // Update in database
        await Catalogue.updateOne(
          { _id: entry._id },
          { 'feedData.google_product_category': googleCategory }
        );

        return { 
          success: true, 
          categoryName, 
          offerId, 
          oldCategory: currentCategory, 
          newCategory: googleCategory 
        };
      } catch (err) {
        return { 
          success: false, 
          error: err.message?.substring(0, 100), 
          categoryName, 
          offerId 
        };
      }
    };

    // Process in concurrent batches
    let hasMore = true;
    let lastId = null;

    while (hasMore) {
      // Fetch next batch (using lastId for efficient pagination)
      const query = {
        cycleId: latestCycle._id,
        processed: true,
        googleSynced: true,
      };
      if (lastId) {
        query._id = { $gt: lastId };
      }

      const batch = await Catalogue.find(query).sort({ _id: 1 }).limit(BATCH_SIZE).lean();

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      lastId = batch[batch.length - 1]._id;

      // Process batch with concurrency limit
      for (let i = 0; i < batch.length; i += CONCURRENCY_LIMIT) {
        const chunk = batch.slice(i, i + CONCURRENCY_LIMIT);
        const chunkResults = await Promise.all(chunk.map(updateProductCategory));

        // Process results
        for (const result of chunkResults) {
          if (result.skipped) {
            totalSkipped++;
            continue;
          }

          // Track category counts
          const catName = result.categoryName || 'Unknown';
          if (!categoryCounts[catName]) {
            categoryCounts[catName] = { 
              name: catName, 
              oldCategory: result.oldCategory,
              newCategory: result.newCategory,
              count: 0, 
              updated: 0, 
              failed: 0 
            };
          }
          categoryCounts[catName].count++;

          if (result.success) {
            categoryCounts[catName].updated++;
            totalUpdated++;
          } else {
            categoryCounts[catName].failed++;
            totalFailed++;
          }
          
          totalProcessed++;
        }
      }

      // Log progress
      if (totalProcessed > 0 && totalProcessed % 100 === 0) {
        console.log(`[Update Categories] Progress: ${totalProcessed} processed, ${totalUpdated} updated, ${totalFailed} failed`);
      }

      if (batch.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    // Build category breakdown
    const categoryBreakdown = Object.values(categoryCounts).sort((a, b) => b.count - a.count);

    const processingTimeMs = Date.now() - startTime;
    console.log(`[Update Categories] Completed: ${totalUpdated} updated, ${totalFailed} failed, ${totalSkipped} skipped`);

    return NextResponse.json({
      success: true,
      message: dryRun 
        ? 'Dry run completed - no changes made' 
        : `Category update completed`,
      summary: {
        cycleId: latestCycle._id.toString(),
        totalSyncedProducts: totalSynced,
        processed: totalProcessed,
        updated: totalUpdated,
        failed: totalFailed,
        skipped: totalSkipped,
        processingTimeMs,
        dryRun,
        concurrency: CONCURRENCY_LIMIT,
      },
      categoryBreakdown,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Update Categories] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal Server Error',
      message: error.message,
    }, { status: 500 });
  }
}
