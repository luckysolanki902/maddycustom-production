// app/api/webhooks/razorpay/verify-payment/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import Coupon from '@/models/Coupon';
import User from '@/models/User';
import { createShiprocketOrder, getDimensionsAndWeight } from '@/lib/utils/shiprocket';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Product from '@/models/Product';
import Option from '@/models/Option';
import Inventory from '@/models/Inventory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import SpecificCategory from '@/models/SpecificCategory';

// Helper: Update inventory for a given Inventory document _id
async function updateInventory(inventoryId, delta, session) {
  const result = await mongoose.model('Inventory').updateOne(
    { _id: inventoryId },
    {
      $inc: {
        availableQuantity: delta,
        reservedQuantity: -delta,
      },
    },
    { session }
  );
  return result;
}

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
    // 3. Find the Order
    // -----------------------------
    const order = await Order.findById(internalOrderId).session(session);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

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
    // 4. Handle Payment Updates
    // -----------------------------
    if (razorpayEvent === 'payment.captured') {
      if (['pending', 'failed'].includes(order.paymentStatus)) {
        const paymentAmount = payment.amount / 100; // convert paise -> INR

        // Update order with payment details
        order.paymentDetails.razorpayDetails.paymentId = paymentId;
        order.paymentDetails.razorpayDetails.signature = signatureDetail;
        order.paymentDetails.amountPaidOnline += paymentAmount;
        order.paymentDetails.amountDueOnline = Math.max(
          0,
          order.paymentDetails.amountDueOnline - paymentAmount
        );

        // Determine final payment status
        if (
          order.paymentDetails.amountDueOnline <= 0 &&
          order.paymentDetails.amountDueCod <= 0
        ) {
          order.paymentStatus = 'allPaid';
          logs.push(`[${timestampStr}] Payment status -> allPaid`);
        } else if (
          order.paymentDetails.amountPaidOnline > 0 &&
          order.paymentDetails.amountDueCod > 0
        ) {
          order.paymentStatus = 'paidPartially';
          logs.push(`[${timestampStr}] Payment status -> paidPartially`);
        }

        // Check/increment coupon usage if applicable
        if (order.couponApplied?.length > 0) {
          const [appliedCoupon] = order.couponApplied;
          if (appliedCoupon.couponCode && !appliedCoupon.incrementedCouponUsage) {
            const couponDoc = await Coupon.findOne({ code: appliedCoupon.couponCode }).session(session);
            if (couponDoc) {
              couponDoc.usageCount += 1;
              await couponDoc.save({ session });
              appliedCoupon.incrementedCouponUsage = true;
              order.couponApplied = order.couponApplied.map(c =>
                c.couponCode === appliedCoupon.couponCode
                  ? { ...c.toObject(), incrementedCouponUsage: true }
                  : c
              );
              logs.push(`[${timestampStr}] Coupon usage incremented: ${appliedCoupon.couponCode}`);
            }
          }
        }
        await order.save({ session });
      } else {
        logs.push(`[${timestampStr}] payment.captured received but order already in ${order.paymentStatus}.`);
      }

      // 4a. Deduct inventory (only once)
      if (
        (order.paymentStatus === 'paidPartially' || order.paymentStatus === 'allPaid') &&
        !order.inventoryDeducted && // ensure we don't deduct twice
        !order.isTestingOrder // skip for test orders
      ) {
        logs.push(`[${timestampStr}] Deducting inventory for order ${order._id}`);
        // Use a fixed delta of -1 per unit purchased.
        const unitDelta = -1;

        for (const item of order.items) {
          if (item.option) {
            // Use Option's inventoryData if present
            logs.push(`Updating inventory for Option ${item.option} x ${item.quantity}`);
            const optionDoc = await Option.findById(item.option).session(session);
            if (optionDoc?.inventoryData) {
              await updateInventory(optionDoc.inventoryData, unitDelta * item.quantity, session);
            } else {
              logs.push(`Option ${item.option} has no inventoryData reference. Cannot update inventory.`);
            }
          } else if (item.product) {
            // Otherwise, update Product's inventoryData
            logs.push(`Updating inventory for Product ${item.product} x ${item.quantity}`);
            const productDoc = await Product.findById(item.product).session(session);
            if (productDoc?.inventoryData) {
              await updateInventory(productDoc.inventoryData, unitDelta * item.quantity, session);
            } else {
              logs.push(`No inventoryData reference found on product ${item.product}. Cannot update inventory.`);
            }
          } else {
            logs.push(`Order item does not have an option or product reference. Skipping. ${JSON.stringify(item)}`);
          }
        }
        // Mark inventory as deducted
        order.inventoryDeducted = true;
        await order.save({ session });
      }
    } else if (razorpayEvent === 'payment.failed') {
      if (!['allPaid', 'paidPartially', 'failed'].includes(order.paymentStatus)) {
        order.paymentStatus = 'failed';
        order.paymentDetails.razorpayDetails.paymentId = paymentId;
        logs.push(`[${timestampStr}] Payment status -> failed`);

        await order.save({ session });
        await session.commitTransaction();
        session.endSession();
        return NextResponse.json({ message: 'Payment failed.' }, { status: 200 });
      } else {
        logs.push(`[${timestampStr}] payment.failed received but order already in ${order.paymentStatus}.`);
      }
    }

    // -----------------------------
    // 5. Possibly Create Shiprocket Order
    // -----------------------------
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

    if (
      ['allPaid', 'paidPartially'].includes(latestOrder.paymentStatus) &&
      latestOrder.deliveryStatus === 'pending' &&
      !latestOrder.shiprocketOrderId &&
      !latestOrder.isTestingOrder
    ) {
      logs.push(`[${timestampStr}] Attempting to create Shiprocket order for ID: ${internalOrderId}`);
      let dimensionsAndWeight;
      try {
        dimensionsAndWeight = await getDimensionsAndWeight(latestOrder.items);
      } catch (dimError) {
        console.error(`Dimension calculation error for order ${internalOrderId}:`, dimError);
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ error: dimError.message }, { status: 400 });
      }

      const { length, breadth, height, weight } = dimensionsAndWeight;
      console.log({ length, breadth, height, weight }, 'for orderId:', internalOrderId);
      const [firstName, ...restName] = latestOrder.address.receiverName.split(' ');
      const lastName = restName.join(' ');

      const shiprocketOrderData = {
        order_id: internalOrderId.toString(),
        order_date: new Date().toISOString(),
        billing_customer_name: firstName,
        billing_last_name: lastName || '',
        billing_address: `${latestOrder.address.addressLine1} ${latestOrder.address.addressLine2 || ''}`,
        billing_city: latestOrder.address.city,
        billing_pincode: latestOrder.address.pincode,
        billing_state: latestOrder.address.state,
        billing_country: latestOrder.address.country,
        billing_phone: latestOrder.address.receiverPhoneNumber,
        shipping_is_billing: true,
        order_items: latestOrder.items.map(item => ({
          name: item.name,
          sku: item.sku,
          units: item.quantity,
          selling_price: item.priceAtPurchase,
        })),
        payment_method: latestOrder.paymentDetails.amountDueCod > 0 ? 'COD' : 'Prepaid',
        sub_total: latestOrder.paymentDetails.amountDueCod > 0
          ? latestOrder.paymentDetails.amountDueCod
          : latestOrder.totalAmount,
        length,
        breadth,
        height,
        weight,
      };

      try {
        const srResponse = await createShiprocketOrder(shiprocketOrderData);
        if (srResponse.status_code === 1 && !srResponse.packaging_box_error) {
          await Order.findByIdAndUpdate(
            latestOrder._id,
            {
              shiprocketOrderId: srResponse.order_id,
              deliveryStatus: 'orderCreated',
            },
            { session }
          );
          logs.push(`[${timestampStr}] Shiprocket order created: ${srResponse.order_id}`);
        } else {
          console.error(`Shiprocket API error for order ${internalOrderId}:`, srResponse);
          logs.push(`[${timestampStr}] Shiprocket creation failed: packaging_box_error or invalid`);
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json({ error: 'Failed to create Shiprocket order.' }, { status: 500 });
        }
      } catch (err) {
        console.error(`Shiprocket API call failed for order ${internalOrderId}:`, err);
        logs.push(`[${timestampStr}] Shiprocket API call failed.`);
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ error: 'Error in Shiprocket order creation.' }, { status: 500 });
      }
    } else {
      let reason = 'unknown reason';
      if (!['allPaid', 'paidPartially'].includes(latestOrder.paymentStatus)) {
        reason = 'paymentStatus is not successful';
      } else if (latestOrder.deliveryStatus !== 'pending') {
        reason = 'deliveryStatus is not pending';
      } else if (latestOrder.shiprocketOrderId) {
        reason = 'shiprocketOrderId already exists';
      } else if (latestOrder.isTestingOrder) {
        reason = 'isTestingOrder = true';
      }
      logs.push(`[${timestampStr}] Skipping Shiprocket creation due to: ${reason}`);
    }

    // -----------------------------
    // 6. Commit Transaction
    // -----------------------------
    await session.commitTransaction();
    session.endSession();

    // -----------------------------
    // 7. Send WhatsApp Notification (Async)
    // -----------------------------
    try {
      if (!latestOrder.isTestingOrder) {
        const userDoc = await User.findById(latestOrder.user);
        if (userDoc) {
          const buttons = [
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [
                {
                  type: 'text',
                  text: latestOrder._id?.toString() || 'Order ID',
                },
              ],
            },
          ];
          await sendWhatsAppMessage({
            user: userDoc,
            prefUserName: latestOrder.address.receiverName || '',
            campaignName:
              new Date().getTime() < new Date('2025-04-03T00:00:00.000Z').getTime()
                ? 'delay_eid'
                : 'order_confirmed',
            orderId: latestOrder._id,
            templateParams: [],
            carouselCards: [],
            buttons,
          });
          logs.push(`[${timestampStr}] WhatsApp message sent to user: ${userDoc._id}`);
        } else {
          logs.push(`[${timestampStr}] No matching user found for orderId: ${latestOrder._id}`);
        }
      } else {
        logs.push(`[${timestampStr}] Skipping WhatsApp message (isTestingOrder = true).`);
      }
    } catch (msgErr) {
      console.error(`WhatsApp message failed for order ${latestOrder._id}:`, msgErr);
      logs.push(`[${timestampStr}] WhatsApp message sending failed (error logged).`);
    }

    console.info(`Webhook processed successfully for orderId: ${internalOrderId}`, logs);
    return NextResponse.json(
      { message: `Webhook processed successfully for orderId: ${internalOrderId}`, logs },
      { status: 200 }
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(`Error processing Razorpay webhook for orderId ${internalOrderId}`, err, logs);
    return NextResponse.json(
      { error: `Internal error for orderId: ${internalOrderId}`, logs },
      { status: 500 }
    );
  }
}
