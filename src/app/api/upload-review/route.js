// File: /api/upload-review/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import { getPresignedUrl } from '@/lib/aws';
import Review from '@/models/Review';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export async function POST(request) {
  try {
    // Connect to the database
    await connectToDatabase();

    // Get the form data from the multipart request
    const formData = await request.formData();

    // Extract review text fields
    const phoneNumber = formData.get('phoneNumber'); // if needed for logging
    let name = formData.get('name'); // will be overwritten if receiverName is provided
    const productId = formData.get('productId');
    const rating = Number(formData.get('rating'));
    const comment = formData.get('comment');
    const reviewTitle = formData.get('reviewTitle');
    // const categoryId = formData.get('categoryId');
    // const variantId = formData.get('variantId');
    const specificCategory = formData.get('categoryId');
    const specificCategoryVariant = formData.get('variantId');
    const imagePath = formData.get('imagePath');

    // specificCategory
    // specificCategoryVariant

    // Extra fields from the check-purchase API response:
    const receiverName = formData.get('receiverName');
    const userId = formData.get('userId');

    // Use the verified receiver name if available
    if (receiverName) {
      name = receiverName;
    }

    // Process uploaded files (both images and videos are appended under "images")


    // Create the review object (note that if you want to store reviewTitle,
    // ensure your Mongoose schema supports it or add it to your schema)
    const reviewData = {
      name,
      comment,
      rating,
      images: [imagePath],
      product: productId,
      specificCategory: specificCategory,
      specificCategoryVariant: specificCategoryVariant,
      user: userId,
      // Optionally add reviewTitle if you have such a field in your schema:
      reviewTitle,
    };

    // Save the review document to MongoDB
    const review = new Review(reviewData);
    await review.save();

    return NextResponse.json({
      success: true,
      message: 'Review submitted successfully',
      review,
    });
  } catch (error) {
    console.error('Error in review upload API:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
