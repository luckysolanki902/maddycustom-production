// app/api/checkout/order/payment/create-razorpay-order/route.js

import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import shortid from 'shortid';

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});

const isTesting = process.env.IS_TESTING === 'true' || false;

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

    // Find the order by internal MongoDB _id
    const order = await Order.findById(orderId).populate('paymentDetails.mode');
    if (!order) {
      return NextResponse.json(
        { msg: 'Invalid order' },
        { status: 400 }
      );
    }
    if (!['pending', 'paidPartially'].includes(order.paymentStatus)) {
      return NextResponse.json(
        { msg: 'Order is already processed' },
        { status: 400 }
      );
    }

    // Determine the amount to be paid online based on payment mode
    let amountToPayOnline = 0;

    if (order.paymentDetails.mode.name === 'cod') {
      return NextResponse.json(
        { msg: 'No online payment required for COD' },
        { status: 400 }
      );
    } else {
      amountToPayOnline = order.paymentDetails.amountDueOnline;
      if (amountToPayOnline <= 0) {
        return NextResponse.json(
          { msg: 'No online payment due' },
          { status: 400 }
        );
      }
    }

    // Calculate the amount in the smallest currency unit (e.g., paise)
    const actualAmount = Math.floor(amountToPayOnline * 100); // Assuming amount is in INR
    const amount = isTesting ? 100 : actualAmount; // in paise
    const currency = 'INR';
    const receipt = shortid.generate(); // Generate a short, unique receipt ID

    const options = {
      amount: amount.toString(),
      currency,
      receipt, // Use shortid as the receipt
      payment_capture: 1,
      notes: {
        orderId: orderId, // Embed internal orderId in notes
      },
    };

    const razorpayOrder = await instance.orders.create(options);

    // Update the order with Razorpay details
    order.paymentDetails.razorpayDetails.orderId = razorpayOrder.id;
    order.paymentDetails.razorpayDetails.receipt = receipt; // Optional: Store receipt if needed
    await order.save();


    return NextResponse.json(
      { msg: 'success', order: razorpayOrder },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return NextResponse.json(
      { msg: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
