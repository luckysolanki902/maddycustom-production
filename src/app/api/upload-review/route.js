// app/api/upload-review/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Review from '@/models/Review';
import mongoose from 'mongoose';

export async function POST(request) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const {
      phoneNumber, 
      name,
      productId,
      rating,
      comment,
      receiverName,
      userId,
      orderId,
      categoryId,
      variantId,
      imagePath,
    } = body;

    const finalName = receiverName || name || "Anonymous";

    // Construct the Review doc
    const reviewDoc = new Review({
      comment,
      rating: Number(rating),
      images: imagePath ? [imagePath] : [],
      name: finalName,
      user: userId || undefined, // store user if provided
      product: productId || undefined, 
      order: orderId || undefined,
      specificCategory: categoryId || undefined,
      specificCategoryVariant: variantId || undefined,
      // status defaults to 'pending' per the schema, so we don't need to set it
    });

    await reviewDoc.save();

    return NextResponse.json({
      success: true,
      message: 'Review submitted successfully',
      review: reviewDoc,
    });
  } catch (error) {
    console.error('Error in review upload API:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
