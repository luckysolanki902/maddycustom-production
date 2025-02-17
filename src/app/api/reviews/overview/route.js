// /app/api/reviews/overview/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Review from '@/models/Review';
import mongoose from 'mongoose';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';

const disableFakeAddition = false; // Toggle to disable dummy reviews

export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const fetchReviewSource = searchParams.get('fetchReviewSource'); // 'variant' or 'product'
    const productId = searchParams.get('productId');
    const variantId = searchParams.get('variantId');

    if (!['variant', 'product'].includes(fetchReviewSource)) {
      return NextResponse.json(
        { message: 'Invalid fetchReviewSource value' },
        { status: 400 }
      );
    }

    const approvedQuery = { status: 'approved' };
    if (fetchReviewSource === 'variant') {
      if (!variantId) {
        return NextResponse.json(
          { message: 'variantId is required for variant overview' },
          { status: 400 }
        );
      }
      approvedQuery.specificCategoryVariant = new mongoose.Types.ObjectId(variantId);
    } else {
      // 'product'
      if (!productId) {
        return NextResponse.json(
          { message: 'productId is required for product overview' },
          { status: 400 }
        );
      }
      approvedQuery.product = new mongoose.Types.ObjectId(productId);
    }

    // Compute real star distribution from approved reviews
    const starAggregation = await Review.aggregate([
      { $match: approvedQuery },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);

    // Calculate sum of ratings and total count from actual reviews
    let sumRatings = starAggregation.reduce(
      (acc, curr) => acc + curr._id * curr.count,
      0
    );
    let totalApprovedCount = await Review.countDocuments(approvedQuery);

    // Prepare a dummy distribution object (default empty)
    let dummyDistObj = {};

    // Optionally add dummy stats
    if (!disableFakeAddition && fetchReviewSource === 'variant') {
      const variantDoc = await SpecificCategoryVariant.findById(variantId);
      if (variantDoc) {
        const dummyCount = variantDoc.tempReviewCount || 0;
        dummyDistObj = variantDoc.tempReviewDistribution || {};
        totalApprovedCount += dummyCount;
        // Add dummy ratings to the sum
        Object.entries(dummyDistObj).forEach(([starStr, cnt]) => {
          const star = parseInt(starStr, 10);
          const count = parseInt(cnt, 10);
          sumRatings += star * count;
        });
      }
    }

    const averageRating =
      totalApprovedCount > 0 ? sumRatings / totalApprovedCount : 0;

    // Merge the real aggregation with dummy distribution.
    const finalStarCounts = [5, 4, 3, 2, 1].map((star) => {
      const realCount = starAggregation.find((doc) => doc._id === star)?.count || 0;
      const dummyCount = dummyDistObj[star] ? parseInt(dummyDistObj[star], 10) : 0;
      return { star, count: realCount + dummyCount };
    });

    console.log({
      dummyCount: dummyDistObj ? Object.values(dummyDistObj).reduce((a, b) => a + parseInt(b, 10), 0) : 0,
      dummyDist: dummyDistObj,
      totalApprovedCount,
    });
    console.log({ averageRating, starCounts: finalStarCounts });

    return NextResponse.json(
      {
        averageRating,
        starCounts: finalStarCounts,
        totalApprovedCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching reviews overview:', error);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
