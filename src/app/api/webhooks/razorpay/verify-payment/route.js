// app/api/webhooks/razorpay/verify-payment/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import Coupon from '@/models/Coupon';
import User from '@/models/User'; // Make sure you have this import
import { createShiprocketOrder, getDimensionsAndWeight } from '@/lib/utils/shiprocket';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender'; // The message sending helper
import crypto from 'crypto';
import mongoose from 'mongoose';

// Disable body parsing to access raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Razorpay Webhook Handler
 * - Verifies Razorpay signature
 * - Updates order payment status
 * - Creates Shiprocket order if needed
 * - Commits transaction
 * - Then attempts to send WhatsApp notification (post-transaction)
 */
export async function POST(request) {
  // Start a MongoDB session
  const session = await mongoose.startSession();
  session.startTransaction();

  let internalOrderId; // We'll store it for logging & use after commit

  try {
    // --- 1. Verify Razorpay Signature ---

    const rawBody = await request.text();
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('No RAZORPAY_WEBHOOK_SECRET set.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const signature = request.headers.get('x-razorpay-signature');
    const eventId = request.headers.get('x-razorpay-event-id');
    if (!signature || !eventId) {
      console.log('Missing signature/eventId'); // SHORT LOG
      return NextResponse.json({ error: 'Missing signature or eventId header.' }, { status: 400 });
    }

    // Compute expected signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Perform timing-safe check
    const receivedSignatureBuffer = Buffer.from(signature, 'hex');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');
    if (receivedSignatureBuffer.length !== expectedSignatureBuffer.length) {
      console.log('Invalid signature length');
      return NextResponse.json({ error: 'Invalid signature length.' }, { status: 400 });
    }
    const isValidSignature = crypto.timingSafeEqual(
      receivedSignatureBuffer,
      expectedSignatureBuffer
    );
    if (!isValidSignature) {
      console.log('Signature mismatch');
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
    }

    // --- 2. Parse the Razorpay Event Payload ---
    let event;
    try {
      event = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('Invalid JSON payload.', parseError);
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    // Only handle payment.captured & payment.failed
    if (!['payment.captured', 'payment.failed'].includes(event.event)) {
      console.log('Event not relevant: ' + event.event); // SHORT LOG
      return NextResponse.json({ message: 'Event type not handled.' }, { status: 200 });
    }

    await connectToDatabase();

    const payment = event.payload.payment.entity;
    const paymentId = payment.id;
    const signatureDetail = payment.signature || '';
    internalOrderId = payment.notes?.orderId;

    if (!internalOrderId) {
      console.log('No internalOrderId in payment notes');
      return NextResponse.json({ error: 'Missing internal order ID in payment notes.' }, { status: 400 });
    }

    // --- 3. Find the Order ---
    const order = await Order.findById(internalOrderId).session(session);
    if (!order) {
      console.log('Order not found: ' + internalOrderId);
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // --- 4. Handle Payment Updates ---
    if (order.paymentDetails.razorpayDetails.paymentId === paymentId) {
      console.log(`Order ${internalOrderId} already has paymentId ${paymentId}`);
      // We'll still attempt Shiprocket logic below, in case it wasn't created
    } else {
      if (!['allPaid', 'paidPartially'].includes(order.paymentStatus)) {
        // Payment is still pending or failed, let's update accordingly
        if (event.event === 'payment.captured') {
          const paymentAmount = payment.amount / 100; // from paise to INR

          // Update the order's payment info
          const updatedOrder = await Order.findOneAndUpdate(
            {
              _id: internalOrderId,
              paymentStatus: { $nin: ['allPaid', 'paidPartially'] },
            },
            {
              $set: {
                'paymentDetails.razorpayDetails.paymentId': paymentId,
                'paymentDetails.razorpayDetails.signature': signatureDetail,
              },
              $inc: {
                'paymentDetails.amountPaidOnline': paymentAmount,
                'paymentDetails.amountDueOnline': -paymentAmount,
              },
            },
            { new: true, session }
          );

          if (!updatedOrder) {
            console.log('Order already updated concurrently');
            await session.abortTransaction();
            session.endSession();
            return NextResponse.json({ message: 'Order already updated.' }, { status: 200 });
          }

          // Re-check amounts => update paymentStatus
          if (
            updatedOrder.paymentDetails.amountDueOnline <= 0 &&
            updatedOrder.paymentDetails.amountDueCod <= 0
          ) {
            updatedOrder.paymentStatus = 'allPaid';
          } else if (
            updatedOrder.paymentDetails.amountPaidOnline > 0 &&
            updatedOrder.paymentDetails.amountDueCod > 0
          ) {
            updatedOrder.paymentStatus = 'paidPartially';
          }

          // Check coupon usage
          if (updatedOrder.couponApplied?.length > 0) {
            const appliedCoupon = updatedOrder.couponApplied[0]; // single coupon assumption
            if (appliedCoupon.couponCode && !appliedCoupon.incrementedCouponUsage) {
              const couponDoc = await Coupon.findOne({ code: appliedCoupon.couponCode })
                .session(session);
              if (couponDoc) {
                couponDoc.usageCount += 1;
                await couponDoc.save({ session });

                appliedCoupon.incrementedCouponUsage = true;
                updatedOrder.couponApplied = updatedOrder.couponApplied.map((cpn) =>
                  cpn.couponCode === appliedCoupon.couponCode
                    ? { ...cpn.toObject(), incrementedCouponUsage: true }
                    : cpn
                );
                await updatedOrder.save({ session });
              } else {
                console.log(`Coupon ${appliedCoupon.couponCode} not found`);
              }
            }
          }

          await updatedOrder.save({ session });
        } else if (event.event === 'payment.failed') {
          await Order.findByIdAndUpdate(
            internalOrderId,
            {
              'paymentDetails.razorpayDetails.paymentId': paymentId,
              paymentStatus: 'failed',
            },
            { session }
          );
          console.log('Payment failed for order ' + internalOrderId);
          await session.commitTransaction();
          session.endSession();
          return NextResponse.json({ message: 'Payment failed.' }, { status: 200 });
        }
      } else {
        console.log(
          `Order ${internalOrderId} already has paymentStatus: ${order.paymentStatus}`
        );
      }
    }

    // --- 5. Possibly Create Shiprocket Order ---
    // Re-fetch the order with updated fields
    const latestOrder = await Order.findById(internalOrderId)
      .populate({
        path: 'items.product',
        populate: {
          path: 'specificCategoryVariant',
          model: 'SpecificCategoryVariant',
        },
      })
      .session(session);

    if (!latestOrder) {
      console.log('Order missing after update: ' + internalOrderId);
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ error: 'Order not found after update.' }, { status: 404 });
    }

    // Check conditions: paidPartially or allPaid, deliveryStatus = pending, no shiprocketOrderId
    if (
      ['allPaid', 'paidPartially'].includes(latestOrder.paymentStatus) &&
      latestOrder.deliveryStatus === 'pending' &&
      !latestOrder.shiprocketOrderId
    ) {
      let dimensionsAndWeight;
      try {
        dimensionsAndWeight = await getDimensionsAndWeight(latestOrder.items);
      } catch (dimError) {
        console.error('Dimension error order ' + internalOrderId, dimError);
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ error: dimError.message }, { status: 400 });
      }

      const { length, breadth, height, weight } = dimensionsAndWeight;
      const [firstName, ...lastNameParts] = latestOrder.address.receiverName.split(' ');
      const lastName = lastNameParts.join(' ');

      const shiprocketOrderData = {
        order_id: internalOrderId.toString(),
        order_date: new Date().toISOString(),
        billing_customer_name: firstName,
        billing_last_name: lastName || '',
        billing_address: `${latestOrder.address.addressLine1} ${
          latestOrder.address.addressLine2 || ''
        }`,
        billing_city: latestOrder.address.city,
        billing_pincode: latestOrder.address.pincode,
        billing_state: latestOrder.address.state,
        billing_country: latestOrder.address.country,
        billing_phone: latestOrder.address.receiverPhoneNumber,
        shipping_is_billing: true,
        order_items: latestOrder.items.map((item) => ({
          name: item.name,
          sku: item.sku,
          units: item.quantity,
          selling_price: item.priceAtPurchase,
        })),
        payment_method:
          latestOrder.paymentDetails.amountDueCod > 0 ? 'COD' : 'Prepaid',
        sub_total:
          latestOrder.paymentDetails.amountDueCod > 0
            ? latestOrder.paymentDetails.amountDueCod
            : latestOrder.totalAmount,
        length,
        breadth,
        height,
        weight,
      };

      try {
        const response = await createShiprocketOrder(shiprocketOrderData);
        if (response.status_code === 1 && !response.packaging_box_error) {
          // Update Shiprocket details
          await Order.findByIdAndUpdate(
            latestOrder._id,
            {
              shiprocketOrderId: response.order_id,
              deliveryStatus: 'orderCreated',
            },
            { session }
          );
          console.log(`Shiprocket order created for ${internalOrderId}`);
        } else {
          console.error('Shiprocket error ' + internalOrderId, response);
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json({ error: 'Failed to create Shiprocket order.' }, { status: 500 });
        }
      } catch (shiprocketError) {
        console.error(`Shiprocket API call failed ${internalOrderId}`, shiprocketError);
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ error: 'Error in Shiprocket order creation.' }, { status: 500 });
      }
    } else {
      console.log(
        `Skipping Shiprocket creation: PaymentStatus=${latestOrder.paymentStatus}, ` +
          `deliveryStatus=${latestOrder.deliveryStatus}, shiprocketOrderId=${latestOrder.shiprocketOrderId}`
      );
    }

    // --- 6. Commit Transaction ---
    await session.commitTransaction();
    session.endSession();

    console.log('Webhook processed OK for ' + internalOrderId);

    // --- 7. AFTER Transaction: Attempt to send WhatsApp message (non-blocking for main logic) ---
    // We do this outside the transaction so any AiSensy failure won't affect the order & payment.
    try {
      // We need the user doc for phoneNumber & name
      const userDoc = await User.findById(latestOrder.user);
      if (userDoc) {
        await sendWhatsAppMessage({
          user: userDoc,
          campaignName: 'order_success_first_message_3feb', // as requested
          orderId: latestOrder._id,
          templateParams: [], // Pass any placeholders if needed
          carouselCards: [],  // or pass if needed
        });
      } else {
        console.log(`User not found for order ${latestOrder._id}, skipping message.`);
      }
    } catch (msgErr) {
      console.log(`WhatsApp message sending failed for order ${latestOrder._id}:`, msgErr);
    }

    // Return success to Razorpay
    return NextResponse.json({ message: 'Webhook processed successfully.' }, { status: 200 });
  } catch (error) {
    // If something broke inside the try block, revert transaction
    await session.abortTransaction();
    session.endSession();
    console.error('Webhook error ' + error.message, error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
