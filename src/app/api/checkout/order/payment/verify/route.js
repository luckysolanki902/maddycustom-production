// app/api/checkout/payment/verify/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import ProcessedEvent from '@/models/ProcessedEvent';
import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Handles POST requests to verify Razorpay payments.
 * Ensures idempotency by checking processed events and order statuses.
 */
export async function POST(request) {
  try {
    // Parse the incoming JSON payload
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = await request.json();

    // Validate required fields
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
      console.warn('Missing required fields in payment verification.');
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 });
    }

    // Connect to the database
    await connectToDatabase();

    // Attempt to create a ProcessedEvent to ensure idempotency
    const processedEvent = new ProcessedEvent({
      provider: 'razorpay',
      eventId: razorpay_payment_id,
      eventType: 'payment.verified',
      resourceId: razorpay_order_id,
    });

    try {
      await processedEvent.save();
    } catch (saveError) {
      if (saveError.code === 11000) {
        // Duplicate event detected
        console.info('Duplicate payment verification detected. Already processed.');
        return NextResponse.json({ message: 'Payment already processed.' }, { status: 200 });
      }
      // Other errors
      console.error('Error saving ProcessedEvent:', saveError);
      return NextResponse.json({ message: 'Internal Server Error.' }, { status: 500 });
    }

    // Retrieve Razorpay secret from environment variables
    const razorpaySecret = process.env.RAZORPAY_SECRET;
    if (!razorpaySecret) {
      console.error('RAZORPAY_SECRET is not set.');
      return NextResponse.json({ message: 'Server configuration error.' }, { status: 500 });
    }

    // Generate the expected signature
    const generatedSignature = crypto
      .createHmac('sha256', razorpaySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    // Convert signatures to buffers for timing-safe comparison
    const isSignatureValid =
      razorpay_signature.length === generatedSignature.length &&
      crypto.timingSafeEqual(
        Buffer.from(generatedSignature, 'hex'),
        Buffer.from(razorpay_signature, 'hex')
      );

    // Validate the signature
    if (!isSignatureValid) {
      console.warn('Invalid signature in payment verification.');
      return NextResponse.json({ message: 'Invalid signature.' }, { status: 400 });
    }

    // Find the order by internal MongoDB orderId
    const order = await Order.findById(orderId);

    if (!order) {
      console.warn('Order not found for ID:', orderId);
      return NextResponse.json({ message: 'Order not found.' }, { status: 404 });
    }

    // If the order is already fully or partially paid, skip updates
    if (['allPaid', 'paidPartially'].includes(order.paymentStatus)) {
      console.info(`Order already in status '${order.paymentStatus}'.`);
      return NextResponse.json(
        { message: `Order already in status '${order.paymentStatus}'.` },
        { status: 200 }
      );
    }

    // Prevent double processing if the payment ID is already recorded
    if (order.paymentDetails.razorpayDetails.paymentId === razorpay_payment_id) {
      console.info('Payment already verified. Ignoring request.');
      return NextResponse.json(
        { message: 'Payment already verified.' },
        { status: 200 }
      );
    }

    // Compute the payment amount
    const paymentAmount = order.paymentDetails.amountDueOnline;

    // Atomic update to set payment details and update paymentStatus
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: orderId,
        paymentStatus: { $nin: ['allPaid', 'paidPartially'] },
      },
      {
        $set: {
          'paymentDetails.razorpayDetails.paymentId': razorpay_payment_id,
          'paymentDetails.razorpayDetails.signature': razorpay_signature,
        },
        $inc: {
          'paymentDetails.amountPaidOnline': paymentAmount,
          'paymentDetails.amountDueOnline': -paymentAmount,
        },
      },
      { new: true }
    ).exec();

    if (!updatedOrder) {
      console.warn('Order update failed. It might have been updated concurrently.');
      return NextResponse.json({ message: 'Order already updated.' }, { status: 200 });
    }

    // Update paymentStatus based on remaining dues
    if (updatedOrder.paymentDetails.amountDueOnline <= 0) {
      updatedOrder.paymentStatus = 'allPaid';
    } else if (updatedOrder.paymentDetails.amountPaidOnline > 0) {
      updatedOrder.paymentStatus = 'paidPartially';
    }

    await updatedOrder.save();

    console.info('Payment verification handled successfully.');
    return NextResponse.json({ message: 'success' }, { status: 200 });
  } catch (error) {
    // Handle any unexpected errors
    console.error('Payment verification handler error:', error);
    return NextResponse.json({ message: 'Internal Server Error.' }, { status: 500 });
  }
}
