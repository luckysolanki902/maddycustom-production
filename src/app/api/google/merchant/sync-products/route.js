// app/api/google/merchant/sync-products/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Catalogue from '@/models/meta/Catalogue';
import CatalogueCycle from '@/models/meta/CatalogueCycle';
import { NextResponse } from 'next/server';
import { initializeContentApi } from '@/lib/merchant/googleContentApi';
export const maxDuration = 600
export async function GET() {
  try {
    // 1. Connect
    await connectToDatabase();

    // 2. Init Google Content API client
    const contentApi = initializeContentApi();

    // 3. Get the latest completed catalogue cycle
    const latestCycle = await CatalogueCycle.findOne({ 
      status: 'completed' 
    }).sort({ startedAt: -1 });

    if (!latestCycle) {
      return NextResponse.json({ 
        message: 'No completed catalogue cycle found. Please run the catalogue generation first.',
        success: false 
      }, { status: 400 });
    }


    // 4. Loop and process unsynced catalogue entries until time limit is reached
    const startTime = Date.now();
    const maxProcessingTime = 4.5 * 60 * 1000; // 4.5 minutes
    const batchSize = 10; // Process 10 products per batch for Google sync
    let totalSynced = 0;
    let results = [];
    let processedIds = [];

    while (Date.now() - startTime < maxProcessingTime) {
      // Fetch next batch of unsynced entries
      const entries = await Catalogue.find({
        cycleId: latestCycle._id,
        processed: true,
        googleSynced: false,
      }).limit(batchSize).lean();

      if (entries.length === 0) {
        break;
      }

      for (const entry of entries) {
        const feedData = entry.feedData;
        const rawPrice = feedData.price || '';
        const numeric = parseFloat(rawPrice.replace(/[^\d.]/g, '')) || 0;
        const product = {
          offerId:            feedData.id,
          title:              feedData.title,
          description:        feedData.description,
          availability:       'in stock',
          condition:          feedData.condition   || 'new',
          price: {
            value:    numeric.toFixed(2),
            currency: 'INR',
          },
          link:               feedData.link,
          imageLink:          feedData.image_link,
          brand:              feedData.brand       || 'Maddy Custom',
          channel:            'online',
          contentLanguage:    'en',
          targetCountry:      'IN',
          googleProductCategory: 'Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Exterior Accessories',
        };
        try {
          await contentApi.products.insert({
            merchantId: process.env.MERCHANT_ID,
            requestBody: product,
          });
          results.push({ offerId: product.offerId, status: 'Inserted' });
          processedIds.push(entry._id);
        } catch (insertError) {
          if (insertError.code === 409) {
            // already exists → update
            try {
              await contentApi.products.update({
                merchantId: process.env.MERCHANT_ID,
                productId: product.offerId,
                requestBody: product,
              });
              results.push({ offerId: product.offerId, status: 'Updated' });
              processedIds.push(entry._id);
            } catch (updateError) {
              results.push({ offerId: product.offerId, status: 'Failed to Update', error: updateError.message });
            }
          } else {
            results.push({ offerId: product.offerId, status: 'Failed to Insert', error: insertError.message });
          }
        }
      }

      // Mark processed entries as synced
      if (processedIds.length > 0) {
        await Catalogue.updateMany({ _id: { $in: processedIds } }, { $set: { googleSynced: true } });
        totalSynced += processedIds.length;
        processedIds = [];
      }

      // Check time again before next batch
      if (Date.now() - startTime > maxProcessingTime) {
        break;
      }
    }

    // 6. Return summary
    return NextResponse.json({ 
      message: 'Sync completed', 
      results,
      cycleId: latestCycle._id,
      totalSynced,
      successfulSyncs: results.filter(r => r.status === 'Inserted' || r.status === 'Updated').length,
      failedSyncs: results.filter(r => r.status.startsWith('Failed')).length,
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error) {
    console.error('Error syncing products:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
