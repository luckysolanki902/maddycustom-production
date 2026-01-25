import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';

export const revalidate = 300; // Cache for 5 minutes

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const variantId = searchParams.get('variantId');
    const limit = parseInt(searchParams.get('limit')) || 10;
    const skip = parseInt(searchParams.get('skip')) || 0;

    if (!variantId) {
      return NextResponse.json(
        { error: 'Variant ID is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Fetch products that belong to this variant
    const products = await Product.find({
      specificCategoryVariant: variantId,
      available: true,
    })
      .select('name price MRP images pageSlug inventoryData options')
      .skip(skip)
      .limit(limit)
      .lean();

    // Check if there are more products
    const totalCount = await Product.countDocuments({
      specificCategoryVariant: variantId,
      available: true,
    });
    const hasMore = skip + products.length < totalCount;

    return NextResponse.json({
      success: true,
      products,
      count: products.length,
      totalCount,
      hasMore,
    });

  } catch (error) {
    console.error('Error fetching products by variant:', error);
    return NextResponse.json(
      { error: 'Internal server error', products: [] },
      { status: 500 }
    );
  }
}
