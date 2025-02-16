// /app/api/google/merchant/sync-products/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import { NextResponse } from 'next/server';
import { initializeContentApi } from '@/lib/merchant/googleContentApi';

/**
 * POST /api/admin/sync-products
 * 
 * Fetches products from the database and uploads them to Google Merchant Center.
 */
export async function GET() {
  try {
    // 1. Connect to the database
    await connectToDatabase();

    // 2. Initialize Content API client
    const contentApi = initializeContentApi();

    // 3. Define specificCategoryCodes to filter
    // Warning: Don't just add hel directly: Add the price function as made 
    const specificCategoryCodes = ['win', 'bw', 'tw'];

    // 4. Fetch SpecificCategory documents matching the specified codes
    const specificCategories = await SpecificCategory.find({
      specificCategoryCode: { $in: specificCategoryCodes },
    }).select('_id');

    const specificCategoryIds = specificCategories.map(cat => cat._id);

    // 5. Fetch Products that belong to the matched SpecificCategories
    const products = await Product.find({
      specificCategory: { $in: specificCategoryIds },
      available: true,
    })
      .populate('specificCategoryVariant')
      .lean();

    // 6. Map products to Google Merchant format
    const mappedProducts = products.map(product => ({
      offerId: product.sku, // Unique identifier for the product
      title: product.title,
      description: product.specificCategoryVariant && product.specificCategoryVariant.productDescription
        ? product.specificCategoryVariant.productDescription.replace('{uniqueName}', product.name)
        : product.description || '', // Ensure description is present
      availability: 'in stock', // Static value
      condition: 'new',         // Static value
      price: {
        value: product.price.toFixed(2), // Ensure price is a string with two decimal places
        currency: 'INR', // Adjust as per your currency
      },
      link: `https://www.maddycustom.com/shop${product.pageSlug}`,
      imageLink: product.images[0]
        ? `https://d26w01jhwuuxpo.cloudfront.net${product.images[0].startsWith('/') ? product.images[0] : '/' + product.images[0]}`
        : '', // Ensure imageLink is present
      brand: 'Maddy Custom', // Static value
      channel: 'online', // **Added Required Field**
      contentLanguage: 'en', // **Added Required Field**
      targetCountry: 'IN', // **Added Required Field**
      googleProductCategory: mapToGoogleCategory(product.category, product.subCategory), // Ensure this is mapped
      mpn: product.mpn || '', // Ensure your schema includes this or handle accordingly
      // gtin: product.gtin || '', // Uncomment if you have GTINs
    }));

    // 7. Insert or update products in Google Merchant Center
    const insertResponses = [];

    for (const product of mappedProducts) {
      try {
        const res = await contentApi.products.insert({
          merchantId: process.env.MERCHANT_ID,
          requestBody: product,
        });
        insertResponses.push({ offerId: product.offerId, status: 'Inserted', data: res.data });
      } catch (insertError) {
        if (insertError.code === 409) { // Conflict, possibly the product already exists
          // Update the existing product
          try {
            const updateRes = await contentApi.products.update({
              merchantId: process.env.MERCHANT_ID,
              productId: product.offerId,
              requestBody: product,
            });
            insertResponses.push({ offerId: product.offerId, status: 'Updated', data: updateRes.data });
          } catch (updateError) {
            insertResponses.push({ offerId: product.offerId, status: 'Failed to Update', error: updateError.message });
          }
        } else {
          insertResponses.push({ offerId: product.offerId, status: 'Failed to Insert', error: insertError.message });
        }
      }
    }

    // 8. Return a summary of operations
    return NextResponse.json({ message: 'Sync completed', results: insertResponses }, { status: 200 });
  } catch (error) {
    console.error('Error syncing products:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Helper function to map internal categories to Google categories
const mapToGoogleCategory = (category, subCategory) => {
  const categoryMapping = {
    'Wraps': {
      'Car Wraps': 'Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Exterior Accessories',
      'Bike Wraps': 'Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Exterior Accessories',
    },
    'Accessories': {
      'Safety': 'Vehicles & Parts > Vehicle Parts & Accessories > Motorcycle Parts & Accessories > Motorcycle Protective Gear > Motorcycle Helmets',
    },
  };

  if (categoryMapping[category] && categoryMapping[category][subCategory]) {
    return categoryMapping[category][subCategory];
  }

  console.warn(`No Google category mapping found for category: ${category}, subCategory: ${subCategory}.`);
  return 'Vehicles & Parts > Vehicle Parts & Accessories'; // Default category
};
