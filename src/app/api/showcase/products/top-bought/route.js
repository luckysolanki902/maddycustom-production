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

    // 1) Build the exclusion list
    let excludeProductIds = [];
    // Optionally push currentProductId if it's a valid ID
    if (mongoose.isValidObjectId(currentProductId)) {
      excludeProductIds.push(currentProductId);
    }

    // Additional exclude IDs from the query
    const excludeProductIdsParam = searchParams.get('excludeProductIds') || '';
    if (excludeProductIdsParam.trim()) {
      const additionalExclusions = excludeProductIdsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      additionalExclusions.forEach((id) => {
        if (mongoose.isValidObjectId(id)) {
          excludeProductIds.push(id);
        }
      });
    }
    // Convert each ID to a real ObjectId
    excludeProductIds = excludeProductIds.map((id) => new mongoose.Types.ObjectId(id));

    // 2) Parse subCategories
    const subCategories = subCategoriesParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (subCategories.length === 0) {
      return NextResponse.json(
        { error: 'At least one subCategory is required' },
        { status: 400 }
      );
    }

    // 3) Find specific categories (SC) for these subCategories
    const scDocs = await SpecificCategory.find({
      subCategory: { $in: subCategories },
      available: true,
    }).select('_id name specificCategoryCode');

    if (!scDocs || scDocs.length === 0) {
      return NextResponse.json({
        products: [],
        message: `No specific categories found for subCategories: ${subCategories.join(', ')}`,
      });
    }

    // Build a quick lookup for SC
    const scDocsMap = {};
    scDocs.forEach((sc) => {
      scDocsMap[sc._id.toString()] = sc;
    });

    // 4) Find all SC Variants for these SC IDs
    const scIds = scDocs.map((doc) => doc._id);
    const scvDocs = await SpecificCategoryVariant.find({
      specificCategory: { $in: scIds },
      available: true,
    })
      .select('_id name available availableBrands specificCategory')
      .lean();

    if (!scvDocs || scvDocs.length === 0) {
      return NextResponse.json({
        products: [],
        message: `No specific category variants found for subCategories: ${subCategories.join(', ')}`,
      });
    }

    // Group SCVs by their parent SC
    const scvBySpecCat = {};
    scvDocs.forEach((scv) => {
      const catId = scv.specificCategory.toString();
      if (!scvBySpecCat[catId]) scvBySpecCat[catId] = [];
      scvBySpecCat[catId].push(scv);
    });

    // Also create a quick map for SCV
    const scvMap = {};
    scvDocs.forEach((scv) => {
      scvMap[scv._id.toString()] = scv;
    });

    // Helper: get sorted products for a given SC
    async function getSortedProductsForSpecCat(specCat) {
      const catId = specCat._id.toString();
      const scvs = scvBySpecCat[catId] || [];
      if (scvs.length === 0) return [];

      const scvIds = scvs.map((v) => v._id);

      // (1) Find all products in these variants that are available & not excluded
      const productsQuery = await Product.find({
        specificCategoryVariant: { $in: scvIds },
        available: true,
        _id: { $nin: excludeProductIds },
      }).lean();

      if (!productsQuery || productsQuery.length === 0) return [];

      // (2) Compute totalBought via Order aggregation
      const pIds = productsQuery.map((p) => p._id);
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
      aggregationResults.forEach((item) => {
        boughtMap[item._id.toString()] = item.totalBought;
      });

      // (3) Attach totalBought & enrich with category + variant details
      const productsWithCount = productsQuery.map((prod) => {
        const scv = scvMap[prod.specificCategoryVariant.toString()];
        return {
          ...prod,
          totalBought: boughtMap[prod._id.toString()] || 0,

          // Attach a `category` object, so it resembles your main ProductCard usage:
          category: {
            // Because you do product.category.specificCategoryCode etc. in your code
            specificCategoryCode: specCat.specificCategoryCode,
            name: specCat.name,
          },

          // Attach a `variantDetails` object
          variantDetails: {
            available: scv?.available ?? false,
            availableBrands: scv?.availableBrands ?? [],
            name: scv?.name ?? '',
          },
        };
      });

      // (4) Sort by totalBought desc, then name asc
      productsWithCount.sort((a, b) => {
        if (b.totalBought !== a.totalBought) {
          return b.totalBought - a.totalBought;
        }
        return a.name.localeCompare(b.name);
      });

      return productsWithCount;
    }

    // 5) For each SC, get the sorted products array
    const specCatProductsArrays = await Promise.all(scDocs.map((sc) => getSortedProductsForSpecCat(sc)));

    // 6) Merge them in a round-robin style
    const merged = roundRobinMerge(specCatProductsArrays);

    // 7) Apply pagination (PAGE_SIZE+1 to detect hasMore)
    const paginated = merged.slice(skipParam, skipParam + PAGE_SIZE + 1);
    const hasMore = paginated.length > PAGE_SIZE;
    const finalProducts = hasMore ? paginated.slice(0, PAGE_SIZE) : paginated;

    return NextResponse.json({
      products: finalProducts,
      totalFound: merged.length,
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
 * roundRobinMerge – merges an array of arrays in a round-robin manner
 * e.g. [[p1,p2],[q1,q2,q3],[r1]] => [p1,q1,r1,p2,q2,q3]
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
