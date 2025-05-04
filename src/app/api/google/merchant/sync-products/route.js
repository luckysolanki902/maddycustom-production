// app/api/google/merchant/sync-products/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Catalogue from '@/models/meta/Catalogue';
import { NextResponse } from 'next/server';
import { initializeContentApi } from '@/lib/merchant/googleContentApi';

export async function GET() {
  try {
    // 1. Connect
    await connectToDatabase();

    // 2. Init Google Content API client
    const contentApi = initializeContentApi();

    // 3. Fetch catalogue entries (only those you've marked processed)
    const entries = await Catalogue.find({ processed: true }).limit(10).lean();

    // 4. Map feedData → Google product schema
    const mappedProducts = entries.map(({ feedData }) => {
      // ensure numeric price & INR currency
      const rawPrice = feedData.price || '';
      const numeric = parseFloat(rawPrice.replace(/[^\d.]/g, '')) || 0;

      return {
        offerId:            feedData.id,
        title:              feedData.title,
        description:        feedData.description,
        availability:       feedData.availability || 'in stock',
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
        // default to a broad Google category if none provided
        googleProductCategory: 'Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Exterior Accessories',
      };
    });

    // 5. Insert or update each product
    const results = [];
    for (const product of mappedProducts) {
      try {
        await contentApi.products.insert({
          merchantId: process.env.MERCHANT_ID,
          requestBody: product,
        });
        results.push({ offerId: product.offerId, status: 'Inserted' });
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
          } catch (updateError) {
            results.push({ offerId: product.offerId, status: 'Failed to Update', error: updateError.message });
          }
        } else {
          results.push({ offerId: product.offerId, status: 'Failed to Insert', error: insertError.message });
        }
      }
    }

    // 6. Return summary
    return NextResponse.json({ message: 'Sync completed', results }, { status: 200 });

  } catch (error) {
    console.error('Error syncing products:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
