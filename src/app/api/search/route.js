// src/app/api/search/route.js

import { NextResponse } from 'next/server';
import connectToDb from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Option from '@/models/Option';

export async function GET(req) {
  try {
    await connectToDb();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    if (!q || typeof q !== 'string' || !q.trim()) {
      return NextResponse.json({ error: 'Missing query param' }, { status: 400 });
    }

    const productPipeline = [
      {
        $search: {
          index: 'product_search',
          compound: {
            should: [
              {
                text: {
                  query: q,
                  path: 'title',
                  score: { boost: { value: 3 } },
                  fuzzy: { maxEdits: 2, prefixLength: 2 }
                }
              },
              {
                text: {
                  query: q,
                  path: 'mainTags',
                  score: { boost: { value: 1 } },
                  fuzzy: { maxEdits: 2, prefixLength: 2 }
                }
              }
            ]
          }
        }
      },
      // ensure unique product names
      {
        $group: {
          _id: '$name',
          doc: { $first: '$$ROOT' }
        }
      },
      { $replaceRoot: { newRoot: '$doc' } },
      { $limit: 5 },
      {
        $project: {
          _id: 1,
          name: 1,
          title: 1,
          images: 1,
          price: 1,
          MRP: 1,
          pageSlug: 1,
          mainTags: 1
        }
      }
    ];

    // Category search pipeline (Atlas Search on SpecificCategory.name)
    const categoryPipeline = [
      {
        $search: {
          index: 'category_search',
          text: {
            query: q,
            path: 'name',
            fuzzy: { maxEdits: 2, prefixLength: 2 }
          }
        }
      },
      { $match: { available: true } },
      { $limit: 1 },
      { $project: { _id: 1, name: 1, pageSlug: 1, subCategory: 1 } }
    ];

    // Run product and category searches in parallel
    const [productsRaw, categoriesFound] = await Promise.all([
      Product.aggregate(productPipeline),
      SpecificCategory.aggregate(categoryPipeline)
    ]);

    // If category found, ensure it has at least one available variant and attach that variant's pageSlug
    let category = null;
    if (Array.isArray(categoriesFound) && categoriesFound.length > 0) {
      const cat = categoriesFound[0];
      const variant = await SpecificCategoryVariant.findOne({ specificCategory: cat._id, available: true }).lean();
      if (variant) {
        category = {
          id: cat._id,
          name: cat.name,
          pageSlug: variant.pageSlug || cat.pageSlug,
          subCategory: cat.subCategory
        };
      }
    }

    // Ensure products have images, fall back to first Option images if needed (similar to by-design-group route)
    const products = await Promise.all(
      (productsRaw || []).map(async (p) => {
        const prod = { ...p };
        if ((!prod.images || prod.images.length === 0)) {
          try {
            const opt = await Option.findOne({ product: prod._id }).lean();
            if (opt?.images && opt.images.length > 0) {
              prod.images = opt.images;
            }
          } catch (e) {
            // ignore option lookup errors
          }
        }
        return prod;
      })
    );

    return NextResponse.json({ products, category });
  } catch (err) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
