import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import Option from '@/models/Option';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import PackagingBox from '@/models/PackagingBox';
import Brand from '@/models/marketplace/Brand';
import Inventory from '@/models/Inventory';
import {
  buildProductPayload,
  isValidObjectId,
  isValidNumericId,
  normalizePagination,
} from '@/lib/shiprocket/catalog/helpers';

// Cache Shiprocket products for 10 hours
export const revalidate = 36000;

const buildBaseMatchStage = async (collectionIdParam) => {
  const match = { available: true };
  
  if (collectionIdParam) {
    // Check if it's a numeric ID (Shiprocket format)
    if (isValidNumericId(collectionIdParam)) {
      // Find the variant with this uniqueNumericId
      const variant = await SpecificCategoryVariant.findOne({ 
        uniqueNumericId: Number(collectionIdParam) 
      }).select('_id').lean();
      
      if (variant) {
        match.specificCategoryVariant = variant._id;
      } else {
        // Return null to signal no match found
        return null;
      }
    } else if (isValidObjectId(collectionIdParam)) {
      // It's a MongoDB ObjectId
      match.specificCategoryVariant = new mongoose.Types.ObjectId(collectionIdParam);
    } else {
      // Invalid format
      return null;
    }
  }
  
  return match;
};

const buildAggregationPipeline = ({ matchStage, skip, limit }) => [
  { $match: matchStage },
  {
    $lookup: {
      from: 'specificcategoryvariants',
      localField: 'specificCategoryVariant',
      foreignField: '_id',
      as: 'variant',
    },
  },
  { $unwind: '$variant' },
  { $match: { 'variant.available': true } },
  {
    $lookup: {
      from: 'specificcategories',
      localField: 'specificCategory',
      foreignField: '_id',
      as: 'specCategory',
    },
  },
  { $unwind: { path: '$specCategory', preserveNullAndEmptyArrays: true } },
  { $match: { $or: [{ 'specCategory.available': true }, { specCategory: { $exists: false } }] } },
  { $sort: { updatedAt: -1 } },
  {
    $facet: {
      totalDocs: [{ $count: 'count' }],
      ids: [{ $skip: skip }, { $limit: limit }, { $project: { _id: 1 } }],
    },
  },
];

const sortAccordingToIds = (entities, ids) => {
  const map = new Map();
  entities.forEach((entity) => {
    const key = entity?._id?.toString?.();
    if (key) map.set(key, entity);
  });
  return ids
    .map((id) => map.get(id.toString()))
    .filter(Boolean);
};

export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = normalizePagination(searchParams);

    const collectionIdParam = searchParams.get('collection_id') ?? searchParams.get('collectionId') ?? null;
    
    const matchStage = await buildBaseMatchStage(collectionIdParam);
    
    // If matchStage is null, it means invalid collection_id was provided
    if (matchStage === null && collectionIdParam) {
      return NextResponse.json(
        { error: 'Invalid collection_id. Must be a valid MongoDB ObjectId or numeric ID.' },
        { status: 400 },
      );
    }

    const pipeline = buildAggregationPipeline({ matchStage, skip, limit });
    const aggregationResult = await Product.aggregate(pipeline);
    const firstEntry = aggregationResult?.[0] ?? {};
    const total = firstEntry.totalDocs?.[0]?.count ?? 0;
    const idList = firstEntry.ids?.map((doc) => doc._id) ?? [];

    if (idList.length === 0) {
      return NextResponse.json({ data: { total: 0, products: [] } });
    }

    const products = await Product.find({ _id: { $in: idList } })
      .populate('specificCategory')
      .populate({
        path: 'specificCategoryVariant',
        populate: {
          path: 'packagingDetails.boxId',
          model: 'PackagingBox',
        },
      })
      .populate('brand')
      .populate('inventoryData')
      .lean();

    const orderedProducts = sortAccordingToIds(products, idList);

    const productIds = orderedProducts.map(p => p._id);
    const allOptions = await Option.find({ product: { $in: productIds } })
      .populate('inventoryData')
      .lean();
    
    const optionsByProduct = {};
    allOptions.forEach(option => {
      const productId = option.product.toString();
      if (!optionsByProduct[productId]) {
        optionsByProduct[productId] = [];
      }
      optionsByProduct[productId].push(option);
    });

    const catalogProducts = [];
    for (const product of orderedProducts) {
      const productIdStr = product._id.toString();
      const options = optionsByProduct[productIdStr] || [];
      const variant = product.specificCategoryVariant;
      const packagingBox = variant?.packagingDetails?.boxId || null;
      
      const shaped = buildProductPayload({ 
        product, 
        options, 
        variant, 
        packagingBox 
      });
      
      if (shaped) {
        catalogProducts.push(shaped);
      }
    }

    return NextResponse.json({
      data: {
        total: catalogProducts.length > 0 ? total : 0,
        products: catalogProducts,
      },
    });
  } catch (error) {
    console.error('Error generating Shiprocket catalog product list:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
