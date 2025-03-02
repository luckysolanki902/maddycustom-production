// import connectToDatabase from '@/lib/middleware/connectToDb';
// import Product from '@/models/Product';
// import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
// import SpecificCategory from '@/models/SpecificCategory';
// import Option from '@/models/Option';
// import { NextResponse } from 'next/server';
// import Inventory from '@/models/Inventory';


// export async function POST(request) {
//   try {
//     const { slug, page = 1, limit = 15, tagFilter = null, sortBy = 'default' } = await request.json();
//     const fullSlug = Array.isArray(slug) ? `/${slug.join('/')}` : `/${slug}`;

//     if (!fullSlug) {
//       console.error("Request missing 'slug' parameter");
//       return NextResponse.json({ message: 'Slug is required.' }, { status: 400 });
//     }

//     await connectToDatabase();
//     // Attempt to find Product by pageSlug first
//     const product = await Product.findOne({ pageSlug: fullSlug }).lean().exec();

//     console.log(product)

//     if (product) {      
//       // Fetch the associated SpecificCategoryVariant if it exists
//       const variant = await SpecificCategoryVariant.findById(product.specificCategoryVariant).lean().exec();

//       if (!variant) {
//         return NextResponse.json({ message: 'Variant Not Found' }, { status: 404 });
//       }

//       // Fetch the associated SpecificCategory
//       const specificCategory = await SpecificCategory.findById(variant.specificCategory).lean().exec();

//       if (!specificCategory) {
//         return NextResponse.json({ message: 'Specific Category Not Found' }, { status: 404 });
//       }

//       // Fetch all available options for the product, including inventory available stock
//       const options = await Option.find({ product: product._id })
//         .populate('inventoryData')
//         .lean()
//         .exec();

//       // Return the product data along with its options
//       return NextResponse.json(
//         { type: 'product', product, variant, specificCategory, options },
//         { status: 200 }
//       );
//     }

//     // If no product found, check for SpecificCategoryVariant by pageSlug
//     const variant = await SpecificCategoryVariant.findOne({ pageSlug: fullSlug }).lean().exec();

//     if (variant) {
//       // Fetch the associated SpecificCategory
//       const specificCategory = await SpecificCategory.findById(variant.specificCategory).lean().exec();

//       if (!specificCategory) {
//         return NextResponse.json({ message: 'Specific Category Not Found' }, { status: 404 });
//       }

//       // **For 'variant' type, apply tag prioritization and sorting**
//       const pipeline = [
//         { $match: { specificCategoryVariant: variant._id, available: true } },
//       ];

//       if (tagFilter) {
//         pipeline.push({
//           $addFields: {
//             isTagMatched: { 
//               $in: [
//                 tagFilter.toLowerCase(), 
//                 { 
//                   $map: { 
//                     input: "$mainTags", 
//                     as: "tag", 
//                     in: { $toLower: "$$tag" } 
//                   } 
//                 } 
//               ],
//             },
//           }
//         });
//       } else {
//         pipeline.push({
//           $addFields: {
//             isTagMatched: false,
//           }
//         });
//       }

//       const sortStage = {};
//       if (sortBy === 'priceLowToHigh') {
//         sortStage.price = 1;
//       } else if (sortBy === 'priceHighToLow') {
//         sortStage.price = -1;
//       } else if (sortBy === 'latestFirst') {
//         sortStage.createdAt = -1;
//       } else if (sortBy === 'oldestFirst') {
//         sortStage.createdAt = 1;
//       } else {
//         sortStage.displayOrder = 1;
//       }

//       pipeline.push({
//         $sort: {
//           isTagMatched: -1,
//           ...sortStage,
//         }
//       });

//       const countPipeline = [...pipeline, { $count: "totalItems" }];
//       const countResult = await Product.aggregate(countPipeline).exec();
//       const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
//       const totalPages = Math.ceil(totalItems / limit);
//       const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1;

//       if (totalItems > 0) {
//         pipeline.push(
//           { $skip: (currentPage - 1) * limit },
//           { $limit: limit }
//         );
//       }

//       pipeline.push({
//         $project: {
//           isTagMatched: 0,
//           __v: 0,
//         }
//       });

//       const products = await Product.aggregate(pipeline).exec();

