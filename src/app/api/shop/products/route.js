// pages/api/shop/products/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import SpecificCategory from '@/models/SpecificCategory';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    console.info("Received request to /api/shop/products with POST method");

    const { slug, page = 1, limit = 15, tagFilter = null, sortBy = 'default' } = await request.json();
    const fullSlug = Array.isArray(slug) ? `/${slug.join('/')}` : `/${slug}`;

    if (!fullSlug) {
      console.error("Request missing 'slug' parameter");
      return NextResponse.json({ message: 'Slug is required.' }, { status: 400 });
    }

    await connectToDatabase();
    console.info("Connected to the database successfully");

    // Attempt to find Product by pageSlug first
    const product = await Product.findOne({ pageSlug: fullSlug }).lean().exec();

    if (product) {      
      // Fetch the associated SpecificCategoryVariant if it exists
      const variant = await SpecificCategoryVariant.findById(product.specificCategoryVariant).lean().exec();

      if (!variant) {
        console.warn(`No SpecificCategoryVariant found for product: ${product.name}`);
        return NextResponse.json({ message: 'Variant Not Found' }, { status: 404 });
      }

      // Fetch the associated SpecificCategory
      const specificCategory = await SpecificCategory.findById(variant.specificCategory).lean().exec();

      if (!specificCategory) {
        console.warn(`No SpecificCategory found for variant: ${variant.name}`);
        return NextResponse.json({ message: 'Specific Category Not Found' }, { status: 404 });
      }

      // **For 'product' type, return only the single product data without pagination, sorting, or tag filtering**
      return NextResponse.json(
        { type: 'product', product, variant, specificCategory },
        { status: 200 }
      );
    }

    // If no product found, check for SpecificCategoryVariant by pageSlug
    const variant = await SpecificCategoryVariant.findOne({ pageSlug: fullSlug }).lean().exec();

    if (variant) {
      console.info(`Found SpecificCategoryVariant: ${variant.name}`);

      // Fetch the associated SpecificCategory
      const specificCategory = await SpecificCategory.findById(variant.specificCategory).lean().exec();

      if (!specificCategory) {
        console.warn(`No SpecificCategory found for variant: ${variant.name}`);
        return NextResponse.json({ message: 'Specific Category Not Found' }, { status: 404 });
      }

      // **For 'variant' type, apply tag prioritization and sorting**
      const pipeline = [
        { $match: { specificCategoryVariant: variant._id } },
      ];

      if (tagFilter) {
        pipeline.push({
          $addFields: {
            isTagMatched: { $in: [tagFilter.toLowerCase(), "$mainTags"] },
          }
        });
      } else {
        pipeline.push({
          $addFields: {
            isTagMatched: false,
          }
        });
      }

      // Define the sorting stage based on sortBy
      const sortStage = {};
      if (sortBy === 'priceLowToHigh') {
        sortStage.price = 1;
      } else if (sortBy === 'priceHighToLow') {
        sortStage.price = -1;
      } else if (sortBy === 'latestFirst') {
        sortStage.createdAt = -1;
      } else if (sortBy === 'oldestFirst') {
        sortStage.createdAt = 1;
      } else {
        sortStage.displayOrder = 1;
      }

      // First sort by isTagMatched, then by the selected sort option
      pipeline.push({
        $sort: {
          isTagMatched: -1, // Tag matched first
          ...sortStage,
        }
      });

      // Count total items
      const countPipeline = [...pipeline, { $count: "totalItems" }];
      const countResult = await Product.aggregate(countPipeline).exec();
      const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
      const totalPages = Math.ceil(totalItems / limit);
      const currentPage = Math.min(page, totalPages);

      // Apply pagination
      pipeline.push(
        { $skip: (currentPage - 1) * limit },
        { $limit: limit }
      );

      // Exclude temporary fields
      pipeline.push({
        $project: {
          isTagMatched: 0, // Exclude the temporary field
          __v: 0,
        }
      });

      const products = await Product.aggregate(pipeline).exec();

      return NextResponse.json(
        { type: 'variant', variant, products, specificCategory, totalItems, totalPages, currentPage },
        { status: 200 }
      );
    }

    // Neither variant nor product found, return 404
    console.warn(`No SpecificCategoryVariant or Product found for slug: ${fullSlug}`);
    return NextResponse.json({ message: 'Not Found' }, { status: 404 });

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
