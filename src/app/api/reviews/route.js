// // app/api/reviews/route.js
// import connectToDatabase from '@/lib/middleware/connectToDb';
// import Review from '@/models/Review';
// import { NextResponse } from 'next/server';

// // Import the User model for looking up the phone number.
// import User from '@/models/User';
// import mongoose from 'mongoose';

// export async function GET(request) {
//   // Extract query parameters from the request URL
//   const { searchParams } = new URL(request.url);
//   const fetchReviewSource = searchParams.get('fetchReviewSource');
//   const productId = searchParams.get('productId');
//   const variantId = searchParams.get('variantId');
//   const userPhoneNumber = searchParams.get('userPhoneNumber'); // Note: renamed for clarity
//   const page = parseInt(searchParams.get('page') || '1');
//   const limit = parseInt(searchParams.get('limit') || '5'); // Default to 5 reviews per page

//   // Connect to the database
//   await connectToDatabase();

//   // Build the base query using the product/variant criteria.
//   const query = {};

//   if (fetchReviewSource === 'variant') {
//     if (!variantId) {
//       return NextResponse.json(
//         { message: 'variantId is required for variant review fetching' },
//         { status: 400 }
//       );
//     }
//     // Convert the variantId string to an ObjectId.
//     query.specificCategoryVariant = new mongoose.Types.ObjectId(variantId);
//   } else if (fetchReviewSource === 'product') {
//     if (!productId) {
//       return NextResponse.json(
//         { message: 'productId is required for product review fetching' },
//         { status: 400 }
//       );
//     }
//     // Convert the productId string to an ObjectId.
//     query.product = new mongoose.Types.ObjectId(productId);
//   } else {
//     return NextResponse.json(
//       { message: 'Invalid fetchReviewSource value' },
//       { status: 400 }
//     );
//   }

//   // Modify the query based on whether a userPhoneNumber was provided.
//   // We want to fetch reviews that are either approved, or
//   // pending reviews for the user with the given phone number.
//   if (userPhoneNumber) {
//     try {
//       // Look up the user by phone number.
//       const user = await User.findOne({ phoneNumber: userPhoneNumber });
//       if (user) {
//         // Use $or so that either approved reviews are returned,
//         // or pending reviews that belong to this user.
//         query.$or = [
//           { status: 'approved' },
//           { status: 'pending', user: user._id }
//         ];
//       } else {
//         // If no user is found, just return approved reviews.
//         query.status = 'approved';
//       }
//     } catch (error) {
//       console.error('Error fetching user:', error.message);
//       // In case of error with user lookup, fallback to approved reviews.
//       query.status = 'approved';
//     }
//   } else {
//     // No phone number provided: only return approved reviews.
//     query.status = 'approved';
//   }

//   try {
//     // Get the total count to calculate pagination values
//     const totalCount = await Review.countDocuments(query);
//     const totalPages = Math.ceil(totalCount / limit);
//     const skip = (page - 1) * limit;

//     // Aggregate the overall average rating and star counts from all matching reviews.
//     const starAggregation = await Review.aggregate([
//       { $match: query },
//       {
//         $group: {
//           _id: '$rating',
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     // Create an array with star counts for stars 5 through 1.
//     const starCounts = [5, 4, 3, 2, 1].map((star) => {
//       const found = starAggregation.find((doc) => doc._id === star);
//       return { star, count: found ? found.count : 0 };
//     });

//     // Calculate the average rating using the aggregation result.
//     let averageRating = 0;
//     if (totalCount > 0) {
//       const sumRatings = starAggregation.reduce(
//         (acc, curr) => acc + curr._id * curr.count,
//         0
//       );
//       averageRating = sumRatings / totalCount;
//     }

//     // Fetch the paginated reviews
//     const reviews = await Review.find(query)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit);

//     return NextResponse.json(
//       {
//         reviews,
//         pagination: { totalCount, totalPages, currentPage: page, limit },
//         averageRating,
//         starCounts,
//       },
//       { status: 200 }
//     );
//   } catch (error) {
//     console.error('Error fetching reviews:', error.message);
//     return NextResponse.json(
//       { message: 'Server error. Please try again.' },
//       { status: 500 }
//     );
//   }
// }

// app/api/reviews/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import Review from '@/models/Review';
import { NextResponse } from 'next/server';
import User from '@/models/User';
import mongoose from 'mongoose';

