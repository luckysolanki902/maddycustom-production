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
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 });
    }

    await connectToDatabase();

    // Check if this payment has already been processed
    const existingEvent = await ProcessedEvent.findOne({
      provider: 'razorpay',
      eventId: razorpay_payment_id,
    });
    if (existingEvent) {
      return NextResponse.json({ message: 'Payment already processed.' }, { status: 200 });
    }

    // Retrieve Razorpay secret from environment variables
    const razorpaySecret = process.env.RAZORPAY_SECRET;
    if (!razorpaySecret) {
      return NextResponse.json({ message: 'Server configuration error.' }, { status: 500 });
    }

    // Generate the expected signature
    const generatedSignature = crypto
      .createHmac('sha256', razorpaySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    // Convert signatures to buffers for timing-safe comparison
    const isSignatureValid = crypto.timingSafeEqual(
      Buffer.from(generatedSignature, 'hex'),
      Buffer.from(razorpay_signature, 'hex')
    );

    // Validate the signature
    if (!isSignatureValid) {
      return NextResponse.json({ message: 'Invalid signature.' }, { status: 400 });
    }

    // Start a MongoDB session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the order by internal MongoDB orderId
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ message: 'Order not found.' }, { status: 404 });
      }

      // If the order is already fully or partially paid, skip updates
      if (['allPaid', 'paidPartially'].includes(order.paymentStatus)) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: `Order already in status '${order.paymentStatus}'.` },
          { status: 200 }
        );
      }

      // Prevent double processing if the payment ID is already recorded
      if (order.paymentDetails.razorpayDetails.paymentId === razorpay_payment_id) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'Payment already verified.' },
          { status: 200 }
        );
      }

      // Update payment details
      order.paymentDetails.razorpayDetails.paymentId = razorpay_payment_id;
      order.paymentDetails.razorpayDetails.signature = razorpay_signature;
      order.paymentDetails.amountPaidOnline += order.paymentDetails.amountDueOnline;
      order.paymentDetails.amountDueOnline = 0;

      // Update paymentStatus based on remaining dues
      if (order.paymentDetails.amountDueCod > 0) {
        order.paymentStatus = 'paidPartially';
      } else {
        order.paymentStatus = 'allPaid';
      }

      // Save the updated order
      await order.save({ session });

      // Record the processed event to prevent duplicate processing
      const processedEvent = new ProcessedEvent({
        provider: 'razorpay',
        eventId: razorpay_payment_id,
        eventType: 'payment.verified',
        resourceId: razorpay_order_id,
      });
      await processedEvent.save({ session });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      return NextResponse.json({ message: 'success' }, { status: 200 });
    } catch (err) {
      // On any transaction error, abort the transaction
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ message: 'Internal Server Error.' }, { status: 500 });
    }
  } catch (error) {
    // Handle any unexpected errors
    return NextResponse.json({ message: 'Internal Server Error.' }, { status: 500 });
  }
}
