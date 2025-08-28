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

        // Handle coupon usage increment (only once for the main order)
        const mainOrder = allOrders.find(ord => ord.isMainOrder) || allOrders[0];
        if (mainOrder.couponApplied?.length > 0) {
          const [appliedCoupon] = mainOrder.couponApplied;
          if (appliedCoupon.couponCode && !appliedCoupon.incrementedCouponUsage) {
            const couponDoc = await Coupon.findOne({ code: appliedCoupon.couponCode }).session(session);
            if (couponDoc) {
              couponDoc.usageCount += 1;
              await couponDoc.save({ session });
              
              // Update coupon increment status in all orders
              for (const ord of allOrders) {
                if (ord.couponApplied?.length > 0) {
                  ord.couponApplied = ord.couponApplied.map(c =>
                    c.couponCode === appliedCoupon.couponCode
                      ? { ...c.toObject(), incrementedCouponUsage: true }
                      : c
                  );
                  await ord.save({ session });
                }
              }
              logs.push(`[${timestampStr}] Coupon usage incremented: ${appliedCoupon.couponCode}`);
            }
          }
        }
      } else {
        logs.push(`[${timestampStr}] payment.captured received but order group already processed or not pending.`);
      }

      // 4a. Deduct inventory for each order individually
      for (const ord of allOrders) {
        if (
          (ord.paymentStatus === 'paidPartially' || ord.paymentStatus === 'allPaid') &&
          !ord.inventoryDeducted && // ensure we don't deduct twice
          !ord.isTestingOrder // skip for test orders
        ) {
          logs.push(`[${timestampStr}] Deducting inventory for order ${ord._id}`);
          const unitDelta = -1;

          for (const item of ord.items) {
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
          // Mark inventory as deducted for this order
          ord.inventoryDeducted = true;
          await ord.save({ session });
        }
      }
    } else if (razorpayEvent === 'payment.failed') {
      // Update payment status for all orders with pending payments
      let anyUpdated = false;
      for (const ord of allOrders) {
        if (!['allPaid', 'paidPartially', 'failed'].includes(ord.paymentStatus)) {
          ord.paymentStatus = 'failed';
          ord.paymentDetails.razorpayDetails.paymentId = paymentId;
          logs.push(`[${timestampStr}] Order ${ord._id} status -> failed`);
          await ord.save({ session });
          anyUpdated = true;
        }
      }

      if (anyUpdated) {
        await session.commitTransaction();
        session.endSession();
        return NextResponse.json({ message: 'Payment failed.' }, { status: 200 });
      } else {
        logs.push(`[${timestampStr}] payment.failed received but order group already processed.`);
      }
    }

    // -----------------------------
    // 5. Create Shiprocket Orders for Each Eligible Order
    // -----------------------------
    // Get updated order data for all orders
    const updatedAllOrders = await Promise.all(
      allOrders.map(ord => 
        Order.findById(ord._id)
          .populate({
            path: 'items.product',
            populate: {
              path: 'specificCategoryVariant',
              model: 'SpecificCategoryVariant',
            },
          })
          .session(session)
      )
    );

    // Process each order for Shiprocket creation
    for (const ord of updatedAllOrders) {
      if (
        ['allPaid', 'paidPartially'].includes(ord.paymentStatus) &&
        ord.deliveryStatus === 'pending' &&
        !ord.shiprocketOrderId &&
        !ord.isTestingOrder
      ) {
        logs.push(`[${timestampStr}] Attempting to create Shiprocket order for ID: ${ord._id}`);
        
        try {
          const dimensionsAndWeight = await getDimensionsAndWeight(ord.items);
          const { length, breadth, height, weight } = dimensionsAndWeight;
          
          const [firstName, ...restName] = ord.address.receiverName.split(' ');
          const lastName = restName.join(' ');

          const shiprocketOrderData = {
            order_id: ord._id.toString(),
            order_date: new Date().toISOString(),
            billing_customer_name: firstName,
            billing_last_name: lastName || '',
            billing_address: `${ord.address.addressLine1} ${ord.address.addressLine2 || ''}`,
            billing_city: ord.address.city,
            billing_pincode: ord.address.pincode,
            billing_state: ord.address.state,
            billing_country: ord.address.country,
            billing_phone: ord.address.receiverPhoneNumber,
            shipping_is_billing: true,
            order_items: ord.items.map(item => ({
              name: item.name,
              sku: item.wrapFinish ? `${item.sku}-${item.wrapFinish.charAt(0).toLowerCase()}` : item.sku,
              units: item.quantity,
              selling_price: item.priceAtPurchase,
            })),
            payment_method: ord.paymentDetails.amountDueCod > 0 ? 'COD' : 'Prepaid',
            sub_total: ord.paymentDetails.amountDueCod > 0
              ? ord.paymentDetails.amountDueCod
              : ord.totalAmount,
            length,
            breadth,
            height,
            weight,
          };

          const srResponse = await createShiprocketOrder(shiprocketOrderData);
          if (srResponse.status_code === 1 && !srResponse.packaging_box_error) {
            await Order.findByIdAndUpdate(
              ord._id,
              {
                shiprocketOrderId: srResponse.order_id,
                deliveryStatus: 'orderCreated',
              },
              { session }
            );
            logs.push(`[${timestampStr}] Shiprocket order created for ${ord._id}: ${srResponse.order_id}`);
          } else {
            console.error(`Shiprocket API error for order ${ord._id}:`, srResponse);
            logs.push(`[${timestampStr}] Shiprocket creation failed for order ${ord._id}: packaging_box_error or invalid`);
            // Continue with other orders even if one fails
          }
        } catch (err) {
          console.error(`Shiprocket creation error for order ${ord._id}:`, err);
          logs.push(`[${timestampStr}] Shiprocket creation failed for order ${ord._id}: ${err.message}`);
          // Continue with other orders even if one fails
        }
      } else {
        let reason = 'unknown reason';
        if (!['allPaid', 'paidPartially'].includes(ord.paymentStatus)) {
          reason = 'paymentStatus is not successful';
        } else if (ord.deliveryStatus !== 'pending') {
          reason = 'deliveryStatus is not pending';
        } else if (ord.shiprocketOrderId) {
          reason = 'shiprocketOrderId already exists';
        } else if (ord.isTestingOrder) {
          reason = 'isTestingOrder flag is true';
        }
        logs.push(`[${timestampStr}] Skipping Shiprocket for order ${ord._id}: ${reason}`);
      }
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
      // Use the main order for WhatsApp notification
      const mainOrder = updatedAllOrders.find(ord => ord.isMainOrder) || updatedAllOrders[0];
      
      if (!mainOrder.isTestingOrder) {
        const userDoc = await User.findById(mainOrder.user);
        if (userDoc) {
          const buttons = [
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [
                {
                  type: 'text',
                  text: mainOrder._id?.toString() || 'Order ID',
                },
              ],
            },
          ];
          await sendWhatsAppMessage({
            user: userDoc,
            prefUserName: mainOrder.address.receiverName || '',
            campaignName:
              new Date().getTime() < new Date('2025-04-03T00:00:00.000Z').getTime()
                ? 'delay_eid'
                : 'order_confirmed',
            orderId: mainOrder._id,
            templateParams: [],
            carouselCards: [],
            buttons,
          });
          logs.push(`[${timestampStr}] WhatsApp message sent to user: ${userDoc._id}`);
        } else {
          logs.push(`[${timestampStr}] No matching user found for orderId: ${mainOrder._id}`);
        }
      } else {
        logs.push(`[${timestampStr}] Skipping WhatsApp message (isTestingOrder = true).`);
      }
    } catch (msgErr) {
      const mainOrder = updatedAllOrders.find(ord => ord.isMainOrder) || updatedAllOrders[0];
      console.error(`WhatsApp message failed for order ${mainOrder._id}:`, msgErr);
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
