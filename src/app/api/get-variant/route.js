// /app/api/get-variant/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import { NextResponse } from 'next/server';

export async function GET(request) {
  // Extract the variantId from query parameters
  const { searchParams } = new URL(request.url);
  const variantId = searchParams.get('variantId');

  if (!variantId) {
    return NextResponse.json(
      { error: 'variantId parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Connect to the database
    await connectToDatabase();

    // Find the variant by its ID and include the tempReviewCount field
    const variant = await SpecificCategoryVariant.findById(variantId)
      .select('tempReviewCount') // you can add other fields as needed
      .exec();

    if (!variant) {
      return NextResponse.json(
        { error: 'Variant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(variant, { status: 200 });
  } catch (error) {
    console.error('Error fetching variant details:', error);
    return NextResponse.json(
      { error: 'Server error while fetching variant details' },
      { status: 500 }
    );
  }
}