// Import the SpecificCategoryVariant model to optionally include dummy review data.
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';

// Set to false to disable including dummy review counts (set to true to enable)
const includeDummyReviewCount = true;

export async function GET(request) {
  // Extract query parameters from the request URL
  const { searchParams } = new URL(request.url);
  const fetchReviewSource = searchParams.get('fetchReviewSource');
  const productId = searchParams.get('productId');
  const variantId = searchParams.get('variantId');
  const userPhoneNumber = searchParams.get('userPhoneNumber'); // Note: renamed for clarity
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '5'); // Default to 5 reviews per page

  // Connect to the database
  await connectToDatabase();

  // Build the base query using the product/variant criteria.
  const query = {};

  if (fetchReviewSource === 'variant') {
    if (!variantId) {
      return NextResponse.json(
        { message: 'variantId is required for variant review fetching' },
        { status: 400 }
      );
    }
    // Convert the variantId string to an ObjectId.
    query.specificCategoryVariant = new mongoose.Types.ObjectId(variantId);
  } else if (fetchReviewSource === 'product') {
    if (!productId) {
      return NextResponse.json(
        { message: 'productId is required for product review fetching' },
        { status: 400 }
      );
    }
    // Convert the productId string to an ObjectId.
    query.product = new mongoose.Types.ObjectId(productId);
  } else {
    return NextResponse.json(
      { message: 'Invalid fetchReviewSource value' },
      { status: 400 }
    );
  }

  // Modify the query based on whether a userPhoneNumber was provided.
  // We want to fetch reviews that are either approved, or
  // pending reviews for the user with the given phone number.
  if (userPhoneNumber) {
    try {
      // Look up the user by phone number.
      const user = await User.findOne({ phoneNumber: userPhoneNumber });
      if (user) {
        // Use $or so that either approved reviews are returned,
        // or pending reviews that belong to this user.
        query.$or = [
          { status: 'approved' },
          { status: 'pending', user: user._id }
        ];
      } else {
        // If no user is found, just return approved reviews.
        query.status = 'approved';
      }
    } catch (error) {
      console.error('Error fetching user:', error.message);
      // In case of error with user lookup, fallback to approved reviews.
      query.status = 'approved';
    }
  } else {
    // No phone number provided: only return approved reviews.
    query.status = 'approved';
  }

  try {
    // Get the total count of actual reviews to calculate pagination values.
    const totalCount = await Review.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;

    // Aggregate the overall average rating and star counts from all matching reviews.
    const starAggregation = await Review.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      }
    ]);

    // Compute the actual reviews statistics.
    let computedSumRatings = starAggregation.reduce(
      (acc, curr) => acc + curr._id * curr.count,
      0
    );
    let computedTotalCount = totalCount;

    // Create an array with star counts for stars 5 through 1 based on actual reviews.
    let finalStarCounts = [5, 4, 3, 2, 1].map((star) => {
      const found = starAggregation.find((doc) => doc._id === star);
      return { star, count: found ? found.count : 0 };
    });

    // If including dummy reviews and fetching variant-specific reviews,
    // fetch the variant document and merge its dummy review data.
    if (includeDummyReviewCount && fetchReviewSource === 'variant') {
      const variantDoc = await SpecificCategoryVariant.findById(variantId);
      if (variantDoc) {
        const dummyCount = variantDoc.tempReviewCount || 0;
        const dummyDist = variantDoc.tempReviewDistribution || {};

        // Update total review count and sum of ratings with dummy values.
        computedTotalCount += dummyCount;
        let dummySumRatings = 0;

        finalStarCounts = finalStarCounts.map((item) => {
          // dummyDist keys might be stored as strings (e.g., "1", "2", etc.)
          const dummyValue = parseInt(dummyDist[item.star] || '0', 10);
          dummySumRatings += item.star * dummyValue;
          return { star: item.star, count: item.count + dummyValue };
        });
        computedSumRatings += dummySumRatings;
      }
    }

    // Compute the final average rating.
    const averageRating = computedTotalCount > 0 ? computedSumRatings / computedTotalCount : 0;

    // Fetch the paginated reviews.
    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return NextResponse.json(
      {
        reviews,
        pagination: { totalCount, totalPages, currentPage: page, limit },
        averageRating,
        starCounts: finalStarCounts,
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
