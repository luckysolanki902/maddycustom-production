// app/api/reviews/photos/route.js
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Review from '@/models/Review';
import User from '@/models/User';

// ISR: Cache review photos for 30 minutes
export const revalidate = 1800;

export async function GET(req) {
  try {
    await connectToDatabase();

  const searchParams = req.nextUrl.searchParams;
    const fetchReviewSource = searchParams.get('fetchReviewSource'); // 'variant', 'product', or 'specCat'
    const productId = searchParams.get('productId');
    const variantId = searchParams.get('variantId');
    const categoryId = searchParams.get('categoryId'); // new for specCat
    const userPhoneNumber = searchParams.get('userPhoneNumber');
    const pageParam = searchParams.get('page') || '1';
    const limitParam = searchParams.get('limit') || '5';

    const page = parseInt(pageParam, 10) || 1;
    const limit = parseInt(limitParam, 10) || 5;

    // Allow three fetchReviewSource values
    if (!['variant', 'product', 'specCat'].includes(fetchReviewSource)) {
      return NextResponse.json(
        { message: 'Invalid fetchReviewSource value' },
        { status: 400 }
      );
    }

    // Base query: reviews must have images and be approved
    let baseQuery = {
      images: { $exists: true, $ne: [] },
      status: 'approved',
    };

    if (fetchReviewSource === 'variant') {
      if (!variantId) {
        return NextResponse.json(
          { message: 'variantId is required for variant review fetching' },
          { status: 400 }
        );
      }
      baseQuery.specificCategoryVariant = new mongoose.Types.ObjectId(variantId);
    } else if (fetchReviewSource === 'specCat') {
      if (!categoryId) {
        return NextResponse.json(
          { message: 'categoryId is required for specCat review fetching' },
          { status: 400 }
        );
      }
      baseQuery.specificCategory = new mongoose.Types.ObjectId(categoryId);
    } else {
      // fetchReviewSource === 'product'
      if (!productId) {
        return NextResponse.json(
          { message: 'productId is required for product review fetching' },
          { status: 400 }
        );
      }
      baseQuery.product = new mongoose.Types.ObjectId(productId);
    }

    // Optionally pin user's review if they have images (regardless of approval status)
    let userReviewDoc = null;
    if (userPhoneNumber) {
      const user = await User.findOne({ phoneNumber: userPhoneNumber });
      if (user) {
        userReviewDoc = await Review.findOne({
          user: user._id,
          images: { $exists: true, $ne: [] },
          ...(fetchReviewSource === 'variant'
            ? { specificCategoryVariant: baseQuery.specificCategoryVariant }
            : fetchReviewSource === 'specCat'
            ? { specificCategory: baseQuery.specificCategory }
            : { product: baseQuery.product }),
        }).lean();
      }
    }

    // Fetch all approved photos
    const approvedPhotos = await Review.find(baseQuery).sort({ createdAt: -1 }).lean();

    // Combine the approved photos with the user's review (if any)
    let combined = [...approvedPhotos];
    if (userReviewDoc) {
      const found = combined.find(
        (r) => r._id.toString() === userReviewDoc._id.toString()
      );
      if (!found) {
        if (page === 1) {
          combined.unshift(userReviewDoc);
        } else {
          combined.push(userReviewDoc);
        }
      }
    }

    // Paginate the combined results in memory
    const totalCount = combined.length;
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;
    const paginatedDocs = combined.slice(skip, skip + limit);
    const hasMore = skip + paginatedDocs.length < totalCount;

    return NextResponse.json(
      {
        reviews: paginatedDocs,
        totalCount,
        page,
        limit,
        totalPages,
        hasMore,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/reviews/photos:', error);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
