// app/api/webhooks/razorpay/verify-payment/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { handlePaymentSuccess, sendPaymentSuccessWhatsApp } from '@/lib/payments/handlePaymentSuccess';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('RazorpayWebhook');

// Disable body parsing to access raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Razorpay Webhook Handler
 * 1. Verifies Razorpay signature
 * 2. Updates order payment status (self-correcting if needed)
 * 3. Deducts inventory (idempotent) if a payment is captured
 *    - If an order item has an "option" reference, use that Option’s inventoryData.
 *    - Otherwise, use the Product’s inventoryData.
 * 4. Creates Shiprocket order if conditions are met
 * 5. Commits transaction
 * 6. Sends WhatsApp notification after the transaction
 */
export async function POST(request) {
  await connectToDatabase();
  const session = await mongoose.startSession();
  session.startTransaction();

  const logs = []; // Collect logs for debugging
  let internalOrderId = null;

  try {
    // -----------------------------
    // 1. Verify Razorpay Signature
    // -----------------------------
    const rawBody = await request.text();
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('No RAZORPAY_WEBHOOK_SECRET set in environment.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const signature = request.headers.get('x-razorpay-signature');
    const eventId = request.headers.get('x-razorpay-event-id');
    if (!signature || !eventId) {
      return NextResponse.json(
        { error: 'Missing x-razorpay-signature or x-razorpay-event-id header.' },
        { status: 400 }
      );
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const receivedSigBuf = Buffer.from(signature, 'hex');
    const expectedSigBuf = Buffer.from(expectedSignature, 'hex');
    if (
      receivedSigBuf.length !== expectedSigBuf.length ||
      !crypto.timingSafeEqual(receivedSigBuf, expectedSigBuf)
    ) {
      return NextResponse.json({ error: 'Invalid Razorpay signature.' }, { status: 400 });
    }

    // -----------------------------
    // 2. Parse the Razorpay Event
    // -----------------------------
    let eventData;
    try {
      eventData = JSON.parse(rawBody);
    } catch (err) {
      console.error('Invalid JSON in Razorpay webhook payload:', err);
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const razorpayEvent = eventData?.event;
    if (!['payment.captured', 'payment.failed'].includes(razorpayEvent)) {
      logs.push(`Unhandled Razorpay event type: ${razorpayEvent}`);
      return NextResponse.json({ message: 'Event type not handled.' }, { status: 200 });
    }

    const payment = eventData.payload.payment?.entity;
    if (!payment) {
      return NextResponse.json({ error: 'No payment data in event.' }, { status: 400 });
    }

    const paymentId = payment.id;
    const signatureDetail = payment.signature || '';
    internalOrderId = payment.notes?.orderId;
    if (!internalOrderId) {
      logs.push('Missing internalOrderId in Razorpay payment notes.');
      return NextResponse.json({ error: 'No internal order ID.' }, { status: 400 });
    }

    // -----------------------------
    // 3. Find the Order and Linked Orders
    // -----------------------------
    const order = await Order.findById(internalOrderId).session(session);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Get all linked orders for processing
    const linkedOrders = order.linkedOrderIds.length > 0 
      ? await Order.find({ _id: { $in: order.linkedOrderIds } }).session(session)
      : [];
    
    const allOrders = [order, ...linkedOrders];
    logs.push(`Processing ${allOrders.length} orders (main + ${linkedOrders.length} linked)`);

    const timestampStr = new Date().toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });

    // -----------------------------
    // 4. Handle Payment Updates for All Orders
    // -----------------------------
    if (razorpayEvent === 'payment.captured') {
      // Check if any order in the group is already processed
      const alreadyProcessed = allOrders.some(ord => 
        ['allPaid', 'paidPartially'].includes(ord.paymentStatus)
      );

      if (!alreadyProcessed && allOrders.some(ord => ord.paymentStatus === 'pending' || ord.paymentStatus === 'failed')) {
        const paymentAmount = payment.amount / 100; // convert paise -> INR
        logs.push(`[${timestampStr}] Processing payment capture for ${allOrders.length} orders`);
        logger.info('Processing payment capture', {
          orderCount: allOrders.length,
          paymentId,
          paymentAmount,
        });

        // Update payment details for all orders with online payment due
        for (const ord of allOrders) {
          if (ord.paymentDetails.amountDueOnline > 0) {
            ord.paymentDetails.razorpayDetails.paymentId = paymentId;
            ord.paymentDetails.razorpayDetails.signature = signatureDetail;
            ord.paymentDetails.amountPaidOnline += ord.paymentDetails.amountDueOnline;
            ord.paymentDetails.amountDueOnline = 0;

            // Determine final payment status for this order
            if (ord.paymentDetails.amountDueCod <= 0) {
              ord.paymentStatus = 'allPaid';
              logs.push(`[${timestampStr}] Order ${ord._id} status -> allPaid`);
            } else {
              ord.paymentStatus = 'paidPartially';
              logs.push(`[${timestampStr}] Order ${ord._id} status -> paidPartially`);
            }

            await ord.save({ session });
          }
        }

        // Use centralized payment success handler
        logs.push(`[${timestampStr}] Calling centralized payment success handler`);
        logger.info('Invoking centralized handler', {
          orderCount: allOrders.length,
          paymentProvider: 'razorpay',
        });
        
        const handlerResult = await handlePaymentSuccess(allOrders, session, {
          paymentProvider: 'razorpay',
        });
        
        logs.push(...handlerResult.logs);
        logger.info('Centralized handler completed', {
          success: handlerResult.success,
          mainOrderId: handlerResult.mainOrderId,
        });
      } else {
        logs.push(`[${timestampStr}] payment.captured received but order group already processed or not pending.`);
        logger.info('Payment already processed', {
          orderIds: allOrders.map(o => o._id.toString()),
        });
      }
    } else if (razorpayEvent === 'payment.failed') {
      // Update payment status for all orders with pending payments
      let anyUpdated = false;
      for (const ord of allOrders) {
        if (!['allPaid', 'paidPartially', 'failed'].includes(ord.paymentStatus)) {
          ord.paymentStatus = 'failed';
          ord.paymentDetails.razorpayDetails.paymentId = paymentId;
          logs.push(`[${timestampStr}] Order ${ord._id} status -> failed`);
          logger.info('Order marked as failed', {
            orderId: ord._id.toString(),
            paymentId,
          });
          await ord.save({ session });
          anyUpdated = true;
        }
      }

      if (anyUpdated) {
        await session.commitTransaction();
        session.endSession();
        logger.info('Payment failure processed', {
          orderIds: allOrders.map(o => o._id.toString()),
        });
        return NextResponse.json({ message: 'Payment failed.' }, { status: 200 });
      } else {
        logs.push(`[${timestampStr}] payment.failed received but order group already processed.`);
        logger.info('Payment failure already processed', {
          orderIds: allOrders.map(o => o._id.toString()),
        });
      }
    }

    // -----------------------------
    // 6. Commit Transaction
    // -----------------------------
    await session.commitTransaction();
    session.endSession();
    logger.info('Transaction committed successfully', {
      orderIds: allOrders.map(o => o._id.toString()),
    });

    // -----------------------------
    // 7. Send WhatsApp Notification (After Transaction)
    // -----------------------------
    try {
      // Get updated main order with populated user
      const mainOrder = allOrders.find(ord => ord.isMainOrder) || allOrders[0];
      const populatedMainOrder = await Order.findById(mainOrder._id).populate('user');
      
      const whatsappLogs = await sendPaymentSuccessWhatsApp(populatedMainOrder);
      logs.push(...whatsappLogs);
    } catch (whatsappError) {
      logs.push(`[${timestampStr}] WhatsApp notification error: ${whatsappError.message}`);
      logger.error('WhatsApp notification failed', {
        error: whatsappError.message,
        orderId: internalOrderId,
      });
    }

    logger.info('Webhook processed successfully', {
      orderId: internalOrderId,
      orderCount: allOrders.length,
    });
    console.info(`Webhook processed successfully for orderId: ${internalOrderId}`, logs);
    return NextResponse.json(
      { message: `Webhook processed successfully for orderId: ${internalOrderId}`, logs },
      { status: 200 }
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Webhook processing failed', {
      error: err.message,
      stack: err.stack,
      orderId: internalOrderId,
    });
    console.error(`Error processing Razorpay webhook for orderId ${internalOrderId}`, err, logs);
    return NextResponse.json(
      { error: `Internal error for orderId: ${internalOrderId}`, logs },
      { status: 500 }
    );
  }
}
