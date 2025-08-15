/* ---------------------------------------------------------------------- */
/* src/app/api/showcase/products/top-bought/route.js                      */
/* ULTRA-FAST CACHED RECOMMENDATION SYSTEM                                */
/* ---------------------------------------------------------------------- */

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import Order from '@/models/Order';

export const revalidate = 3600; // 1 hour edge cache

// In-memory cache with 10-minute TTL
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const cache = new Map();

/* ─────────────────── CACHE HELPERS ─────────────────── */
const getCacheKey = (type, code = '', subCats = []) => {
  if (type === 'category') return `cat:${code}`;
  if (type === 'variant') return `var:${code}`;
  if (type === 'multi') return `multi:${subCats.sort().join(',')}`;
  return 'default';
};

const getFromCache = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

const setCache = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
  
  // Clean old cache entries (max 100 entries)
  if (cache.size > 100) {
    const oldestKeys = Array.from(cache.keys()).slice(0, cache.size - 100);
    oldestKeys.forEach(k => cache.delete(k));
  }
};

/* ─────────────────── OPTIMIZED DATA FETCHER ─────────────────── */
async function getTopBoughtProducts(type, code = '', subCategories = []) {
  const cacheKey = getCacheKey(type, code, subCategories);
  
  // Try cache first
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  await connectToDatabase();

  let products = [];
  let categoryName = '';

  if (type === 'category') {
    // Single category - optimized query
    const result = await SpecificCategory.aggregate([
      { $match: { specificCategoryCode: code, available: true } },
      {
        $lookup: {
          from: 'specificcategoryvariants',
          localField: '_id',
          foreignField: 'specificCategory',
          as: 'variants',
          pipeline: [{ $match: { available: true } }]
        }
      },
      {
        $lookup: {
          from: 'products',
          let: { variantIds: '$variants._id' },
          pipeline: [
            { $match: { 
              $expr: { $in: ['$specificCategoryVariant', '$$variantIds'] },
              available: true 
            }},
            {
              $lookup: {
                from: 'orders',
                let: { productId: '$_id' },
                pipeline: [
                  { $unwind: '$items' },
                  { $match: { $expr: { $eq: ['$items.product', '$$productId'] } }},
                  { $group: { _id: null, totalBought: { $sum: '$items.quantity' } }}
                ],
                as: 'orderStats'
              }
            },
            {
              $lookup: {
                from: 'options',
                localField: '_id',
                foreignField: 'product',
                as: 'options',
                pipeline: [
                  {
                    $lookup: {
                      from: 'inventories',
                      localField: 'inventoryData',
                      foreignField: '_id',
                      as: 'inventory'
                    }
                  },
                  { $sort: { 'inventory.0.availableQuantity': -1 } }
                ]
              }
            },
            {
              $addFields: {
                totalBought: { $ifNull: [{ $arrayElemAt: ['$orderStats.totalBought', 0] }, 0] },
                category: {
                  specificCategoryCode: code,
                  name: '$name'
                }
              }
            },
            { $sort: { totalBought: -1, name: 1 } },
            { $limit: 50 } // Pre-limit for better performance
          ],
          as: 'products'
        }
      },
      { $project: { name: 1, products: 1 } }
    ]);

    if (result[0]) {
      products = result[0].products;
      categoryName = result[0].name;
    }

  } else if (type === 'variant') {
    // Single variant - optimized query
    const result = await SpecificCategoryVariant.aggregate([
      { $match: { variantCode: code, available: true } },
      {
        $lookup: {
          from: 'specificcategories',
          localField: 'specificCategory',
          foreignField: '_id',
          as: 'category',
          pipeline: [{ $match: { available: true } }]
        }
      },
      { $unwind: '$category' },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'specificCategoryVariant',
          as: 'products',
          pipeline: [
            { $match: { available: true } },
            {
              $lookup: {
                from: 'orders',
                let: { productId: '$_id' },
                pipeline: [
                  { $unwind: '$items' },
                  { $match: { $expr: { $eq: ['$items.product', '$$productId'] } }},
                  { $group: { _id: null, totalBought: { $sum: '$items.quantity' } }}
                ],
                as: 'orderStats'
              }
            },
            {
              $lookup: {
                from: 'options',
                localField: '_id',
                foreignField: 'product',
                as: 'options',
                pipeline: [
                  {
                    $lookup: {
                      from: 'inventories',
                      localField: 'inventoryData',
                      foreignField: '_id',
                      as: 'inventory'
                    }
                  },
                  { $sort: { 'inventory.0.availableQuantity': -1 } }
                ]
              }
            },
            {
              $addFields: {
                totalBought: { $ifNull: [{ $arrayElemAt: ['$orderStats.totalBought', 0] }, 0] }
              }
            },
            { $sort: { totalBought: -1, name: 1 } },
            { $limit: 50 }
          ]
        }
      },
      { $project: { 'category.name': 1, products: 1 } }
    ]);

    if (result[0]) {
      products = result[0].products;
      categoryName = result[0].category.name;
    }

  } else {
    // Multi-subcategory - super optimized
    const result = await SpecificCategory.aggregate([
      { 
        $match: { 
          subCategory: { $in: subCategories.length ? subCategories : ['Car Wraps', 'Car Care'] },
          available: true 
        } 
      },
      {
        $lookup: {
          from: 'specificcategoryvariants',
          localField: '_id',
          foreignField: 'specificCategory',
          as: 'variants',
          pipeline: [{ $match: { available: true } }]
        }
      },
      { $unwind: '$variants' },
      {
        $lookup: {
          from: 'products',
          localField: 'variants._id',
          foreignField: 'specificCategoryVariant',
          as: 'products',
          pipeline: [
            { $match: { available: true } },
            {
              $lookup: {
                from: 'orders',
                let: { productId: '$_id' },
                pipeline: [
                  { $unwind: '$items' },
                  { $match: { $expr: { $eq: ['$items.product', '$$productId'] } }},
                  { $group: { _id: null, totalBought: { $sum: '$items.quantity' } }}
                ],
                as: 'orderStats'
              }
            },
            {
              $lookup: {
                from: 'options',
                localField: '_id',
                foreignField: 'product',
                as: 'options',
                pipeline: [
                  {
                    $lookup: {
                      from: 'inventories',
                      localField: 'inventoryData',
                      foreignField: '_id',
                      as: 'inventory'
                    }
                  },
                  { $sort: { 'inventory.0.availableQuantity': -1 } }
                ]
              }
            },
            {
              $addFields: {
                totalBought: { $ifNull: [{ $arrayElemAt: ['$orderStats.totalBought', 0] }, 0] }
              }
            },
            { $limit: 3 } // Limit per category for variety
          ]
        }
      },
      { $unwind: '$products' },
      { $replaceRoot: { newRoot: '$products' } },
      { $sort: { totalBought: -1, name: 1 } },
      { $limit: 50 }
    ]);

    products = result;
  }

  // Format products for consistent response
  const formattedProducts = products.map(product => ({
    _id: product._id,
    name: product.name,
    price: product.price,
    images: product.images || [],
    pageSlug: product.pageSlug,
    totalBought: product.totalBought || 0,
    category: product.category || { name: categoryName },
    options: (product.options || []).map(option => ({
      _id: option._id,
      images: option.images || [],
      inventoryData: option.inventory?.[0] || { availableQuantity: 0 }
    }))
  }));

  const result = {
    products: formattedProducts,
    hasMore: false, // Pre-computed, no pagination needed
    specificCategoryName: categoryName,
    totalFound: formattedProducts.length
  };

  // Cache the result
  setCache(cacheKey, result);
  
  return result;
}

/* ─────────────────── MAIN HANDLER ─────────────────── */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subCategoriesParam = searchParams.get('subCategories') || '';
    const singleVariantCode = (searchParams.get('singleVariantCode') || '').trim();
    const singleCategoryCode = (searchParams.get('singleCategoryCode') || '').trim();
    const skip = parseInt(searchParams.get('skip') || '0', 10);

    let result;

    if (singleCategoryCode) {
      result = await getTopBoughtProducts('category', singleCategoryCode);
    } else if (singleVariantCode) {
      result = await getTopBoughtProducts('variant', singleVariantCode);
    } else {
      const subCategories = subCategoriesParam
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      result = await getTopBoughtProducts('multi', '', subCategories);
    }

    // Handle pagination on cached results (super fast)
    const PAGE_SIZE = 10;
    const products = result.products.slice(skip, skip + PAGE_SIZE);
    const hasMore = skip + PAGE_SIZE < result.products.length;

    return NextResponse.json({
      ...result,
      products,
      hasMore
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'CDN-Cache-Control': 'public, s-maxage=3600'
      }
    });

  } catch (error) {
    console.error('Top bought products error:', error);
    return NextResponse.json(
      { products: [], hasMore: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
