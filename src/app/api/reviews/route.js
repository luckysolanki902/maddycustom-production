// /app/api/reviews/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import Review from '@/models/Review';
import { NextResponse } from 'next/server';
import User from '@/models/User';
import mongoose from 'mongoose';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';

const includeDummyReviewCount = true; // Toggle this to enable/disable dummy reviews

export async function GET(request) {
  try {
    await connectToDatabase();

    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const fetchReviewSource = searchParams.get('fetchReviewSource'); // 'variant' or 'product'
    const productId = searchParams.get('productId');
    const variantId = searchParams.get('variantId');
    const userPhoneNumber = searchParams.get('userPhoneNumber');
    const pageParam = searchParams.get('page') || '1';
    const limitParam = searchParams.get('limit') || '5';

    const page = parseInt(pageParam, 10) || 1;
    const limit = parseInt(limitParam, 10) || 5;

    // Validate fetchReviewSource
    if (!['variant', 'product'].includes(fetchReviewSource)) {
      return NextResponse.json(
        { message: 'Invalid fetchReviewSource value' },
        { status: 400 }
      );
    }

    // Base "approved" query
    const baseQuery = {};
    if (fetchReviewSource === 'variant') {
      if (!variantId) {
        return NextResponse.json(
          { message: 'variantId is required for variant review fetching' },
          { status: 400 }
        );
      }
      baseQuery.specificCategoryVariant = new mongoose.Types.ObjectId(variantId);
    } else {
      // 'product'
      if (!productId) {
        return NextResponse.json(
          { message: 'productId is required for product review fetching' },
          { status: 400 }
        );
      }
      baseQuery.product = new mongoose.Types.ObjectId(productId);
    }

    // We'll gather:
    // 1) All APPROVED reviews matching baseQuery
    // 2) The user's single review if phone is provided (any status), pinned on page=1
    let userId = null;
    if (userPhoneNumber) {
      const user = await User.findOne({ phoneNumber: userPhoneNumber });
      if (user) {
        userId = user._id;
      }
    }

    const approvedQuery = { ...baseQuery, status: 'approved' };
    const allApproved = await Review.find(approvedQuery).sort({ createdAt: -1 });

    // Attempt to find the user's review for this product/variant
    let userReview = null;
    if (userId) {
      userReview = await Review.findOne({
        ...baseQuery,
        user: userId,
      });
    }

    // Build combined list: userReview (pinned) + approved
    let combined = [...allApproved];
    if (userReview) {
      const foundIndex = combined.findIndex((r) => r._id.equals(userReview._id));
      if (foundIndex === -1) {
        // if not present in approved, push it
        if (page === 1) {
          combined.unshift(userReview); // Pin on top if page=1
        } else {
          combined.push(userReview);
        }
      }
    }

    // Star distribution & average rating for APPROVED docs only
    const starAggregation = await Review.aggregate([
      { $match: approvedQuery },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);

    let sumRatings = starAggregation.reduce(
      (acc, curr) => acc + curr._id * curr.count,
      0
    );
    let totalApprovedCount = await Review.countDocuments(approvedQuery);

    // Optionally add "dummy" review counts
    if (includeDummyReviewCount && fetchReviewSource === 'variant') {
      const variantDoc = await SpecificCategoryVariant.findById(variantId);
      if (variantDoc) {
        const dummyCount = variantDoc.tempReviewCount || 0;
        const dummyDist = variantDoc.tempReviewDistribution || {};
        totalApprovedCount += dummyCount;
        Object.entries(dummyDist).forEach(([starStr, cntStr]) => {
          const star = parseInt(starStr, 10);
          const count = parseInt(cntStr, 10);
          sumRatings += star * count;
        });
      }
    }

    const averageRating =
      totalApprovedCount > 0 ? sumRatings / totalApprovedCount : 0;

    const finalStarCounts = [5, 4, 3, 2, 1].map((star) => {
      const found = starAggregation.find((doc) => doc._id === star);
      return { star, count: found ? found.count : 0 };
    });

    // Pagination
    const totalReviews = combined.length;
    const totalPages = Math.ceil(totalReviews / limit);
    const skip = (page - 1) * limit;
    const paginatedReviews = combined.slice(skip, skip + limit);

    return NextResponse.json(
      {
        reviews: paginatedReviews,
        pagination: {
          totalCount: totalReviews,
          totalPages,
          currentPage: page,
          limit,
        },
        averageRating,
        starCounts: finalStarCounts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
