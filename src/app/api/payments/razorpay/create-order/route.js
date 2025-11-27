// Create Razorpay order for existing order
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import Razorpay from 'razorpay';
import shortid from 'shortid';

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});

export async function POST(request) {
  try {
    await connectToDatabase();
    
    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Fetch the order
    const order = await Order.findById(orderId);
    
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if Razorpay order already exists
    if (order.paymentDetails?.razorpayDetails?.orderId) {
      return NextResponse.json({
        success: true,
        razorpayOrderId: order.paymentDetails.razorpayDetails.orderId,
        amount: order.paymentDetails.amountDueOnline,
        existing: true,
      });
    }

    // Create new Razorpay order
    const amountDueOnline = order.paymentDetails?.amountDueOnline || order.totalAmount;
    const amountInPaise = Math.floor(amountDueOnline * 100);
    const receiptId = shortid.generate();

    const razorpayOptions = {
      amount: amountInPaise.toString(),
      currency: 'INR',
      receipt: receiptId,
      payment_capture: 1,
      notes: {
        databaseOrderId: order._id.toString(),
        orderGroupId: order.orderGroupId || '',
      },
    };

    const razorpayOrderResponse = await razorpayInstance.orders.create(razorpayOptions);

    // Update order with Razorpay details
    if (!order.paymentDetails.razorpayDetails) {
      order.paymentDetails.razorpayDetails = {};
    }
    order.paymentDetails.razorpayDetails.orderId = razorpayOrderResponse.id;
    order.paymentDetails.razorpayDetails.receipt = receiptId;
    await order.save();

    return NextResponse.json({
      success: true,
      razorpayOrderId: razorpayOrderResponse.id,
      amount: amountDueOnline,
      existing: false,
    });

  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create Razorpay order',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
