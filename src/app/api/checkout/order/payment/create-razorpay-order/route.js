// app/api/checkout/order/payment/create-razorpay-order/route.js

import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import shortid from 'shortid';

// Initialize Razorpay instance outside the handler for reuse
const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});



export async function POST(request) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { msg: 'orderId is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find the order with minimal projection - only get what we need
    const order = await Order.findById(orderId, {
      'paymentDetails.mode': 1,
      'paymentDetails.amountDueOnline': 1,
      'paymentStatus': 1
    }).populate('paymentDetails.mode', 'name');
    
    if (!order) {
      return NextResponse.json(
        { msg: 'Invalid order' },
        { status: 400 }
      );
    }
    
    // Quick validation checks
    if (!['pending', 'paidPartially'].includes(order.paymentStatus)) {
      return NextResponse.json(
        { msg: 'Order is already processed' },
        { status: 400 }
      );
    }

    // For COD, no online payment needed
    if (order.paymentDetails.mode.name === 'cod') {
      return NextResponse.json(
        { msg: 'No online payment required for COD' },
        { status: 400 }
      );
    }
    
    // Check if there's an amount due online
    const amountToPayOnline = order.paymentDetails.amountDueOnline;
    if (amountToPayOnline <= 0) {
      return NextResponse.json(
        { msg: 'No online payment due' },
        { status: 400 }
      );
    }

    // Calculate the amount in the smallest currency unit (paise)
    const amount = Math.floor(amountToPayOnline * 100);
    const currency = 'INR';
    const receipt = shortid.generate();

    const options = {
      amount: amount.toString(),
      currency,
      receipt,
      payment_capture: 1,
      notes: {
        orderId: orderId,
      },
    };

    // Create Razorpay order
    const razorpayOrder = await instance.orders.create(options);

    // Update order with Razorpay details using updateOne for better performance
    await Order.updateOne(
      { _id: orderId },
      { 
        $set: { 
          'paymentDetails.razorpayDetails.orderId': razorpayOrder.id,
          'paymentDetails.razorpayDetails.receipt': receipt
        } 
      }
    );

    return NextResponse.json(
      { msg: 'success', order: razorpayOrder },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error creating Razorpay order:', error.message);
    return NextResponse.json(
      { msg: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
