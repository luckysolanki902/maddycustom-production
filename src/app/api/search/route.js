// src/app/api/search/route.js

import { NextResponse } from 'next/server';
import connectToDb from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Option from '@/models/Option';

// Cache search results for 10 minutes
export const revalidate = 600;

export async function GET(req) {
  try {
    await connectToDb();
    const searchParams = req.nextUrl.searchParams;
    const q = searchParams.get('q');
    if (!q || typeof q !== 'string' || !q.trim()) {
      return NextResponse.json({ error: 'Missing query param' }, { status: 400 });
    }


  const trimmedQuery = q.trim();
  // Split query into words for partial matching
  const queryWords = trimmedQuery
    .split(/\s+/)
    .map(w => w.toLowerCase().replace(/[^\w]/g, ''))
    .filter(Boolean)
    .map(w => (w === 'wraps' ? 'wrap' : w));

    // Optimized product search pipeline with Atlas Search fallback
    // Require that all query words are present in at least one of the fields (AND logic)
    const productPipeline = [
      {
        $search: {
          index: 'product_search',
          compound: {
            must: [
              ...queryWords.map(word => ({
                compound: {
                  should: [
                    {
                      text: {
                        query: word,
                        path: ['title', 'mainTags', 'searchKeywords'],
                        fuzzy: { maxEdits: 1, prefixLength: 1 },
                        score: { boost: { value: 1.5 } }
                      }
                    },
                    {
                      wildcard: {
                        query: `*${word}*`,
                        path: ['title', 'mainTags', 'searchKeywords'],
                        score: { boost: { value: 1 } }
                      }
                    }
                  ],
                  minimumShouldMatch: 1
                }
              })),
            ],
            should: [
              // Original full query matches
              {
                text: {
                  query: trimmedQuery,
                  path: ['title'],
                  score: { boost: { value: 3 } },
                  fuzzy: { maxEdits: 1, prefixLength: 1 }
                }
              },
              {
                text: {
                  query: trimmedQuery,
                  path: ['mainTags', 'searchKeywords'],
                  score: { boost: { value: 2 } },
                  fuzzy: { maxEdits: 1 }
                }
              },
              {
                wildcard: {
                  query: `*${trimmedQuery}*`,
                  path: ['title'],
                  score: { boost: { value: 1.5 } }
                }
              }
            ],
            minimumShouldMatch: 1
          }
        }
      },
      { $addFields: { score: { $meta: "searchScore" } } },
      { $match: { 
        score: { $gt: 0.1 },
        available: { $ne: false } // Filter out products with available: false
      }},
      // Lookup specific category variant to check availability
      {
        $lookup: {
          from: 'specificcategoryvariants',
          localField: 'specificCategoryVariant',
          foreignField: '_id',
          as: 'variantData'
        }
      },
      // Lookup specific category to check availability
      {
        $lookup: {
          from: 'specificcategories',
          localField: 'specificCategory',
          foreignField: '_id',
          as: 'categoryData'
        }
      },
      // Filter out products with unavailable categories or variants
      {
        $match: {
          $and: [
            {
              $or: [
                { variantData: { $size: 0 } }, // No variant data
                { 'variantData.available': { $ne: false } } // Variant is available
              ]
            },
            {
              $or: [
                { categoryData: { $size: 0 } }, // No category data
                { 'categoryData.available': { $ne: false } } // Category is available
              ]
            }
          ]
        }
      },
      { $sort: { score: -1 } },
      // Group by title to ensure unique products (since we removed name)
      {
        $group: {
          _id: '$title',
          doc: { $first: '$$ROOT' },
          maxScore: { $max: '$score' }
        }
      },
      { $sort: { maxScore: -1 } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $limit: 5 },
      {
        $project: {
          _id: 1,
          title: 1,
          images: 1,
          price: 1,
          MRP: 1,
          pageSlug: 1,
          mainTags: 1,
          searchKeywords: 1,
          specificCategory: 1,
          specificCategoryVariant: 1,
          hasOptions: { $cond: { if: { $gt: [{ $size: { $ifNull: ['$options', []] } }, 0] }, then: true, else: false } }
        }
      }
    ];

    // Fallback pipeline for when Atlas Search fails or returns no results
    // Require all query words to be present in at least one field (AND logic)
    const fallbackProductPipeline = [
      {
        $match: {
          available: { $ne: false }, // Filter out products with available: false
          $and: [
            ...queryWords.map(word => ({
              $or: [
                { title: { $regex: word, $options: 'i' } },
                { mainTags: { $in: [new RegExp(word, 'i')] } },
                { searchKeywords: { $in: [new RegExp(word, 'i')] } }
              ]
            }))
          ]
        }
      },
      // Lookup specific category variant to check availability
      {
        $lookup: {
          from: 'specificcategoryvariants',
          localField: 'specificCategoryVariant',
          foreignField: '_id',
          as: 'variantData'
        }
      },
      // Lookup specific category to check availability
      {
        $lookup: {
          from: 'specificcategories',
          localField: 'specificCategory',
          foreignField: '_id',
          as: 'categoryData'
        }
      },
      // Filter out products with unavailable categories or variants
      {
        $match: {
          $and: [
            {
              $or: [
                { variantData: { $size: 0 } }, // No variant data
                { 'variantData.available': { $ne: false } } // Variant is available
              ]
            },
            {
              $or: [
                { categoryData: { $size: 0 } }, // No category data
                { 'categoryData.available': { $ne: false } } // Category is available
              ]
            }
          ]
        }
      },
      {
        $group: {
          _id: '$title',
          doc: { $first: '$$ROOT' }
        }
      },
      { $replaceRoot: { newRoot: '$doc' } },
      { $limit: 5 },
      {
        $project: {
          _id: 1,
          title: 1,
          images: 1,
          price: 1,
          MRP: 1,
          pageSlug: 1,
          mainTags: 1,
          searchKeywords: 1,
          specificCategory: 1,
          specificCategoryVariant: 1,
          hasOptions: { $cond: { if: { $gt: [{ $size: { $ifNull: ['$options', []] } }, 0] }, then: true, else: false } }
        }
      }
    ];

    // Optimized category search with fallback - prioritize exact matches
    const categoryPipeline = [
      {
        $search: {
          index: 'category_search',
          compound: {
            should: [
              // Exact phrase match gets highest score
              {
                phrase: {
                  query: trimmedQuery,
                  path: 'name',
                  score: { boost: { value: 5 } }
                }
              },
              // Full query with exact match
              {
                text: {
                  query: trimmedQuery,
                  path: 'name',
                  score: { boost: { value: 4 } }
                }
              },
              // Wildcard for full query
              {
                wildcard: {
                  query: `*${trimmedQuery}*`,
                  path: 'name',
                  score: { boost: { value: 3 } }
                }
              },
              // Only match if ALL query words are present (more restrictive)
              ...queryWords.length > 1 ? [{
                text: {
                  query: queryWords.join(' '),
                  path: 'name',
                  score: { boost: { value: 2.5 } }
                }
              }] : [],
              // Individual word matches only if single word or as fallback
              ...queryWords.map(word => ({
                text: {
                  query: word,
                  path: 'name',
                  score: { boost: { value: queryWords.length === 1 ? 2 : 0.8 } },
                  fuzzy: { maxEdits: 1 }
                }
              }))
            ]
          }
        }
      },
      { $match: { available: true } },
      { $addFields: { score: { $meta: "searchScore" } } },
      // Only return results with significant score
      { $match: { score: { $gt: 1.5 } } },
      { $sort: { score: -1 } },
      { $limit: 1 },
      { $project: { _id: 1, name: 1, pageSlug: 1, subCategory: 1 } }
    ];

    // Fallback category search: prioritize exact matches and multi-word queries
    const fallbackCategoryPipeline = [
      {
        $match: {
          available: true,
          $or: [
            // Exact phrase match (highest priority)
            { name: { $regex: `^${trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
            // Contains full query
            { name: { $regex: trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
            // All words must be present for multi-word queries
            ...(queryWords.length > 1 ? [{
              $and: queryWords.map(word => ({ name: { $regex: word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }))
            }] : []),
            // Individual word matches (only for single words)
            ...(queryWords.length === 1 ? queryWords.map(word => ({ name: { $regex: word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } })) : [])
          ]
        }
      },
      // Simple priority scoring
      {
        $addFields: {
          exactMatch: { $eq: [{ $toLower: "$name" }, trimmedQuery.toLowerCase()] },
          containsFullQuery: { $ne: [{ $indexOfCP: [{ $toLower: "$name" }, trimmedQuery.toLowerCase()] }, -1] }
        }
      },
      {
        $sort: { 
          exactMatch: -1,
          containsFullQuery: -1,
          name: 1
        }
      },
      { $limit: 1 },
      { $project: { _id: 1, name: 1, pageSlug: 1, subCategory: 1 } }
    ];

    // Execute searches with fallbacks
    let productsRaw = [];
    let categoriesFound = [];

    try {
      // Always try both Atlas Search and fallback, then merge results
      const [atlasProducts, atlasCategories, fallbackProducts, fallbackCategories] = await Promise.all([
        Product.aggregate(productPipeline).catch(() => []),
        SpecificCategory.aggregate(categoryPipeline).catch(() => []),
        Product.aggregate(fallbackProductPipeline).catch(() => []),
        SpecificCategory.aggregate(fallbackCategoryPipeline).catch(() => [])
      ]);

      // Merge results, prioritizing Atlas Search but including fallback
      const allProducts = [...(atlasProducts || []), ...(fallbackProducts || [])];
      const allCategories = [...(atlasCategories || []), ...(fallbackCategories || [])];

      // Remove duplicates by _id and take best results
      const uniqueProducts = allProducts.reduce((acc, product) => {
        const existing = acc.find(p => p._id.toString() === product._id.toString());
        if (!existing) {
          acc.push(product);
        }
        return acc;
      }, []).slice(0, 5);

      const uniqueCategories = allCategories.reduce((acc, category) => {
        const existing = acc.find(c => c._id.toString() === category._id.toString());
        if (!existing) {
          acc.push(category);
        }
        return acc;
      }, []).slice(0, 1);

      productsRaw = uniqueProducts;
      categoriesFound = uniqueCategories;

    } catch (error) {
      console.warn('Search failed, using empty results:', error.message);
      productsRaw = [];
      categoriesFound = [];
    }

    // Process category results
    let category = null;
    if (Array.isArray(categoriesFound) && categoriesFound.length > 0) {
      const cat = categoriesFound[0];
      const variant = await SpecificCategoryVariant.findOne({ 
        specificCategory: cat._id, 
        available: true 
      }).lean();
      
      if (variant) {
        category = {
          id: cat._id,
          name: cat.name,
          pageSlug: variant.pageSlug || cat.pageSlug,
          subCategory: cat.subCategory
        };
      }
    }

    // Optimized image handling logic
    const products = await Promise.all(
      (productsRaw || []).map(async (product) => {
        // If product has images, use them
        if (product.images && product.images.length > 0) {
          return product;
        }

        // If product has options (indicated by hasOptions), images must be in options
        if (product.hasOptions) {
          try {
            const option = await Option.findOne(
              { product: product._id },
              { images: 1 },
              { lean: true, limit: 1 }
            );
            
            if (option?.images && option.images.length > 0) {
              product.images = option.images;
            }
          } catch (error) {
            console.warn('Option lookup failed for product:', product._id);
          }
        }

        return product;
      })
    );

    // Determine result type for analytics
    const resultType = products.length > 0 ? 'product' : 
                      category ? 'category' : 'no_results';

    return NextResponse.json({ 
      products, 
      category,
      meta: {
        query: trimmedQuery,
        resultCount: products.length,
        hasCategory: !!category,
        resultType
      }
    });
  } catch (err) {
    console.error('Search API error:', err);
    return NextResponse.json({ 
      error: 'Search temporarily unavailable', 
      products: [], 
      category: null 
    }, { status: 500 });
  }
}
