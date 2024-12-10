// app/api/user/order/[orderId]/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import mongoose from 'mongoose';

/**
 * Handles GET requests to fetch order details by orderId.
 */
export async function GET(request, { params }) {
  const { orderId } = params;
  try {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      console.warn(`Fetch Order failed: Invalid orderId format=${orderId}.`);
      return NextResponse.json({ message: 'Invalid order ID' }, { status: 400 });
    }

    await connectToDatabase();

    const order = await Order.findById(orderId)
      .populate('user', 'name email') // Populate user details if needed
      .populate('items.product', 'name images price') // Populate product details
      .populate('paymentDetails.mode', 'name');

    if (!order) {
      console.warn(`Fetch Order failed: Order not found for orderId=${orderId}.`);
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    // Optional: Ensure that the requesting user has access to this order
    // Implement authentication and authorization as needed

    // Return the order details
    console.info(`Order fetched successfully for orderId=${orderId}.`);
    return NextResponse.json({ order }, { status: 200 });
  } catch (error) {
    console.error('Error fetching order:', error.message);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
