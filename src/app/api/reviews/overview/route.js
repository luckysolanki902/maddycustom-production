// /app/api/reviews/overview/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Review from '@/models/Review';
import mongoose from 'mongoose';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import SpecificCategory from '@/models/SpecificCategory';

const disableFakeAddition = false; // Toggle to disable dummy reviews

// Cache review overview for 1 hour
export const revalidate = 3600;

export async function GET(request) {
  try {
    await connectToDatabase();

  const searchParams = request.nextUrl.searchParams;
    // Allowed values: 'variant', 'product', or 'specCat'
    const fetchReviewSource = searchParams.get('fetchReviewSource');
    const productId = searchParams.get('productId');
    const variantId = searchParams.get('variantId');
    const categoryId = searchParams.get('categoryId');

    if (!['variant', 'product', 'specCat'].includes(fetchReviewSource)) {
      return NextResponse.json(
        { message: 'Invalid fetchReviewSource value. It must be one of variant, product, or specCat.' },
        { status: 400 }
      );
    }

    // Always fetch real reviews using specificCategoryId (categoryId)
    const approvedQuery = { status: 'approved' };
    if (!categoryId) {
      return NextResponse.json(
        { message: 'categoryId (specificCategoryId) is required for reviews.' },
        { status: 400 }
      );
    }
    approvedQuery.specificCategory = new mongoose.Types.ObjectId(categoryId);

    // Compute the real star distribution from approved reviews.
    const starAggregation = await Review.aggregate([
      { $match: approvedQuery },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);

    // Prepare a dummy distribution object (default is empty).
    let dummyDistObj = {};

    if (!disableFakeAddition) {
      if (fetchReviewSource === 'variant') {
        const variantDoc = await SpecificCategoryVariant.findById(variantId);
        if (variantDoc) {
          dummyDistObj = variantDoc.tempReviewDistribution || {};
        }
      } else if (fetchReviewSource === 'specCat') {
        const specCatDoc = await SpecificCategory.findById(categoryId);
        if (specCatDoc) {
          dummyDistObj = specCatDoc.tempReviewDistribution || {};
        }
      }
    }

    // Merge the real aggregation with any dummy distribution.
    const finalStarCounts = [5, 4, 3, 2, 1].map((star) => {
      const realCount = starAggregation.find((doc) => doc._id === star)?.count || 0;
      const dummyCount = dummyDistObj[star] ? parseInt(dummyDistObj[star], 10) : 0;
      return { star, count: realCount + dummyCount };
    });

    // Calculate total count and sum from merged star counts
    const totalMergedCount = finalStarCounts.reduce((acc, curr) => acc + curr.count, 0);
    const sumMergedRatings = finalStarCounts.reduce((acc, curr) => acc + curr.star * curr.count, 0);
    const averageRating = totalMergedCount > 0 ? sumMergedRatings / totalMergedCount : 0;

    // For display, also show the merged count
    return NextResponse.json(
      {
        averageRating,
        starCounts: finalStarCounts,
        totalApprovedCount: totalMergedCount,
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
