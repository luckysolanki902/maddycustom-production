// /api/showcase/products/top-bought/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';

import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import Order from '@/models/Order';

export async function GET(request) {
  try {
    console.log('--- Balanced Top-Bought Products API Call Started ---');

    // 1) Connect to DB
    await connectToDatabase();
    console.log('Database connected.');

    // 2) Read search params
    const { searchParams } = new URL(request.url);
    const subCategoriesParam = searchParams.get('subCategories'); // e.g. "Car Wraps,Motorcycle Wraps"
    const currentProductId = searchParams.get('currentProductId');
    const skipParam = parseInt(searchParams.get('skip') || '0', 10);
    const PAGE_SIZE = 10;

    // Parse subCategories into an array
    const subCategories = subCategoriesParam
      ? subCategoriesParam.split(',').map(s => s.trim())
      : [];

    console.log(
      `Params => subCategories: ${subCategories.join(', ')}, currentProductId: ${currentProductId}, skip: ${skipParam}`
    );

    if (subCategories.length === 0) {
      return NextResponse.json(
        { error: 'At least one subCategory is required' },
        { status: 400 }
      );
    }

    // 3) Find all specific categories for these subCategories
    const scDocs = await SpecificCategory.find({
      subCategory: { $in: subCategories },
      available: true
    }).select('_id name');

    if (!scDocs || scDocs.length === 0) {
      return NextResponse.json({
        products: [],
        message: `No specific categories found for subCategories: ${subCategories.join(', ')}`
      });
    }

    const scIds = scDocs.map(doc => doc._id);

    // 4) Find all SCVs for those specific categories and populate specificCategory name
    const scvDocs = await SpecificCategoryVariant.find({
      specificCategory: { $in: scIds },
      available: true
    })
      .select('_id name specificCategory')
      .populate('specificCategory', 'name');

    if (!scvDocs || scvDocs.length === 0) {
      return NextResponse.json({
        products: [],
        message: `No SCVs found for subCategories: ${subCategories.join(', ')}`
      });
    }

    console.log(
      `Found ${scvDocs.length} SCVs for subCategories: ${subCategories.join(', ')}.`
    );

    // We'll gather an array-of-arrays: each entry is a sorted list of products for that SCV.
    // Then we'll do a round-robin merge.

    // Prepare aggregator function to get sorted products for a single SCV:
    async function getSortedProductsForSCV(scvDoc) {
      const scvId = scvDoc._id;
      const specificCategoryName = scvDoc.specificCategory.name;
      const specificCategoryVariantName = scvDoc.name;

      // 1) find all products in this SCV
      const productsQuery = await Product.find({
        specificCategoryVariant: scvId,
        available: true,
        ...(currentProductId ? { _id: { $ne: currentProductId } } : {})
      }).lean();

      if (!productsQuery || productsQuery.length === 0) {
        return [];
      }

      // 2) find totalBought for these productIds
      const pIds = productsQuery.map(p => p._id);
      const aggregationResults = await Order.aggregate([
        { $match: { 'items.product': { $in: pIds } } },
        { $unwind: '$items' },
        { $match: { 'items.product': { $in: pIds } } },
        {
          $group: {
            _id: '$items.product',
            totalBought: { $sum: '$items.quantity' }
          }
        }
      ]);

      // create a map for totalBought
      const boughtMap = {};
      aggregationResults.forEach(item => {
        boughtMap[item._id.toString()] = item.totalBought;
      });

      // 3) attach totalBought and additional fields to each product, default 0
      const productsWithCount = productsQuery.map(prod => ({
        ...prod,
        totalBought: boughtMap[prod._id.toString()] || 0,
        specificCategoryName: specificCategoryName,
        specificCategoryVariantName: specificCategoryVariantName
      }));

      // 4) sort descending by totalBought, then ascending by name
      productsWithCount.sort((a, b) => {
        if (b.totalBought !== a.totalBought) {
          return b.totalBought - a.totalBought;
        }
        return a.name.localeCompare(b.name);
      });

      return productsWithCount;
    }

    // Gather all arrays in parallel
    const scvListOfArrays = await Promise.all(
      scvDocs.map(scv => getSortedProductsForSCV(scv))
    );

    // scvListOfArrays is an array of arrays, each sorted desc by totalBought
    // We'll do a round-robin merge of them into one big array.

    const merged = roundRobinMerge(scvListOfArrays);
    console.log(`Merged round-robin array length: ${merged.length}`);

    // 5) skip & limit => we actually fetch PAGE_SIZE+1 to see if there's more
    const paginated = merged.slice(skipParam, skipParam + PAGE_SIZE + 1);
    const hasMore = paginated.length > PAGE_SIZE;
    const finalProducts = hasMore
      ? paginated.slice(0, PAGE_SIZE)
      : paginated;

    return NextResponse.json({
      products: finalProducts,
      totalFound: finalProducts.length,
      hasMore
    });
  } catch (err) {
    console.error('Error in Balanced Top-Bought route:', err);
    return NextResponse.json(
      { error: 'Server error', details: err.message },
      { status: 500 }
    );
  }
}

/**
 * Helper: roundRobinMerge
 * Takes an array of arrays, merges them in round-robin fashion:
 * e.g. [[p1,p2,p3],[q1,q2,q3],[r1,r2]] => [p1,q1,r1,p2,q2,r2,p3,q3]
 */
function roundRobinMerge(arrOfArrs) {
  let merged = [];
  let done = false;
  let idx = 0;

  // while at least one array still has elements
  while (!done) {
    done = true;
    for (let i = 0; i < arrOfArrs.length; i++) {
      const subArr = arrOfArrs[i];
      if (idx < subArr.length) {
        merged.push(subArr[idx]);
        done = false;
      }
    }
    idx++;
  }
  return merged;
}
