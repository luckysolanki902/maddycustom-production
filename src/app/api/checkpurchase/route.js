// app/api/checkpurchase/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import User from '@/models/User';
import Review from '@/models/Review';

export async function GET(req) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const phoneNumber = searchParams.get('phoneNumber');
    const productId = searchParams.get('productId');

    if (!phoneNumber || !productId) {
      return NextResponse.json(
        { success: false, message: 'phoneNumber and productId are required' },
        { status: 400 }
      );
    }

    // Find the user by phone
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'No matching user found', hasPurchased: false },
        { status: 404 }
      );
    }

    // Find an order for that phone and product, irrespective of order status
    // Return the _id of the order so we can store it in the review
    const order = await Order.findOne({
      'address.receiverPhoneNumber': phoneNumber,
      'items.product': productId,
    }).select('_id address.receiverName');

    if (!order) {
      return NextResponse.json(
        { success: false, message: 'No matching order found', hasPurchased: false },
        { status: 404 }
      );
    }

    // Check if user has already reviewed
    const existingReview = await Review.findOne({
      user: user._id,
      product: productId,
    });
    if (existingReview) {
      return NextResponse.json(
        {
          success: false,
          message: 'You have already reviewed this product',
          hasPurchased: false,
        },
        { status: 400 }
      );
    }

    // All good
    return NextResponse.json(
      {
        success: true,
        message: 'Order found',
        hasPurchased: true,
        receiverName: order.address.receiverName,
        userId: user._id,
        orderId: order._id, // <--- Return orderId
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in checkpurchase route:', error);
    return NextResponse.json(
      { success: false, message: 'Server Error', hasPurchased: false },
      { status: 500 }
    );
  }
}
