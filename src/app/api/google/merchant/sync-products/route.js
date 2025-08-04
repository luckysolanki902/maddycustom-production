// app/api/google/merchant/sync-products/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import { NextResponse } from 'next/server';
import { initializeContentApi } from '@/lib/merchant/googleContentApi';

export const maxDuration = 300; // 5 minutes in seconds

export async function GET() {
  try {
    // 1. Connect to database
    await connectToDatabase();

    // 2. Initialize Google Content API client
    const contentApi = initializeContentApi();

    // Constants
    const SYNC_LIMIT = 10; // Maximum products to sync per run
    const currentTime = new Date();

    // 3. Fetch all available products with proper filtering
    const products = await Product.find(
      { available: true },
      {
        pageSlug: 1,
        title: 1,
        name: 1,
        images: 1,
        price: 1,
        MRP: 1,
        specificCategory: 1,
        specificCategoryVariant: 1,
        updatedAt: 1,
        sku: 1,
        category: 1,
        subCategory: 1,
        lastSyncedToGoogle: 1
      }
    )
      .populate('specificCategory', 'available name')
      .populate('specificCategoryVariant', 'available name productDescription')
      .lean()
      .exec();

    // 4. Filter products where all related entities are available
    const availableProducts = products.filter(product => {
      // Product must be available (already filtered in query)
      // SpecificCategory must exist and be available
      if (!product.specificCategory || product.specificCategory.available !== true) {
        return false;
      }
      // If product has a specificCategoryVariant, it must be available
      if (product.specificCategoryVariant && product.specificCategoryVariant.available !== true) {
        return false;
      }
      // Must have basic required fields
      if (!product.title || !product.price || !product.pageSlug) {
        return false;
      }
      return true;
    });

    // 5. Sort by sync priority: never synced first, then oldest synced, then by updatedAt
    const sortedProducts = availableProducts.sort((a, b) => {
      // Products never synced to Google get highest priority
      if (!a.lastSyncedToGoogle && !b.lastSyncedToGoogle) {
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      }
      if (!a.lastSyncedToGoogle) return -1;
      if (!b.lastSyncedToGoogle) return 1;

      // Among synced products, prioritize oldest synced first
      const syncTimeDiff = new Date(a.lastSyncedToGoogle) - new Date(b.lastSyncedToGoogle);
      if (syncTimeDiff !== 0) return syncTimeDiff;

      // If sync times are equal, use updatedAt
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    // 6. Limit to SYNC_LIMIT products
    const productsToSync = sortedProducts.slice(0, SYNC_LIMIT);

    console.log(`Processing ${productsToSync.length} products out of ${availableProducts.length} available`);

    // 7. Process products
    const startTime = Date.now();
    const maxProcessingTime = 4.5 * 60 * 1000; // 4.5 minutes
    let totalSynced = 0;
    let results = [];
    const baseUrl = 'https://www.maddycustom.com';
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    for (let i = 0; i < productsToSync.length && Date.now() - startTime < maxProcessingTime; i++) {
      const product = productsToSync[i];
      const variant = product.specificCategoryVariant;
      const category = product.specificCategory;

      // Log current progress (minimal logging)
      console.log(`Syncing ${i + 1}/${productsToSync.length}: ${product.title}`);

      // Build product description
      const description = variant?.productDescription
        ?.replace(/{uniqueName}/g, product.name)
        ?.replace(/{fullBikename}/g, variant.name) ||
        `${product.title} - Premium quality custom vehicle wraps and accessories from MaddyCustom. Category: ${category.name}${variant ? `, Variant: ${variant.name}` : ''}`;

      // Get the main image
      const mainImage = product.images && product.images.length > 0
        ? `${baseImageUrl}${product.images[0].startsWith('/') ? product.images[0] : '/' + product.images[0]}`
        : `${baseImageUrl}/assets/placeholder-banner.jpg`;

      // Build Google product category based on your categories
      let googleProductCategory = 'Vehicles & Parts > Vehicle Parts & Accessories';
      if (product.category === 'Wraps') {
        if (product.subCategory === 'Car Wraps') {
          googleProductCategory = 'Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Exterior Accessories';
        } else if (product.subCategory === 'Bike Wraps') {
          googleProductCategory = 'Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Exterior Accessories';
        }
      } else if (product.category === 'Accessories') {
        googleProductCategory = 'Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Interior Accessories';
      }

      // Create unique offer ID
      const offerId = product.sku || `${product._id}`;

      const merchantProduct = {
        offerId: offerId,
        title: product.title.length > 150 ? product.title.substring(0, 147) + '...' : product.title,
        description: description.length > 5000 ? description.substring(0, 4997) + '...' : description,
        availability: 'in stock', // All products passing our filter are in stock
        condition: 'new',
        price: {
          value: product.price.toFixed(2),
          currency: 'INR',
        },
        salePrice: product.MRP && product.MRP > product.price ? {
          value: product.price.toFixed(2),
          currency: 'INR',
        } : undefined,
        link: `${baseUrl}/shop${product.pageSlug}`,
        imageLink: mainImage,
        brand: 'MaddyCustom',
        channel: 'online',
        contentLanguage: 'en',
        targetCountry: 'IN',
        googleProductCategory: googleProductCategory,
        customAttributes: [
          {
            name: 'category',
            value: product.category
          },
          {
            name: 'subcategory',
            value: product.subCategory
          }
        ]
      };

      // Add additional images if available
      if (product.images && product.images.length > 1) {
        merchantProduct.additionalImageLinks = product.images.slice(1, 11).map(img =>
          `${baseImageUrl}${img.startsWith('/') ? img : '/' + img}`
        );
      }

      let syncSuccessful = false;
      try {
        await contentApi.products.insert({
          merchantId: process.env.MERCHANT_ID,
          requestBody: merchantProduct,
        });
        results.push({ offerId: offerId, status: 'Inserted' });
        syncSuccessful = true;
        totalSynced++;
      } catch (insertError) {
        if (insertError.code === 409) {
          // Product already exists, update it
          try {
            await contentApi.products.update({
              merchantId: process.env.MERCHANT_ID,
              productId: offerId,
              requestBody: merchantProduct,
            });
            results.push({ offerId: offerId, status: 'Updated' });
            syncSuccessful = true;
            totalSynced++;
          } catch (updateError) {
            results.push({
              offerId: offerId,
              status: 'Failed to Update',
              error: updateError.message.substring(0, 100)
            });
          }
        } else {
          results.push({
            offerId: offerId,
            status: 'Failed to Insert',
            error: insertError.message.substring(0, 100)
          });
        }
      }

      // Update lastSyncedToGoogle if sync was successful
      try {
        await Product.updateOne(
          { _id: product._id },
          { lastSyncedToGoogle: currentTime }
        );
      } catch (updateError) {
        console.log(`Failed to update lastSyncedToGoogle for ${offerId}`);
      }

      // Check time limit
      if (Date.now() - startTime > maxProcessingTime) {
        console.log('Time limit reached, stopping sync');
        break;
      }
    }

    // 8. Return comprehensive summary
    const successfulSyncs = results.filter(r => r.status === 'Inserted' || r.status === 'Updated').length;
    const failedSyncs = results.filter(r => r.status.startsWith('Failed')).length;

    console.log(`Sync completed: ${successfulSyncs} successful, ${failedSyncs} failed`);

    return NextResponse.json({
      message: 'Google Merchant sync completed',
      summary: {
        totalAvailableProducts: availableProducts.length,
        processedThisRun: productsToSync.length,
        totalSynced: totalSynced,
        successfulSyncs: successfulSyncs,
        failedSyncs: failedSyncs,
        processingTimeMs: Date.now() - startTime,
        syncLimit: SYNC_LIMIT
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
