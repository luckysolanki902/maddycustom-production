import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import {
  buildCollectionPayload,
  normalizePagination,
  ensureAbsoluteImageUrl,
} from '@/lib/shiprocket/catalog/helpers';

// Cache Shiprocket catalog for 10 hours
export const revalidate = 36000;

export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = normalizePagination(searchParams);

    const total = await SpecificCategoryVariant.countDocuments({ available: true });

    const variants = await SpecificCategoryVariant.find({ available: true })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get first available product image for each variant
    const variantIds = variants.map(v => v._id);
    const products = await Product.find({
      specificCategoryVariant: { $in: variantIds },
      available: true,
      images: { $exists: true, $ne: [] }
    })
      .select('specificCategoryVariant images')
      .lean();

    // Map variant ID to first product's first image
    const variantImageMap = {};
    products.forEach(product => {
      const variantId = product.specificCategoryVariant.toString();
      if (!variantImageMap[variantId] && product.images && product.images[0]) {
        variantImageMap[variantId] = product.images[0];
      }
    });

    const collections = variants
      .map((variant) => {
        const payload = buildCollectionPayload(variant);
        if (payload) {
          // Override image with first available product image if exists
          const variantIdStr = variant._id.toString();
          if (variantImageMap[variantIdStr]) {
            payload.image.src = ensureAbsoluteImageUrl(variantImageMap[variantIdStr]);
          }
        }
        return payload;
      })
      .filter(Boolean);

    return NextResponse.json({
      data: {
        total,
        collections,
      },
    });
  } catch (error) {
    console.error('Error generating Shiprocket catalog collection list:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

