// app/api/google/merchant/sync-products/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Catalogue from '@/models/meta/Catalogue';
import CatalogueCycle from '@/models/meta/CatalogueCycle';
import { NextResponse } from 'next/server';
import { initializeContentApi } from '@/lib/merchant/googleContentApi';
import { insertOrUpdateProductInput } from '@/lib/merchant/googleMerchantApi';

export const maxDuration = 300; // 5 minutes in seconds

export async function GET(request) {
  try {
    // Check for force resync query param
    const { searchParams } = new URL(request.url);
    const forceResync = searchParams.get('forceResync') === 'true';

    // 1. Connect to database
    await connectToDatabase();

    // 2. Initialize API client(s)
  const useMerchantApi = true;
    let contentApi = null;
    if (!useMerchantApi) {
      contentApi = initializeContentApi();
    }

  // Constants
  const BATCH_SIZE = parseInt(process.env.GOOGLE_SYNC_BATCH_SIZE || '50', 10); // dynamic sizing
  const currentTime = new Date();

    // 3. Load latest completed catalogue cycle
    const latestCycle = await CatalogueCycle.findOne({ status: 'completed' }).sort({ startedAt: -1 });
    if (!latestCycle) {
      return NextResponse.json({
        success: false,
        message: 'No completed catalogue cycle found. Run catalogue generation first.'
      }, { status: 400 });
    }

    // If force resync, reset the google sync progress for this cycle
    if (forceResync) {
      await CatalogueCycle.updateOne({ _id: latestCycle._id }, {
        googleSyncLastId: null,
        googleSyncProcessedCount: 0,
        googleSyncCompleted: false
      });
      // Reset googleSynced flag for all entries in this cycle
      await Catalogue.updateMany(
        { cycleId: latestCycle._id },
        { googleSynced: false }
      );
      // Refresh the cycle data
      latestCycle.googleSyncLastId = null;
      latestCycle.googleSyncProcessedCount = 0;
      latestCycle.googleSyncCompleted = false;
    }

    // 4. Iterate through unsynced catalogue entries in batches until time budget exhausted
    let lastId = latestCycle.googleSyncLastId; // resume point
    let processedThisRun = 0;
    let results = [];
    const startTime = Date.now();
    const maxProcessingTime = 4.5 * 60 * 1000; // 4.5 minutes within 5m limit
    let exhausted = false;
    let totalSynced = 0;

    while (Date.now() - startTime < maxProcessingTime) {
      const query = {
        cycleId: latestCycle._id,
        processed: true,
        googleSynced: false,
      };
      if (lastId) {
        query._id = { $gt: lastId };
      }
      const batch = await Catalogue.find(query).sort({ _id: 1 }).limit(BATCH_SIZE).lean();
      if (batch.length === 0) {
        exhausted = true;
        break;
      }
      // process batch
      for (let i = 0; i < batch.length && Date.now() - startTime < maxProcessingTime; i++) {
        const entry = batch[i];
        const fd = entry.feedData || {};
        const productId = fd.id;
        const offerId = productId; // Use productId as offerId
        console.info(`Syncing product ${productId} to Merchant API`);
        const merchantProduct = {
          offerId,
          title: (fd.title || '').substring(0,150),
          description: (fd.description || '').substring(0, 5000),
          availability: fd.availability === 'in stock' ? 'in stock' : 'out of stock',
          condition: fd.condition || 'new',
          price: {
            value: (fd.price_amount ?? parseFloat((fd.price||'0').split(' ')[0]||'0')).toFixed(2),
            currency: fd.price_currency || (fd.price ? (fd.price.split(' ')[1] || 'INR') : 'INR')
          },
          salePrice: (fd.sale_price_amount ? { value: fd.sale_price_amount.toFixed(2), currency: fd.sale_price_currency || fd.price_currency || 'INR' } : undefined),
          link: fd.link,
          imageLink: fd.image_link,
          brand: fd.brand || 'MaddyCustom',
          channel: fd.channel || 'online',
          contentLanguage: fd.content_language || 'en',
            targetCountry: fd.target_country || 'IN',
          googleProductCategory: fd.google_product_category,
          customAttributes: (fd.custom_attributes || []).map(a => ({ name: a.name, value: a.value })),
        };
        if (fd.additional_image_links && fd.additional_image_links.length) {
          merchantProduct.additionalImageLinks = fd.additional_image_links;
        }

        let syncSuccessful = false;
        try {
          if (useMerchantApi) {
            const merchantAccountId = process.env.MERCHANT_ID || process.env.MERCHANT_ACCOUNT_ID;
            if (!merchantAccountId) throw new Error('MERCHANT_ID or MERCHANT_ACCOUNT_ID env var required');
            const resp = await insertOrUpdateProductInput(merchantAccountId, merchantProduct, { feedLabel: fd.feed_label || 'IN', contentLanguage: fd.content_language || 'en', channel: (fd.channel || 'online').toUpperCase() });
            results.push({ offerId, status: resp.status });
            syncSuccessful = true;
            totalSynced++;
          } else {
            await contentApi.products.insert({
              merchantId: process.env.MERCHANT_ID,
              requestBody: merchantProduct,
            });
            results.push({ offerId, status: 'Inserted' });
            syncSuccessful = true;
            totalSynced++;
          }
        } catch (insertError) {
          if (!useMerchantApi && insertError.code === 409) {
            try {
              await contentApi.products.update({
                merchantId: process.env.MERCHANT_ID,
                productId: offerId,
                requestBody: merchantProduct,
              });
              results.push({ offerId, status: 'Updated' });
              syncSuccessful = true;
              totalSynced++;
            } catch (updateError) {
              results.push({ offerId, status: 'Failed to Update', error: updateError.message.substring(0,120) });
            }
          } else {
            results.push({ offerId, status: 'Failed', error: insertError.message.substring(0,160) });
          }
        }

        if (syncSuccessful) {
          try {
            await Catalogue.updateOne({ _id: entry._id }, { googleSynced: true });
          } catch (_) {}
        }
        lastId = entry._id; // advance pointer regardless to avoid re-processing
        processedThisRun++;
      }
      // Persist progress after each batch
      await CatalogueCycle.updateOne({ _id: latestCycle._id }, {
        googleSyncLastId: lastId,
        $inc: { googleSyncProcessedCount: processedThisRun },
        googleSyncCompleted: exhausted
      });
      processedThisRun = 0; // reset counter for next batch increment usage
    }

    if (exhausted) {
      await CatalogueCycle.updateOne({ _id: latestCycle._id }, { googleSyncCompleted: true });
    }

  // 8. Return comprehensive summary
  const successfulSyncs = results.filter(r => r.status === 'Inserted' || r.status === 'Updated').length;
  const failedSyncs = results.filter(r => r.status.startsWith('Failed') || r.status === 'Failed').length;

    console.info(`Sync completed: ${successfulSyncs} successful, ${failedSyncs} failed`);

    return NextResponse.json({
      message: 'Google Merchant sync completed',
      summary: {
        cycleId: latestCycle._id,
        processedThisRun: results.length,
        totalSynced: totalSynced,
        successfulSyncs: successfulSyncs,
        failedSyncs: failedSyncs,
        processingTimeMs: Date.now() - startTime,
        batchSize: BATCH_SIZE,
        exhausted,
        forceResync: forceResync || false,
      },
      timestamp: new Date().toISOString(),
      success: true
    }, { status: 200 });

  } catch (error) {
    console.error('Error syncing products to Google Merchant:', error);
    return NextResponse.json({
      error: 'Internal Server Error',
      message: error.message,
      success: false
    }, { status: 500 });
  }
}
