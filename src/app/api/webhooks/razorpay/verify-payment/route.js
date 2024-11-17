// app/api/webhooks/razorpay/verify-payment/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import ProcessedEvent from '@/models/ProcessedEvent';
import { createShiprocketOrder, getDimensionsAndWeight } from '@/lib/utils/shiprocket';
import crypto from 'crypto';
import mongoose from 'mongoose';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing to access raw body for signature verification
  },
};

/**
 * Handles POST requests from Razorpay webhooks to verify payments.
 * Ensures idempotency by checking processed events and order statuses.
 */
export async function POST(request) {
  try {
    // Retrieve the raw body for signature verification
    const rawBody = await request.text();

    // Retrieve the webhook secret from environment variables
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    // Extract the signature from headers
    const signature = request.headers.get('x-razorpay-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature header.' }, { status: 400 });
    }

    // Compute the expected signature using HMAC SHA256
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Convert signatures to buffers for timing-safe comparison
    const receivedSignatureBuffer = Buffer.from(signature, 'hex');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');

    // Validate signature length to prevent timing attacks
    if (receivedSignatureBuffer.length !== expectedSignatureBuffer.length) {
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
    }

    // Perform timing-safe comparison of signatures
    const isValidSignature = crypto.timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer);

    if (!isValidSignature) {
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
    }

    // Parse the event payload
    let event;
    try {
      event = JSON.parse(rawBody);
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    // Retrieve the event ID from headers to ensure idempotency
    const eventId = request.headers.get('x-razorpay-event-id');

    if (!eventId) {
      return NextResponse.json({ error: 'Missing event ID header.' }, { status: 400 });
    }

    await connectToDatabase();

    // Check if this event has already been processed
    const existingEvent = await ProcessedEvent.findOne({ provider: 'razorpay', eventId });
    if (existingEvent) {
      return NextResponse.json({ message: 'Duplicate event. Already processed.' }, { status: 200 });
    }

    // Handle only relevant events
    if (['payment.captured', 'payment.failed'].includes(event.event)) {
      const payment = event.payload.payment.entity;
      const razorpayOrderId = payment.order_id;
      const paymentId = payment.id;
      const signatureDetail = payment.signature || '';

      // Extract internalOrderId from notes
      const internalOrderId = payment.notes.orderId;

      if (!internalOrderId) {
        return NextResponse.json({ error: 'Missing internal order ID in payment notes.' }, { status: 400 });
      }

      // Start a MongoDB session for transaction
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Find the order by the internalOrderId
        const order = await Order.findById(internalOrderId)
          .populate('paymentDetails.mode')
          .session(session);

        if (!order) {
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
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
        if (order.paymentDetails.razorpayDetails.paymentId === paymentId) {
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json(
            { message: 'Payment already captured. Ignoring webhook.' },
            { status: 200 }
          );
        }

        // Process the payment based on the event type
        if (event.event === 'payment.captured') {
          const paymentAmount = payment.amount / 100; // Convert paise to INR

          order.paymentDetails.razorpayDetails.paymentId = paymentId;
          order.paymentDetails.razorpayDetails.signature = signatureDetail;
          order.paymentDetails.amountPaidOnline += paymentAmount;
          order.paymentDetails.amountDueOnline -= paymentAmount;

          // Update paymentStatus based on remaining dues
          if (
            order.paymentDetails.amountDueOnline <= 0 &&
            order.paymentDetails.amountDueCod <= 0
          ) {
            order.paymentStatus = 'allPaid';
          } else if (
            order.paymentDetails.amountPaidOnline > 0 &&
            order.paymentDetails.amountDueCod > 0
          ) {
            order.paymentStatus = 'paidPartially';
          }
        }

        if (event.event === 'payment.failed') {
          order.paymentStatus = 'failed';
          // Additional logic for failed payments can be implemented here
        }

        // Save the updated order
        await order.save({ session });

        // Create Shiprocket Order if payment is complete or partially complete
        if (
          event.event === 'payment.captured' &&
          ['allPaid', 'paidPartially'].includes(order.paymentStatus)
        ) {
          if (!order.shiprocketOrderId && order.deliveryStatus === 'pending') {
            let dimensionsAndWeight;
            try {
              dimensionsAndWeight = await getDimensionsAndWeight(order.items);
            } catch (dimError) {
              // If dimension calculation fails, abort the transaction
              await session.abortTransaction();
              session.endSession();
              return NextResponse.json(
                { error: dimError.message },
                { status: 400 }
              );
            }

            const { length, breadth, height, weight } = dimensionsAndWeight;

            const [firstName, ...lastNameParts] = order.address.receiverName.split(' ');
            const lastName = lastNameParts.join(' ');

            const shiprocketOrderData = {
              order_id: internalOrderId, // Use internal MongoDB order ID
              order_date: new Date().toISOString().split('T')[0],
              billing_customer_name: firstName,
              billing_last_name: lastName || '', // Handle single name scenarios
              billing_address: `${order.address.addressLine1} ${
                order.address.addressLine2 || ''
              }`,
              billing_city: order.address.city,
              billing_pincode: order.address.pincode,
              billing_state: order.address.state,
              billing_country: order.address.country,
              billing_phone: order.address.receiverPhoneNumber,
              shipping_is_billing: true,
              order_items: order.items.map((item) => ({
                name: item.name,
                sku: item.sku, // Use SKU from order item
                units: item.quantity,
                selling_price: item.priceAtPurchase,
              })),
              payment_method:
                order.paymentDetails.amountDueCod > 0 ? 'COD' : 'Prepaid',
              sub_total:
                order.paymentDetails.amountDueCod > 0
                  ? order.paymentDetails.amountDueCod
                  : order.paymentDetails.amountPaidOnline,
              length: length,
              breadth: breadth,
              height: height,
              weight: weight,
            };

            try {
              // Create the Shiprocket order
              const response = await createShiprocketOrder(shiprocketOrderData);

              if (response.success) {
                order.shiprocketOrderId = response.order_id;
                order.deliveryStatus = 'orderCreated';
                await order.save({ session });
              } else {
                // If Shiprocket order creation fails, abort the transaction
                await session.abortTransaction();
                session.endSession();
                return NextResponse.json(
                  { error: 'Failed to create Shiprocket order.' },
                  { status: 500 }
                );
              }
            } catch (shiprocketError) {
              // On error, abort the transaction
              await session.abortTransaction();
              session.endSession();
              console.error('Shiprocket Order Creation Error:', shiprocketError);
              return NextResponse.json(
                { error: 'Failed to create Shiprocket order.' },
                { status: 500 }
              );
            }
          }
        }

        // Log the processed event to prevent duplicate processing
        const processedEvent = new ProcessedEvent({
          provider: 'razorpay',
          eventId,
          eventType: event.event,
          resourceId: payment.id,
        });
        await processedEvent.save({ session });

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        return NextResponse.json({ message: 'Webhook handled successfully.' }, { status: 200 });
      } catch (err) {
        // On any transaction error, abort the transaction
        await session.abortTransaction();
        session.endSession();
        console.error('Transaction error:', err);
        return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
      }
    }

    // If the event type is not handled, respond with a 200 status
    return NextResponse.json({ message: 'Event type not handled.' }, { status: 200 });
  } catch (error) {
    // Handle any unexpected errors
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
