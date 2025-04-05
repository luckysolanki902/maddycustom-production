import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import Order from '@/models/Order';
import Option from '@/models/Option';
import mongoose from 'mongoose';
import inventory from '@/models/Inventory';

export const revalidate = 3600; // seconds

export async function GET(request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);

    const subCategoriesParam = searchParams.get('subCategories') || '';
    const currentProductId = searchParams.get('currentProductId') || '';
    const skipParam = parseInt(searchParams.get('skip') || '0', 10);
    const PAGE_SIZE = 10;

    // 1) Build the exclusion list.
    let excludeProductIds = [];
    if (mongoose.isValidObjectId(currentProductId)) {
      excludeProductIds.push(currentProductId);
    }
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
    excludeProductIds = excludeProductIds.map((id) => new mongoose.Types.ObjectId(id));

    // 2) Parse subCategories.
    let subCategories = subCategoriesParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (subCategories.length === 0) {
      return NextResponse.json(
        { error: 'At least one subCategory is required' },
        { status: 400 }
      );
    }

    // 3) Ensure we work with 3 subcategories.
    const REQUIRED_COUNT = 3;
    let scDocs;
    if (subCategories.length < REQUIRED_COUNT) {
      const additionalNeeded = REQUIRED_COUNT - subCategories.length;
      // Query additional candidate specific categories (that are not already in the list).
      let additionalCandidates = await SpecificCategory.find({
        available: true,
        subCategory: { $nin: subCategories },
      })
        .select('_id name specificCategoryCode subCategory')
        .lean();

      // Determine filtering: if all passed subCategories contain "car" or all contain "bike"
      const lowerPassed = subCategories.map((s) => s.toLowerCase());
      let filterKeyword = null;
      if (lowerPassed.every((s) => s.includes('car'))) {
        filterKeyword = 'bike'; // Exclude those with "bike"
      } else if (lowerPassed.every((s) => s.includes('bike'))) {
        filterKeyword = 'car'; // Exclude those with "car"
      }
      if (filterKeyword) {
        additionalCandidates = additionalCandidates.filter(
          (sc) => !sc.subCategory.toLowerCase().includes(filterKeyword)
        );
      }
      // Shuffle and pick the needed number.
      shuffleArray(additionalCandidates);
      const selectedCandidates = additionalCandidates.slice(0, additionalNeeded);
      // Append the additional subCategory strings.
      subCategories = subCategories.concat(selectedCandidates.map((sc) => sc.subCategory));
      // Now, fetch all specific categories matching the (now 3) subCategories.
      scDocs = await SpecificCategory.find({
        subCategory: { $in: subCategories },
        available: true,
      })
        .select('_id name specificCategoryCode subCategory')
        .lean();
    } else {
      scDocs = await SpecificCategory.find({
        subCategory: { $in: subCategories },
        available: true,
      })
        .select('_id name specificCategoryCode subCategory')
        .lean();
    }

    if (!scDocs || scDocs.length === 0) {
      return NextResponse.json({
        products: [],
        message: `No specific categories found for subCategories: ${subCategories.join(', ')}`,
      });
    }

    // 4) Find all Specific Category Variants for these specific categories.
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
    // Group SCVs by their parent specific category.
    const scvBySpecCat = {};
    scvDocs.forEach((scv) => {
      const catId = scv.specificCategory.toString();
      if (!scvBySpecCat[catId]) scvBySpecCat[catId] = [];
      scvBySpecCat[catId].push(scv);
    });
    // Create a quick map for SCV details.
    const scvMap = {};
    scvDocs.forEach((scv) => {
      scvMap[scv._id.toString()] = scv;
    });

    // Helper: get sorted products for a given specific category.
    async function getSortedProductsForSpecCat(specCat) {
      const catId = specCat._id.toString();
      const scvs = scvBySpecCat[catId] || [];
      if (scvs.length === 0) return [];

      const scvIds = scvs.map((v) => v._id);
      // (1) Find all products in these variants that are available & not excluded.
      const productsQuery = await Product.find({
        specificCategoryVariant: { $in: scvIds },
        available: true,
        _id: { $nin: excludeProductIds },
      }).lean();
      if (!productsQuery || productsQuery.length === 0) return [];

      // (2) Fetch options for these products (with inventory data).
      const pIds = productsQuery.map((p) => p._id);
      const optionsDocs = await Option.find({ product: { $in: pIds } })
        .populate('inventoryData')
        .lean();
      
      // Group options per product
      const optionsMap = {};
      optionsDocs.forEach((opt) => {
        const key = opt.product.toString();
        if (!optionsMap[key]) optionsMap[key] = [];
        optionsMap[key].push(opt);
      });
      // Sort each options array in descending order of inventoryData.availableQuantity.
      Object.keys(optionsMap).forEach((key) => {
        optionsMap[key].sort((a, b) => (b.inventoryData?.availableQuantity || 0) - (a.inventoryData?.availableQuantity || 0));
      });

      // (3) Compute totalBought via Order aggregation.
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

      // (4) Attach totalBought, category, variant details, and options.
      const productsWithCount = productsQuery.map((prod) => {
        const scv = scvMap[prod.specificCategoryVariant.toString()];
        return {
          ...prod,
          totalBought: boughtMap[prod._id.toString()] || 0,
          category: {
            specificCategoryCode: specCat.specificCategoryCode,
            name: specCat.name,
          },
          variantDetails: {
            available: scv?.available ?? false,
            availableBrands: scv?.availableBrands ?? [],
            name: scv?.name ?? '',
          },
          options: optionsMap[prod._id.toString()] || [],
        };
      });

      // (5) Sort by totalBought descending, then name ascending.
      productsWithCount.sort((a, b) => {
        if (b.totalBought !== a.totalBought) {
          return b.totalBought - a.totalBought;
        }
        return a.name.localeCompare(b.name);
      });
      return productsWithCount;
    }

    // 5) For each specific category, get the sorted products array.
    const specCatProductsArrays = await Promise.all(scDocs.map((sc) => getSortedProductsForSpecCat(sc)));

    // 6) Merge them in a round-robin style.
    const merged = roundRobinMerge(specCatProductsArrays);

    // 7) Apply pagination (using PAGE_SIZE+1 to detect hasMore).
    const paginated = merged.slice(skipParam, skipParam + PAGE_SIZE + 1);
    const hasMore = paginated.length > PAGE_SIZE;
    const finalProducts = hasMore ? paginated.slice(0, PAGE_SIZE) : paginated;

    return NextResponse.json({
      products: finalProducts,
      totalFound: merged.length,
      hasMore,
    });
  } catch (err) {
    console.error('Error in TopBought GET API:', err?.message);
    return NextResponse.json(
      { error: 'Server error', details: err?.message },
      { status: 500 }
    );
  }
}

/**
 * roundRobinMerge – merges an array of arrays in a round-robin manner.
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

// Helper: Fisher–Yates shuffle.
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
