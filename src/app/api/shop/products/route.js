// app/api/shop/products/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import SpecificCategory from '@/models/SpecificCategory';
import Option from '@/models/Option';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import inventory from '@/models/Inventory';

export const config = {
  api: {
    bodyParser: false,
  },
};

export const revalidate = 600; // seconds

export async function POST(request) {
  try {
    const { slug, page = 1, limit = 15, tagFilter = null, sortBy = 'default' } = await request.json();
    const fullSlug = Array.isArray(slug) ? `/${slug.join('/')}` : `/${slug}`;

    if (!fullSlug) {
      return NextResponse.json({ message: 'Slug is required.' }, { status: 400 });
    }

    await connectToDatabase();

    // 1) Try to find a Product by pageSlug
    const product = await Product.findOne({ pageSlug: fullSlug })
      .populate('inventoryData')
      .lean()
      .exec();

    if (product) {
      // Found a product. Fetch the associated variant.
      const variant = await SpecificCategoryVariant.findById(product.specificCategoryVariant)
        .lean()
        .exec();
      if (!variant) {
        return NextResponse.json({ message: 'Variant Not Found' }, { status: 404 });
      }

      // Fetch the associated specific category
      const specificCategory = await SpecificCategory.findById(variant.specificCategory)
        .lean()
        .exec();
      if (!specificCategory) {
        return NextResponse.json({ message: 'Specific Category Not Found' }, { status: 404 });
      }

      // Fetch all options for the product and sort them by inventoryData.availableQuantity (highest first)
      const options = await Option.find({ product: product._id })
        .populate('inventoryData')
        .lean()
        .exec();
      
      options && options.sort((a, b) => (b.inventoryData?.availableQuantity || 0) - (a.inventoryData?.availableQuantity || 0));
      product.options = options;

      return NextResponse.json(
        { type: 'product', product, variant, specificCategory },
        { status: 200 }
      );
    }

    // 2) If no product found, try to find a variant by pageSlug
    const variant = await SpecificCategoryVariant.findOne({ pageSlug: fullSlug })
      .lean()
      .exec();

    if (variant) {
      // Get the specificCategory
      const specificCategory = await SpecificCategory.findById(variant.specificCategory)
        .lean()
        .exec();
      if (!specificCategory) {
        return NextResponse.json({ message: 'Specific Category Not Found' }, { status: 404 });
      }

      // Build aggregation pipeline for products under this variant
      const pipeline = [
        { $match: { specificCategoryVariant: variant._id, available: true } },
        {
          $lookup: {
            from: "inventories",
            localField: "inventoryData",
            foreignField: "_id",
            as: "inventoryData",
          },
        },
        { $unwind: { path: "$inventoryData", preserveNullAndEmptyArrays: true } },
      ];

      // Add tag filtering if needed
      if (tagFilter) {
        pipeline.push({
          $addFields: {
            isTagMatched: {
              $in: [
                tagFilter.toLowerCase(),
                {
                  $map: {
                    input: "$mainTags",
                    as: "tag",
                    in: { $toLower: "$$tag" },
                  },
                },
              ],
            },
          },
        });
      } else {
        pipeline.push({ $addFields: { isTagMatched: false } });
      }

      // Sort
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
        sortStage._id = 1;
      }

      pipeline.push({
        $sort: {
          isTagMatched: -1,
          ...sortStage,
        },
      });

      // Count total matching
      const countPipeline = [...pipeline, { $count: "totalItems" }];
      const countResult = await Product.aggregate(countPipeline).exec();
      const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
      const totalPages = Math.ceil(totalItems / limit);
      const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1;

      if (totalItems > 0) {
        pipeline.push({ $skip: (currentPage - 1) * limit }, { $limit: limit });
      }

      // Lookup options for each product and sort them by inventoryData.availableQuantity (highest first)
      pipeline.push({
        $lookup: {
          from: "options",
          let: { productId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$product", "$$productId"] } } },
            {
              $lookup: {
                from: "inventories",
                localField: "inventoryData",
                foreignField: "_id",
                as: "inventoryData",
              },
            },
            { $unwind: { path: "$inventoryData", preserveNullAndEmptyArrays: true } },
            { $sort: { "inventoryData.availableQuantity": -1 } }
          ],
          as: "options",
        },
      });

      pipeline.push({
        $project: {
          isTagMatched: 0,
          __v: 0,
        },
      });

      const products = await Product.aggregate(pipeline).exec();

      // unique tags
      const uniqueTagsPipeline = [
        { $match: { specificCategoryVariant: variant._id, available: true } },
        { $unwind: "$mainTags" },
        { $group: { _id: null, uniqueTags: { $addToSet: { $toLower: "$mainTags" } } } },
        { $project: { _id: 0, uniqueTags: 1 } },
      ];
      const uniqueTagsResult = await Product.aggregate(uniqueTagsPipeline).exec();
      const uniqueTags = uniqueTagsResult.length > 0 ? uniqueTagsResult[0].uniqueTags : [];

      return NextResponse.json(
        {
          type: 'variant',
          variant,
          products,
          specificCategory,
          totalItems,
          totalPages,
          currentPage,
          uniqueTags,
        },
        { status: 200 }
      );
    }

    // 3) Not found
    return NextResponse.json({ message: 'Not Found' }, { status: 404 });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}