//       console.log("prodcust ",products)
//       const uniqueTagsPipeline = [
//         { $match: { specificCategoryVariant: variant._id, available: true } },
//         { $unwind: "$mainTags" },
//         { $group: { _id: null, uniqueTags: { $addToSet: { $toLower: "$mainTags" } } } },
//         { $project: { _id: 0, uniqueTags: 1 } }
//       ];

//       const uniqueTagsResult = await Product.aggregate(uniqueTagsPipeline).exec();
//       const uniqueTags = uniqueTagsResult.length > 0 ? uniqueTagsResult[0].uniqueTags : [];

//       return NextResponse.json(
//         { 
//           type: 'variant', 
//           variant, 
//           products, 
//           specificCategory, 
//           totalItems, 
//           totalPages, 
//           currentPage,
//           uniqueTags,
//         },
//         { status: 200 }
//       );
//     }

//     // Neither variant nor product found, return 404
//     return NextResponse.json({ message: 'Not Found' }, { status: 404 });

//   } catch (error) {
//     console.error('Error processing request:', error);
//     return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
//   }
// }

import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import SpecificCategory from '@/models/SpecificCategory';
import Option from '@/models/Option';
import Inventory from '@/models/Inventory';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { statusMapping } from '@/lib/constants/shiprocketStatusMapping';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request) {
  try {
    const { slug, page = 1, limit = 15, tagFilter = null, sortBy = 'default' } = await request.json();
    const fullSlug = Array.isArray(slug) ? `/${slug.join('/')}` : `/${slug}`;

    if (!fullSlug) {
      console.error("Request missing 'slug' parameter");
      return NextResponse.json({ message: 'Slug is required.' }, { status: 400 });
    }

    await connectToDatabase();

    // First, try to find a Product by pageSlug and populate its inventoryData.
    const product = await Product.findOne({ pageSlug: fullSlug })
      .populate('inventoryData')
      .lean()
      .exec();

    if (product) {
      // Fetch the associated SpecificCategoryVariant
      const variant = await SpecificCategoryVariant.findById(product.specificCategoryVariant)
        .lean()
        .exec();

      if (!variant) {
        return NextResponse.json({ message: 'Variant Not Found' }, { status: 404 });
      }

      // Fetch the associated SpecificCategory
      const specificCategory = await SpecificCategory.findById(variant.specificCategory)
        .lean()
        .exec();

      if (!specificCategory) {
        return NextResponse.json({ message: 'Specific Category Not Found' }, { status: 404 });
      }

      // Fetch all options for the product, populating their inventoryData.
      const options = await Option.find({ product: product._id })
        .populate('inventoryData')
        .lean()
        .exec();
      product.options = options;

      return NextResponse.json(
        { type: 'product', product, variant, specificCategory },
        { status: 200 }
      );
    }

    // If no product found, try to find a SpecificCategoryVariant by pageSlug.
    const variant = await SpecificCategoryVariant.findOne({ pageSlug: fullSlug })
      .lean()
      .exec();
    if (variant) {
      const specificCategory = await SpecificCategory.findById(variant.specificCategory)
        .lean()
        .exec();
      if (!specificCategory) {
        return NextResponse.json({ message: 'Specific Category Not Found' }, { status: 404 });
      }

      // Build an aggregation pipeline to fetch products under this variant.
      const pipeline = [
        { $match: { specificCategoryVariant: variant._id, available: true } },
      ];

      // Lookup the product's own inventoryData
      pipeline.push({
        $lookup: {
          from: "inventories",
          localField: "inventoryData",
          foreignField: "_id",
          as: "inventoryData",
        },
      });
      pipeline.push({ $unwind: { path: "$inventoryData", preserveNullAndEmptyArrays: true } });

      // Add tag filtering if provided.
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

      // Build a sort stage.
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

      pipeline.push({
        $sort: {
          isTagMatched: -1,
          ...sortStage,
        },
      });

      // Count total matching products.
      const countPipeline = [...pipeline, { $count: "totalItems" }];
      const countResult = await Product.aggregate(countPipeline).exec();
      const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
      const totalPages = Math.ceil(totalItems / limit);
      const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1;
      if (totalItems > 0) {
        pipeline.push({ $skip: (currentPage - 1) * limit }, { $limit: limit });
      }

      // Lookup options for each product, populating their inventoryData.
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

    // Neither product nor variant found, return 404.
    return NextResponse.json({ message: 'Not Found' }, { status: 404 });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
