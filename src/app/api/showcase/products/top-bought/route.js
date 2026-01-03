/* src/app/api/showcase/products/top-bought/route.js                      */
/* ---------------------------------------------------------------------- */

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import Order from '@/models/Order';
import Option from '@/models/Option';
import Inventory from '@/models/Inventory';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;

// In-memory cache for optimized performance
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const getCacheKey = (params) => {
  const { subCategories, singleVariantCode, singleCategoryCode, skip, currentProductId, excludeProductIds, cartDesignIds, excludeCategory } = params;
  return `${subCategories || ''}:${singleVariantCode || ''}:${singleCategoryCode || ''}:${skip}:${currentProductId || ''}:${excludeProductIds || ''}:${cartDesignIds || ''}:${excludeCategory || ''}`;
};

const getCachedData = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

/* enrich: attach options, totalBought, category, variantDetails ---------- */
async function enrichProducts(products, { specCatDoc, scvMap }) {
  if (!products.length) return [];

  const pIds = products.map((p) => p._id);

  // totalBoughtslice
  const buys = await Order.aggregate([
    { $match: { 'items.product': { $in: pIds } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', totalBought: { $sum: '$items.quantity' } } },
  ]);
  const buyMap = Object.fromEntries(buys.map((b) => [b._id.toString(), b.totalBought]));

  // options with inventory
  const opts = await Option.find({ product: { $in: pIds } })
    .populate('inventoryData')
    .lean();
  const optMap = {};
  opts.forEach((o) => {
    const k = o.product.toString();
    (optMap[k] ||= []).push(o);
  });
  Object.values(optMap).forEach((arr) =>
    arr.sort(
      (a, b) =>
        (b.inventoryData?.availableQuantity || 0) -
        (a.inventoryData?.availableQuantity || 0),
    ),
  );
    
    const finalProducts = Array.from(new Map(products.map(p => [p.specificCategory, p])).values())
      .map((p, i) => {
        const scv = scvMap[p.specificCategoryVariant.toString()];
        return {
          ...p,
          totalBought: buyMap[p._id.toString()] || 0,
          category: {
            specificCategoryCode: specCatDoc.specificCategoryCode,
            name: specCatDoc.name,
          },
          variantDetails: {
            available: scv?.available ?? false,
            availableBrands: scv?.availableBrands ?? [],
            name: scv?.name ?? "",
          },
          options: optMap[p._id.toString()] || [],
        };
      })
      .filter(p => {
        if (!p.inventoryData && !p.options?.length) {
          // this product doesn't have inventoryData or options to filter out of stock products so just filter it
          return true;
        }

        // Filter out products with zero inventory
        const hasInventory = p.inventoryData?.availableQuantity > 0;
        const hasOptionWithInventory = p.options?.some(opt => opt.inventoryData?.availableQuantity > 0);
        return hasInventory || hasOptionWithInventory;
      })
      .sort(
        (a, b) =>
          b.totalBought - a.totalBought || a.name.localeCompare(b.name) || a._id.toString().localeCompare(b._id.toString())
      );
  
  return finalProducts;
}

/* fetch products with same designGroupId from cart, avoiding duplicates per specific category */
async function fetchCartDesignGroupProducts(cartDesignIds, excludeProductIds, excludeCategory = '') {
  if (!cartDesignIds || !cartDesignIds.length) return [];

  // Convert to ObjectIds
  const designGroupIds = cartDesignIds.map(id => new mongoose.Types.ObjectId(id));
  const excludeIds = excludeProductIds ? excludeProductIds.map(id => new mongoose.Types.ObjectId(id)) : [];

  // Get all products with same designGroupIds from cart, grouped by specificCategoryVariant
  const designGroupProducts = await Product.aggregate([
    {
      $match: {
        designGroupId: { $in: designGroupIds },
        available: true,
        _id: { $nin: excludeIds }, // Exclude cart products
      },
    },
    {
      $lookup: {
        from: "specificcategoryvariants",
        localField: "specificCategoryVariant",
        foreignField: "_id",
        as: "scvData",
      },
    },
    {
      $lookup: {
        from: "specificcategories",
        localField: "specificCategory",
        foreignField: "_id",
        as: "scData",
      },
    },
    {
      $lookup: {
        from: "inventories",
        localField: "inventoryData",
        foreignField: "_id",
        as: "inventoryData",
      },
    },
    {
      $match: {
        "scvData.available": true,
        "scData.available": true,
      },
    },
    {
      $addFields: {
        scvData: { $arrayElemAt: ["$scvData", 0] },
        scData: { $arrayElemAt: ["$scData", 0] },
        inventoryData: { $arrayElemAt: ["$inventoryData", 0] },
      },
    },
    {
      $sort: {
        specificCategoryVariant: 1,
        price: 1,
        _id: 1, // Stable sort
      },
    },
    {
      $group: {
        _id: { designGroupId: "$designGroupId", specificCategoryVariant: "$specificCategoryVariant" },
        product: { $first: "$$ROOT" }, // Take first (cheapest) product per design group + category
        scvData: { $first: "$scvData" },
        scData: { $first: "$scData" },
      },
    },
    {
      $replaceRoot: { newRoot: "$product" },
    },
    {
      $sort: { price: 1, _id: 1 },
    },
  ]);

  // Enrich the design group products
  const enriched = [];
  for (const product of designGroupProducts) {
    const specCat = product.scData;
    const scvMap = { [product.scvData._id.toString()]: product.scvData };
    const enrichedProducts = await enrichProducts([product], { 
      specCatDoc: specCat, 
      scvMap 
    });
    enriched.push(...enrichedProducts);
  }

  // Filter out products from excluded category
  const filteredEnriched = excludeCategory ? 
    enriched.filter(product => {
      const productCategory = product.category?.name || product.category;
      return productCategory !== excludeCategory;
    }) : enriched;

  return filteredEnriched;
}

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const subCategoriesParam = searchParams.get('subCategories') || '';
  const skip = parseInt(searchParams.get('skip') || '0', 10);
  const singleVariantCode = (searchParams.get('singleVariantCode') || '').trim();
  const singleCategoryCode = (searchParams.get('singleCategoryCode') || '').trim();
  const currentProductId = (searchParams.get('currentProductId') || '').trim();
  const excludeCategory = (searchParams.get('excludeCategory') || '').trim();
  
  // New parameters for cart-based exclusions
  const excludeProductIds = searchParams.get('excludeProductIds') || '';
  const cartDesignIds = searchParams.get('cartDesignIds') || '';
  
  const excludeProductIdsArray = excludeProductIds ? excludeProductIds.split(',').filter(Boolean) : [];
  const cartDesignIdsArray = cartDesignIds ? cartDesignIds.split(',').filter(Boolean) : [];
  
  // Check cache first
  const cacheKey = getCacheKey({ 
    subCategories: subCategoriesParam, 
    singleVariantCode, 
    singleCategoryCode, 
    skip, 
    currentProductId,
    excludeProductIds,
    cartDesignIds,
    excludeCategory
  });
  
  const cached = getCachedData(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  await connectToDatabase();

  /* ─────────────────────────────────────────────────────────────────── */
  /* 1) singleCategoryCode ::::::::::::::::::::::::::::::::::::::::::::: */
  /* ─────────────────────────────────────────────────────────────────── */
  if (singleCategoryCode) {
    const sc = await SpecificCategory.findOne({
      specificCategoryCode: singleCategoryCode,
      available: true,
    }).lean();
    
    if (!sc) {
      const emptyResponse = { products: [], hasMore: false };
      cache.set(cacheKey, { data: emptyResponse, timestamp: Date.now() });
      return NextResponse.json(emptyResponse);
    }

    // Get cart design group products first
    const cartDesignGroupProducts = await fetchCartDesignGroupProducts(cartDesignIdsArray, excludeProductIdsArray, excludeCategory);

    const variants = await SpecificCategoryVariant.find({
      specificCategory: sc._id,
      available: true,
    }).lean();
    
    if (!variants.length) {
      const emptyResponse = { products: [], hasMore: false };
      cache.set(cacheKey, { data: emptyResponse, timestamp: Date.now() });
      return NextResponse.json(emptyResponse);
    }

    const scvMap = Object.fromEntries(variants.map((v) => [v._id.toString(), v]));

    const excludeIds = excludeProductIdsArray.length ? 
      excludeProductIdsArray.map(id => new mongoose.Types.ObjectId(id)) : [];

    const allProducts = await Product.find({
      specificCategoryVariant: { $in: variants.map(v => v._id) },
      available: true,
      ...(excludeIds.length && { _id: { $nin: excludeIds } })
    }).populate("inventoryData").lean();

    const enriched = await enrichProducts(allProducts, { specCatDoc: sc, scvMap });

    // Filter out products from excluded category
    const filteredEnriched = excludeCategory ? 
      enriched.filter(product => {
        const productCategory = product.category?.name || product.category;
        return productCategory !== excludeCategory;
      }) : enriched;

    // Merge cart design group products with category products
    const combined = [...cartDesignGroupProducts, ...filteredEnriched];
    
    // Remove duplicates by product ID
    const uniqueProducts = combined.filter((product, index, self) => 
      index === self.findIndex(p => p._id.toString() === product._id.toString())
    );

    // Sort predictably: cart design group products first, then by totalBought, then by name, then by ID
    uniqueProducts.sort((a, b) => {
      const aIsCartDesignGroup = cartDesignGroupProducts.some(dgp => dgp._id.toString() === a._id.toString());
      const bIsCartDesignGroup = cartDesignGroupProducts.some(dgp => dgp._id.toString() === b._id.toString());
      
      if (aIsCartDesignGroup && !bIsCartDesignGroup) return -1;
      if (!aIsCartDesignGroup && bIsCartDesignGroup) return 1;
      
      return b.totalBought - a.totalBought || 
             a.name.localeCompare(b.name) || 
             a._id.toString().localeCompare(b._id.toString());
    });

    const slice = uniqueProducts.slice(skip, skip + PAGE_SIZE + 1);
    const response = {
      products: slice.length > PAGE_SIZE ? slice.slice(0, PAGE_SIZE) : slice,
      hasMore: slice.length > PAGE_SIZE,
      totalFound: uniqueProducts.length,
      specificCategoryName: sc.name,
    };

    cache.set(cacheKey, { data: response, timestamp: Date.now() });
    return NextResponse.json(response);
  }

  /* ─────────────────────────────────────────────────────────────────── */
  /* 2) singleVariantCode :::::::::::::::::::::::::::::::::::::::::::::: */
  /* ─────────────────────────────────────────────────────────────────── */
  if (singleVariantCode) {
    const scv = await SpecificCategoryVariant.findOne({
      variantCode: singleVariantCode,
      available: true,
    })
      .populate('specificCategory', 'name specificCategoryCode available')
      .lean();
      
    if (!scv || !scv.specificCategory?.available) {
      const emptyResponse = { products: [], hasMore: false };
      cache.set(cacheKey, { data: emptyResponse, timestamp: Date.now() });
      return NextResponse.json(emptyResponse);
    }

    const sc = scv.specificCategory;
    const scvMap = { [scv._id.toString()]: scv };

    // Get cart design group products first
    const cartDesignGroupProducts = await fetchCartDesignGroupProducts(cartDesignIdsArray, excludeProductIdsArray, excludeCategory);

    const excludeIds = excludeProductIdsArray.length ? 
      excludeProductIdsArray.map(id => new mongoose.Types.ObjectId(id)) : [];

    const raw = await Product.find({
      specificCategoryVariant: scv._id,
      available: true,
      ...(excludeIds.length && { _id: { $nin: excludeIds } })
    }).populate("inventoryData").lean();

    const enriched = await enrichProducts(raw, { specCatDoc: sc, scvMap });
    
    // Filter out products from excluded category
    const filteredEnriched = excludeCategory ? 
      enriched.filter(product => {
        const productCategory = product.category?.name || product.category;
        return productCategory !== excludeCategory;
      }) : enriched;
    
    // Merge cart design group products with variant products
    const combined = [...cartDesignGroupProducts, ...filteredEnriched];
    
    // Remove duplicates by product ID
    const uniqueProducts = combined.filter((product, index, self) => 
      index === self.findIndex(p => p._id.toString() === product._id.toString())
    );

    // Sort predictably: cart design group products first, then by totalBought
    uniqueProducts.sort((a, b) => {
      const aIsCartDesignGroup = cartDesignGroupProducts.some(dgp => dgp._id.toString() === a._id.toString());
      const bIsCartDesignGroup = cartDesignGroupProducts.some(dgp => dgp._id.toString() === b._id.toString());
      
      if (aIsCartDesignGroup && !bIsCartDesignGroup) return -1;
      if (!aIsCartDesignGroup && bIsCartDesignGroup) return 1;
      
      return b.totalBought - a.totalBought || 
             a.name.localeCompare(b.name) || 
             a._id.toString().localeCompare(b._id.toString());
    });
    
    const slice = uniqueProducts.slice(skip, skip + PAGE_SIZE + 1);

    const response = {
      products: slice.length > PAGE_SIZE ? slice.slice(0, PAGE_SIZE) : slice,
      hasMore: slice.length > PAGE_SIZE,
      totalFound: uniqueProducts.length,
      specificCategoryName: sc.name,
    };

    cache.set(cacheKey, { data: response, timestamp: Date.now() });
    return NextResponse.json(response);
  }

  /* ─────────────────────────────────────────────────────────────────── */
  /* 3) multi‑subcategory (default) ::::::::::::::::::::::::::::::::::::: */
  /* ─────────────────────────────────────────────────────────────────── */
  let subCategories = subCategoriesParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
    
  if (!subCategories.length && !singleVariantCode && !singleCategoryCode) {
    const errorResponse = { 
      error: 'subCategories required when not using singleVariantCode or singleCategoryCode' 
    };
    return NextResponse.json(errorResponse, { status: 400 });
  }

  // Get cart design group products first
  const cartDesignGroupProducts = await fetchCartDesignGroupProducts(cartDesignIdsArray, excludeProductIdsArray, excludeCategory);

  /* ensure consistent subcategories for predictable results */
  if (subCategories.length < 3) {
    const extras = await SpecificCategory.find({
      available: true,
      subCategory: { $nin: subCategories },
    }).select('subCategory').lean().sort({ subCategory: 1 }); // deterministic sort
    
    subCategories = subCategories.concat(
      extras.slice(0, 3 - subCategories.length).map((e) => e.subCategory),
    );
  }

  /* specific categories + variants */
  const specCats = await SpecificCategory.find({
    subCategory: { $in: subCategories },
    available: true,
  }).lean().sort({ name: 1 }); // deterministic sort
  
  if (!specCats.length) {
    const emptyResponse = { products: [] };
    cache.set(cacheKey, { data: emptyResponse, timestamp: Date.now() });
    return NextResponse.json(emptyResponse);
  }

  const specIds = specCats.map((c) => c._id);
  const scvDocs = await SpecificCategoryVariant.find({
    specificCategory: { $in: specIds },
    available: true,
  }).lean();

  const scvByCat = {};
  scvDocs.forEach((v) => {
    const k = v.specificCategory.toString();
    (scvByCat[k] ||= []).push(v);
  });
  const scvMap = Object.fromEntries(scvDocs.map((v) => [v._id.toString(), v]));

  const excludeIds = excludeProductIdsArray.length ? 
    excludeProductIdsArray.map(id => new mongoose.Types.ObjectId(id)) : [];

  /* build list per specific category */
  const lists = await Promise.all(
    specCats.map(async (sc) => {
      const variants = scvByCat[sc._id.toString()] || [];
      if (!variants.length) return [];

      const varIds = variants.map((v) => v._id);
      const raw = await Product.find({
        specificCategoryVariant: { $in: varIds },
        available: true,
        ...(excludeIds.length && { _id: { $nin: excludeIds } })
      }).populate("inventoryData").lean();

      return enrichProducts(raw, { specCatDoc: sc, scvMap });
    }),
  );

  // Flatten all products from different categories
  const allCategoryProducts = lists.flat();

  // Filter out products from excluded category
  const filteredCategoryProducts = excludeCategory ? 
    allCategoryProducts.filter(product => {
      const productCategory = product.category?.name || product.category;
      return productCategory !== excludeCategory;
    }) : allCategoryProducts;

  // Merge cart design group products with category products
  const combined = [...cartDesignGroupProducts, ...filteredCategoryProducts];
  
  // Remove duplicates by product ID
  const uniqueProducts = combined.filter((product, index, self) => 
    index === self.findIndex(p => p._id.toString() === product._id.toString())
  );

  // Sort predictably: cart design group products first, then by totalBought, then deterministic
  uniqueProducts.sort((a, b) => {
    const aIsCartDesignGroup = cartDesignGroupProducts.some(dgp => dgp._id.toString() === a._id.toString());
    const bIsCartDesignGroup = cartDesignGroupProducts.some(dgp => dgp._id.toString() === b._id.toString());
    
    if (aIsCartDesignGroup && !bIsCartDesignGroup) return -1;
    if (!aIsCartDesignGroup && bIsCartDesignGroup) return 1;
    
    return b.totalBought - a.totalBought || 
           a.name.localeCompare(b.name) || 
           a._id.toString().localeCompare(b._id.toString());
  });

  const slice = uniqueProducts.slice(skip, skip + PAGE_SIZE + 1);
  const response = {
    products: slice.length > PAGE_SIZE ? slice.slice(0, PAGE_SIZE) : slice,
    hasMore: slice.length > PAGE_SIZE,
    totalFound: uniqueProducts.length,
  };

  cache.set(cacheKey, { data: response, timestamp: Date.now() });
  return NextResponse.json(response);
}
