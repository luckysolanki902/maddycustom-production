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
  await connectToDatabase();
  const session = await mongoose.startSession();
  session.startTransaction();

  let internalOrderId; // We'll store it for logging & use after commit
  const eventsOccured = []
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
      return NextResponse.json({ error: 'Invalid signature length.' }, { status: 400 });
    }
    const isValidSignature = crypto.timingSafeEqual(
      receivedSignatureBuffer,
      expectedSignatureBuffer
    );
    if (!isValidSignature) {
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
      return NextResponse.json({ message: 'Event type not handled.' }, { status: 200 });
    }

    

    const payment = event.payload.payment.entity;
    const paymentId = payment.id;
    const signatureDetail = payment.signature || '';
    internalOrderId = payment.notes?.orderId;

    if (!internalOrderId) {
      eventsOccured.push('No internalOrderId in payment notes');
      return NextResponse.json({ error: 'Missing internal order ID in payment notes.' }, { status: 400 });
    }

    // --- 3. Find the Order ---
    const order = await Order.findById(internalOrderId).session(session);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // --- 4. Handle Payment Updates ---
    if (order.paymentDetails.razorpayDetails.paymentId === paymentId) {
      eventsOccured.push('Payment status already found to be updated. Logged at', new Date().toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }));
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
            eventsOccured.push(
              `Payment status set to all paid at ${new Date().toLocaleString('en-IN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
                timeZone: 'Asia/Kolkata',
              })}`
            )
          } else if (
            updatedOrder.paymentDetails.amountPaidOnline > 0 &&
            updatedOrder.paymentDetails.amountDueCod > 0
          ) {
            updatedOrder.paymentStatus = 'paidPartially';
            eventsOccured.push(
              `Payment status set to partially paid at ${new Date().toLocaleString('en-IN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
                timeZone: 'Asia/Kolkata',
              })}`
            )
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
          eventsOccured.push(
            `Payment status set to failed at ${new Date().toLocaleString('en-IN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
              timeZone: 'Asia/Kolkata',
            })}`
          )
          await session.commitTransaction();
          session.endSession();
          return NextResponse.json({ message: 'Payment failed.' }, { status: 200 });
        }
      } else {

        eventsOccured.push(
          `Payment status was already found as ${order.paymentStatus} at ${new Date().toLocaleString('en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata',
          })}`
        )
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
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ error: 'Order not found after update.' }, { status: 404 });
    }

    // Check conditions: paidPartially or allPaid, deliveryStatus = pending, no shiprocketOrderId
    if (
      ['allPaid', 'paidPartially'].includes(latestOrder.paymentStatus) &&
      latestOrder.deliveryStatus === 'pending' &&
      !latestOrder.shiprocketOrderId && !latestOrder.isTestingOrder
    ) {
      console.debug('Creating Shiprocket order for order ' + internalOrderId);
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
        billing_address: `${latestOrder.address.addressLine1} ${latestOrder.address.addressLine2 || ''
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
          eventsOccured.push(
            `Shiprocket order created at ${new Date().toLocaleString('en-IN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
              timeZone: 'Asia/Kolkata',
            })}`
          )
        } else {
          console.error('Shiprocket error ' + internalOrderId, response);
          eventsOccured.push(
            `Shiprocket api error possibly due to package_box_error at ${new Date().toLocaleString('en-IN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
              timeZone: 'Asia/Kolkata',
            })}`
          )
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json({ error: 'Failed to create Shiprocket order.' }, { status: 500 });
        }
      } catch (shiprocketError) {
        console.error(`Shiprocket API call failed ${internalOrderId}`, shiprocketError);
        eventsOccured.push(
          `Shiprocket API call failed at ${new Date().toLocaleString('en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata',
          })}`
        )
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ error: 'Error in Shiprocket order creation.' }, { status: 500 });
      }
    } else {

      let shiprocketSkppingReason = ''
      if (latestOrder.paymentStatus !== 'allPaid' && latestOrder.paymentStatus !== 'paidPartially') {
        shiprocketSkppingReason = 'paymentStatus not successful'
      } else if (latestOrder.deliveryStatus !== 'pending') {
        shiprocketSkppingReason = 'deliveryStatus not pending'
      } else if (latestOrder.shiprocketOrderId) {
        shiprocketSkppingReason = 'shiprocketOrderId already exists'
      } else if (latestOrder.isTestingOrder) {
        shiprocketSkppingReason = 'isTestingOrder'
      }
      eventsOccured.push(
        `Skipping shiprocket creation due to ${shiprocketSkppingReason} at ${new Date().toLocaleString('en-IN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })}`
      )
    }

    // --- 6. Commit Transaction ---
    await session.commitTransaction();
    session.endSession();


    // --- 7. AFTER Transaction: Attempt to send WhatsApp message (non-blocking for main logic) ---
    // We do this outside the transaction so any AiSensy failure won't affect the order & payment.
    let notSendingWhatsappMessageReason = ''
    try {
      // We need the user doc for phoneNumber & name
      const userDoc = await User.findById(latestOrder.user);
      if (!latestOrder.isTestingOrder) {

        if (userDoc) {
          await sendWhatsAppMessage({
            user: userDoc,
            prefUserName: latestOrder.address.receiverName || '',
            campaignName: 'order_success_first_message_3feb', // as requested
            orderId: latestOrder._id,
            templateParams: [], // Pass any placeholders if needed
            carouselCards: [],  // or pass if needed
          });

          eventsOccured.push(
            `WhatsApp message sent at ${new Date().toLocaleString('en-IN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
              timeZone: 'Asia/Kolkata',
            })}`
          )
        } else {
        }
      } else {
        notSendingWhatsappMessageReason = 'isTestingOrder'
      }
    } catch (msgErr) {
      console.error(`WhatsApp message sending failed for order ${latestOrder._id}:`, msgErr);
      notSendingWhatsappMessageReason = 'some internal error'
      eventsOccured.push(
        `WhatsApp message sending failed due to ${notSendingWhatsappMessageReason} at ${new Date().toLocaleString('en-IN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })}`
      )
    }

    // Return success to Razorpay Webhook
    console.info(`Webhook processed successfully and sent message for orderId: ${internalOrderId}`, eventsOccured);
    return NextResponse.json({ message: `Webhook processed successfully and sent message for orderId: ${internalOrderId}`, eventsOccured }, { status: 200 });
  } catch (error) {
    // If something broke inside the try block, revert transaction
    await session.abortTransaction();
    session.endSession();
    console.error(`Some Internal Server Error occured for orderId: ${internalOrderId}`, error, eventsOccured);
    return NextResponse.json({ error: `Some Internal Server Error occured for orderId: ${internalOrderId}`, eventsOccured }, { status: 500 });
  }
}
