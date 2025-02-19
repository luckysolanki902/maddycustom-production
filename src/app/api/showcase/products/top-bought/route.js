import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import Order from '@/models/Order';
import mongoose from 'mongoose';

export async function GET(request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const subCategoriesParam = searchParams.get('subCategories') || ''; 
    const currentProductId = searchParams.get('currentProductId') || '';
    const skipParam = parseInt(searchParams.get('skip') || '0', 10);
    const PAGE_SIZE = 10;

    // Step 1: Build the exclusion list
    let excludeProductIds = [];
    // Optionally push currentProductId if it's a valid ID
    if (mongoose.isValidObjectId(currentProductId)) {
      excludeProductIds.push(currentProductId);
    }

    const excludeProductIdsParam = searchParams.get('excludeProductIds') || '';
    if (excludeProductIdsParam.trim()) {
      const additionalExclusions = excludeProductIdsParam
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      // Validate each ID and convert to ObjectId
      additionalExclusions.forEach(id => {
        if (mongoose.isValidObjectId(id)) {
          excludeProductIds.push(id);
        }
      });
    }

    // Finally convert each ID to a real ObjectId instance
    excludeProductIds = excludeProductIds.map(id => new mongoose.Types.ObjectId(id));

    // Step 2: Parse subCategories
    const subCategories = subCategoriesParam
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (subCategories.length === 0) {
      return NextResponse.json(
        { error: 'At least one subCategory is required' },
        { status: 400 }
      );
    }

    // 3) Find all specific categories (spec cats) for these subCategories
    const scDocs = await SpecificCategory.find({
      subCategory: { $in: subCategories },
      available: true,
    }).select('_id name');

    if (!scDocs || scDocs.length === 0) {
      return NextResponse.json({
        products: [],
        message: `No specific categories found for subCategories: ${subCategories.join(', ')}`
      });
    }
    const scIds = scDocs.map(doc => doc._id);

    // 4) Find all Specific Category Variants (SCVs) for these spec cats
    const scvDocs = await SpecificCategoryVariant.find({
      specificCategory: { $in: scIds },
      available: true,
    })
      .select('_id name specificCategory')
      .populate('specificCategory', 'name');

    if (!scvDocs || scvDocs.length === 0) {
      return NextResponse.json({
        products: [],
        message: `No specific category variants found for subCategories: ${subCategories.join(', ')}`
      });
    }

    // Group SCVs by their parent specific category
    const scvBySpecCat = {};
    scvDocs.forEach(scv => {
      const catId = scv.specificCategory._id.toString();
      if (!scvBySpecCat[catId]) scvBySpecCat[catId] = [];
      scvBySpecCat[catId].push(scv);
    });

    // Create a map for SCV details
    const scvMap = {};
    scvDocs.forEach(scv => {
      scvMap[scv._id.toString()] = scv;
    });

    // Helper: get sorted products for a given spec cat
    async function getSortedProductsForSpecCat(specCat) {
      const catId = specCat._id.toString();
      const scvs = scvBySpecCat[catId] || [];
      if (scvs.length === 0) return [];

      const scvIds = scvs.map(v => v._id);

      // 1) Find all products in these variants that are available and not excluded
      const productsQuery = await Product.find({
        specificCategoryVariant: { $in: scvIds },
        available: true,
        _id: { $nin: excludeProductIds },
      }).lean();

      if (!productsQuery || productsQuery.length === 0) return [];

      // 2) Compute totalBought via Order aggregation
      const pIds = productsQuery.map(p => p._id);
      const aggregationResults = await Order.aggregate([
        { $match: { 'items.product': { $in: pIds } } },
        { $unwind: '$items' },
        { $match: { 'items.product': { $in: pIds } } },
        {
          $group: {
            _id: '$items.product',
            totalBought: { $sum: '$items.quantity' },
          },
        },
      ]);

      const boughtMap = {};
      aggregationResults.forEach(item => {
        boughtMap[item._id.toString()] = item.totalBought;
      });

      // 3) Attach totalBought and other fields
      const productsWithCount = productsQuery.map(prod => ({
        ...prod,
        totalBought: boughtMap[prod._id.toString()] || 0,
        specificCategoryName: specCat.name,
        specificCategoryVariantName: scvMap[prod.specificCategoryVariant.toString()]?.name || '',
      }));

      // 4) Sort by totalBought desc, then name asc
      productsWithCount.sort((a, b) => {
        if (b.totalBought !== a.totalBought) {
          return b.totalBought - a.totalBought;
        }
        return a.name.localeCompare(b.name);
      });

      return productsWithCount;
    }

    // 5) Merge all spec cat arrays in round-robin
    const specCatProductsArrays = await Promise.all(
      scDocs.map(sc => getSortedProductsForSpecCat(sc))
    );
    const merged = roundRobinMerge(specCatProductsArrays);

    // 6) Apply pagination (PAGE_SIZE+1 to check hasMore)
    const paginated = merged.slice(skipParam, skipParam + PAGE_SIZE + 1);
    const hasMore = paginated.length > PAGE_SIZE;
    const finalProducts = hasMore ? paginated.slice(0, PAGE_SIZE) : paginated;

    return NextResponse.json({
      products: finalProducts,
      totalFound: finalProducts.length,
      hasMore,
    });
  } catch (err) {
    console.error('Error in Balanced Top-Bought route:', err?.message);
    return NextResponse.json(
      { error: 'Server error', details: err?.message },
      { status: 500 }
    );
  }
}

/**
 * Helper: roundRobinMerge
 * Merge an array of arrays in a round-robin manner.
 * E.g., [[p1,p2],[q1,q2,q3],[r1]] => [p1,q1,r1,p2,q2,q3].
 */
function roundRobinMerge(arrOfArrs) {
  const merged = [];
  let done = false;
  let idx = 0;
  while (!done) {
    done = true;
    for (let i = 0; i < arrOfArrs.length; i++) {
      if (idx < arrOfArrs[i].length) {
        merged.push(arrOfArrs[i][idx]);
        done = false;
      }
    }
    idx++;
  }
  return merged;
}
