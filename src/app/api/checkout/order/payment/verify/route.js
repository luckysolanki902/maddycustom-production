// app/api/checkout/payment/verify/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import ProcessedEvent from '@/models/ProcessedEvent';
import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Maximum number of retry attempts for transient transaction errors.
 */
const MAX_TRANSACTION_RETRIES = 5;

/**
 * Sleeps for the specified number of milliseconds.
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Handles POST requests to verify Razorpay payments.
 * Ensures idempotency by checking processed events and order statuses.
 */
export async function POST(request) {
  const requestStartTime = Date.now();
  console.info(`[${new Date().toISOString()}] Incoming payment verification request.`);

  try {
    // Parse the incoming JSON payload
    const payload = await request.json();
    console.debug(`[${new Date().toISOString()}] Request payload:`, payload);

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = payload;

    // Validate required fields
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
      console.warn(`[${new Date().toISOString()}] Missing required fields. Payload:`, payload);
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 });
    }

    console.info(`[${new Date().toISOString()}] Connecting to the database.`);
    await connectToDatabase();
    console.info(`[${new Date().toISOString()}] Database connection established.`);

    // Retry mechanism for handling transient transaction errors
    for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt++) {
      const session = await mongoose.startSession();
      session.startTransaction();
      console.info(`[${new Date().toISOString()}] Starting transaction (Attempt ${attempt}).`);

      try {
        // Check if this payment has already been processed
        console.debug(
          `[${new Date().toISOString()}] Checking for existing processed event with payment ID: ${razorpay_payment_id}.`
        );
        const existingEvent = await ProcessedEvent.findOne({
          provider: 'razorpay',
          eventId: razorpay_payment_id,
        }).session(session);

        if (existingEvent) {
          console.info(`[${new Date().toISOString()}] Payment ID ${razorpay_payment_id} has already been processed.`);
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json({ message: 'Payment already processed.' }, { status: 200 });
        }

        // Retrieve Razorpay secret from environment variables
        const razorpaySecret = process.env.RAZORPAY_SECRET;
        if (!razorpaySecret) {
          console.error(`[${new Date().toISOString()}] RAZORPAY_SECRET is not set in environment variables.`);
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json({ message: 'Server configuration error.' }, { status: 500 });
        }

        // Generate the expected signature
        const generatedSignature = crypto
          .createHmac('sha256', razorpaySecret)
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest('hex');

        console.debug(
          `[${new Date().toISOString()}] Generated signature: ${generatedSignature}, Provided signature: ${razorpay_signature}.`
        );

        // Convert signatures to buffers for timing-safe comparison
        let isSignatureValid = false;
        try {
          isSignatureValid = crypto.timingSafeEqual(
            Buffer.from(generatedSignature, 'hex'),
            Buffer.from(razorpay_signature, 'hex')
          );
        } catch (comparisonError) {
          console.error(
            `[${new Date().toISOString()}] Error during signature comparison:`,
            comparisonError
          );
          // If there's an error in comparison, treat it as invalid signature
        }

        // Validate the signature
        if (!isSignatureValid) {
          console.warn(`[${new Date().toISOString()}] Invalid signature for payment ID: ${razorpay_payment_id}.`);
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json({ message: 'Invalid signature.' }, { status: 400 });
        }

        // Find the order by internal MongoDB orderId
        console.debug(`[${new Date().toISOString()}] Searching for order with ID: ${orderId}.`);
        const order = await Order.findById(orderId).session(session);
        if (!order) {
          console.warn(`[${new Date().toISOString()}] Order not found with ID: ${orderId}.`);
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json({ message: 'Order not found.' }, { status: 404 });
        }

        console.info(
          `[${new Date().toISOString()}] Found order with ID: ${orderId}. Current payment status: ${order.paymentStatus}.`
        );

        // If the order is already fully or partially paid, skip updates
        if (['allPaid', 'paidPartially'].includes(order.paymentStatus)) {
          console.info(
            `[${new Date().toISOString()}] Order ID ${orderId} already in status '${order.paymentStatus}'.`
          );
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json(
            { message: `Order already in status '${order.paymentStatus}'.` },
            { status: 200 }
          );
        }

        // Prevent double processing if the payment ID is already recorded
        if (order.paymentDetails.razorpayDetails.paymentId === razorpay_payment_id) {
          console.info(`[${new Date().toISOString()}] Payment ID ${razorpay_payment_id} already verified for order ID ${orderId}.`);
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json(
            { message: 'Payment already verified.' },
            { status: 200 }
          );
        }

        // Update payment details
        console.info(`[${new Date().toISOString()}] Updating payment details for order ID ${orderId}.`);
        order.paymentDetails.razorpayDetails.paymentId = razorpay_payment_id;
        order.paymentDetails.razorpayDetails.signature = razorpay_signature;
        order.paymentDetails.amountPaidOnline += order.paymentDetails.amountDueOnline;
        order.paymentDetails.amountDueOnline = 0;

        // Update paymentStatus based on remaining dues
        if (order.paymentDetails.amountDueCod > 0) {
          order.paymentStatus = 'paidPartially';
          console.info(`[${new Date().toISOString()}] Order ID ${orderId} payment status updated to 'paidPartially'.`);
        } else {
          order.paymentStatus = 'allPaid';
          console.info(`[${new Date().toISOString()}] Order ID ${orderId} payment status updated to 'allPaid'.`);
        }

        // Save the updated order
        console.debug(`[${new Date().toISOString()}] Saving updated order ID ${orderId}.`);
        await order.save({ session });

        // Record the processed event to prevent duplicate processing
        console.debug(
          `[${new Date().toISOString()}] Recording processed event for payment ID ${razorpay_payment_id}.`
        );
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

        console.info(`[${new Date().toISOString()}] Payment ID ${razorpay_payment_id} verified successfully for order ID ${orderId}.`);
        const requestDuration = Date.now() - requestStartTime;
        console.info(`[${new Date().toISOString()}] Payment verification completed in ${requestDuration}ms.`);
        return NextResponse.json({ message: 'success' }, { status: 200 });
      } catch (err) {
        await session.abortTransaction();
        session.endSession();

        // Check if the error is a transient transaction error
        const isTransientError =
          err.hasErrorLabel && err.hasErrorLabel('TransientTransactionError');

        if (isTransientError && attempt < MAX_TRANSACTION_RETRIES) {
          const delay = Math.pow(2, attempt) * 100; // Exponential backoff
          console.warn(
            `[${new Date().toISOString()}] TransientTransactionError encountered on attempt ${attempt}. Retrying in ${delay}ms. Error:`,
            err
          );
          await sleep(delay);
          continue; // Retry the transaction
        }

        // For other errors or if max retries exceeded
        console.error(
          `[${new Date().toISOString()}] Transaction error on attempt ${attempt}:`,
          err
        );
        return NextResponse.json({ message: 'Internal Server Error.' }, { status: 500 });
      }
    }

    // If all retry attempts fail
    console.error(
      `[${new Date().toISOString()}] Max transaction retry attempts (${MAX_TRANSACTION_RETRIES}) reached. Payment ID: ${razorpay_payment_id}.`
    );
    return NextResponse.json({ message: 'Internal Server Error.' }, { status: 500 });
  } catch (error) {
    // Handle any unexpected errors
    console.error(
      `[${new Date().toISOString()}] Unexpected error in payment verification handler:`,
      error
    );
    return NextResponse.json({ message: 'Internal Server Error.' }, { status: 500 });
  }
}
