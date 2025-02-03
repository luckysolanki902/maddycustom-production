// app/api/reviews/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import Review from '@/models/Review';
import { NextResponse } from 'next/server';

export async function GET(request) {
  // Extract query parameters from the request URL
  const { searchParams } = new URL(request.url);
  const fetchReviewSource = searchParams.get('fetchReviewSource');
  const productId = searchParams.get('productId');
  const variantId = searchParams.get('variantId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '5'); // Default to 5 reviews per page

  // Connect to the database
  await connectToDatabase();

  // Build the query
  let query = { status: 'approved' };

  if (fetchReviewSource === 'variant') {
    if (!variantId) {
      return NextResponse.json(
        { message: 'variantId is required for variant review fetching' },
        { status: 400 }
      );
    }
    // Reviews for a specific variant
    query.specificCategoryVariant = variantId;
  } else if (fetchReviewSource === 'product') {
    if (!productId) {
      return NextResponse.json(
        { message: 'productId is required for product review fetching' },
        { status: 400 }
      );
    }
    // Reviews for a specific product
    query.product = productId;
  } else {
    return NextResponse.json(
      { message: 'Invalid fetchReviewSource value' },
      { status: 400 }
    );
  }

  try {
    // Get the total count to calculate pagination values
    const totalCount = await Review.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;

    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return NextResponse.json(
      {
        reviews,
        pagination: { totalCount, totalPages, currentPage: page, limit },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching reviews:', error.message);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
