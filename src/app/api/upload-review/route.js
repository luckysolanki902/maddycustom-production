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

    // Extra fields from the check-purchase API response:
    const receiverName = formData.get('receiverName');
    const userId = formData.get('userId');

    // Use the verified receiver name if available
    if (receiverName) {
      name = receiverName;
    }

    // Process uploaded files (both images and videos are appended under "images")
    const files = formData.getAll('images'); // files may be images OR videos
    const imageUrls = [];
    const videoUrls = [];

    for (const file of files) {
      // file is a File (Blob) object; get its MIME type
      const fileType = file.type; 
      // Create a unique file name (replace spaces if necessary)
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/\s+/g, '_');

      // Determine folder based on file type and create a full path
      let folder;
      if (fileType.startsWith('image/')) {
        folder = 'reviews/images';
      } else if (fileType.startsWith('video/')) {
        folder = 'reviews/videos';
      } else {
        // Skip files that are neither image nor video
        continue;
      }
      const fileName = `${timestamp}_${sanitizedFileName}`;
      const fullPath = `${folder}/${fileName}`;

      // Get presigned URL from AWS helper
      const { presignedUrl, url } = await getPresignedUrl(fullPath, fileType);

      // Read file content (as a Buffer)
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload file directly to AWS S3 using the presigned URL
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': fileType,
        },
        body: buffer,
      });

      if (!uploadResponse.ok) {
        console.error(`Failed to upload file: ${file.name}`);
      } else {
        if (fileType.startsWith('image/')) {
          imageUrls.push(url);
        } else {
          videoUrls.push(url);
        }
      }
    }

    // Create the review object (note that if you want to store reviewTitle,
    // ensure your Mongoose schema supports it or add it to your schema)
    const reviewData = {
      name,
      comment,
      rating,
      images: imageUrls,
      videos: videoUrls,
      product: productId,
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
