import path from 'path';
import { promises as fs } from 'fs';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import Coupon from '@/models/Coupon';
import Product from '@/models/Product';
import Option from '@/models/Option';
import User from '@/models/User';
import mongoose from 'mongoose';
import { createShiprocketOrder, getDimensionsAndWeight } from '@/lib/utils/shiprocket';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender';
import { validatePayuCredentials } from './config';
import { verifyReverseHash } from './hash';
import { PAYU_FAILURE_STATUSES, PAYU_SUCCESS_STATUSES } from './constants';

const SUCCESS_SET = new Set(PAYU_SUCCESS_STATUSES.map((status) => status.toLowerCase()));
const FAILURE_SET = new Set(PAYU_FAILURE_STATUSES.map((status) => status.toLowerCase()));

const PAYU_WEBHOOK_DEBUG_DIR =
  process.env.PAYU_WEBHOOK_DEBUG_DIR ||
  path.join(process.cwd(), 'scripts', 'generated', 'payu-webhook-failures');

const asNumber = (value, fallback = 0) => {
  const numeric = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(numeric)) return fallback;
  return numeric;
};

export function normalisePayuStatus(status, unmappedStatus) {
  const primary = (status || '').toLowerCase();
  const secondary = (unmappedStatus || '').toLowerCase();

  if (SUCCESS_SET.has(primary) || SUCCESS_SET.has(secondary)) return 'success';
  if (FAILURE_SET.has(primary) || FAILURE_SET.has(secondary)) return 'failure';
  if (primary) return primary;
  if (secondary) return secondary;
  return 'pending';
}

function derivePaymentStatus(orderDoc, normalizedStatus) {
  if (normalizedStatus === 'success') {
    const hasCodOutstanding = asNumber(orderDoc?.paymentDetails?.amountDueCod, 0) > 0;
    return hasCodOutstanding ? 'paidPartially' : 'allPaid';
  }
  if (normalizedStatus === 'failure') {
    return 'failed';
  }
  return orderDoc?.paymentStatus || 'pending';
}

export function buildPayuOrderUpdate(orderDoc, payload, normalizedStatus) {
  const baseUpdate = {
    'paymentDetails.payuDetails.status': payload.status || normalizedStatus,
    'paymentDetails.payuDetails.mihpayid': payload.mihpayid || payload.payuid || '',
    'paymentDetails.payuDetails.rawResponse': payload,
  };

  const existingPaidOnline = asNumber(orderDoc?.paymentDetails?.amountPaidOnline, 0);
  const existingDueOnline = asNumber(orderDoc?.paymentDetails?.amountDueOnline, 0);

  let amountPaidOnline = existingPaidOnline;
  let amountDueOnline = existingDueOnline;

  if (normalizedStatus === 'success') {
    amountPaidOnline = existingPaidOnline + existingDueOnline;
    amountDueOnline = 0;
  }

  baseUpdate['paymentDetails.amountPaidOnline'] = amountPaidOnline;
  baseUpdate['paymentDetails.amountDueOnline'] = amountDueOnline;
  baseUpdate.paymentStatus = derivePaymentStatus(orderDoc, normalizedStatus);

  return {
    update: baseUpdate,
    normalizedStatus,
  };
}

async function persistPayuDebugPayload(payload, debugInfo) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const txnIdSafe = (payload?.txnid || payload?.TXNID || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '_');
    const fileName = `${timestamp}-${txnIdSafe}.json`;
    const outputDir = PAYU_WEBHOOK_DEBUG_DIR;

    await fs.mkdir(outputDir, { recursive: true });
    const filePath = path.join(outputDir, fileName);
    await fs.writeFile(
      filePath,
      JSON.stringify({
        createdAt: new Date().toISOString(),
        debugInfo,
        payload,
      }, null, 2),
      'utf8'
    );

    console.info('[PayU webhook] Debug payload persisted', {
      file: path.relative(process.cwd(), filePath),
      txnId: payload?.txnid || payload?.TXNID,
    });
  } catch (err) {
    console.error('[PayU webhook] Failed to persist debug payload', err);
  }
}

function createHashError() {
  const error = new Error('Invalid PayU hash');
  error.code = 'INVALID_HASH';
  return error;
}

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

export async function processPayuGatewayResponse(payload, options = {}) {
  const logs = [];
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

  if (!payload || typeof payload !== 'object') {
    throw new Error('Empty payload received from PayU');
  }

  const { skipHashVerification = false } = options;
  const txnId = payload.txnid || payload.TXNID;
  if (!txnId) {
    throw new Error('Missing PayU transaction id (txnid).');
  }

  if (!skipHashVerification) {
    const { salt } = validatePayuCredentials();
    const isValid = verifyReverseHash(payload, salt);
    if (!isValid) {
      let debugInfo = {
        txnid: payload.txnid || payload.TXNID || null,
        amount: payload.amount || null,
        status: payload.status || null,
        receivedHash: payload.hash || payload.HASH || null,
      };

      try {
        const { generateReverseResponseHash } = require('./hash');
        const computedHash = generateReverseResponseHash(payload, salt);
        debugInfo = { ...debugInfo, computedHash };
        console.error('[PayU] Hash verification failed', debugInfo);
      } catch (dbgErr) {
        console.error('[PayU] Hash debug compute failed', dbgErr);
      }

      await persistPayuDebugPayload(payload, debugInfo);
      throw createHashError();
    }
  }

  await connectToDatabase();
  
  // Start transaction session
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orders = await Order.find({ 'paymentDetails.payuDetails.txnId': txnId }).session(session);
    if (!orders || orders.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return {
        txnId,
        updatedCount: 0,
        normalizedStatus: normalisePayuStatus(payload.status, payload.unmappedstatus),
        primaryOrderId: payload.udf1 || null,
      };
    }

    logs.push(`[${timestampStr}] Processing ${orders.length} orders for txnId: ${txnId}`);

    const normalizedStatus = normalisePayuStatus(payload.status, payload.unmappedstatus);
    logs.push(`[${timestampStr}] Normalized status: ${normalizedStatus}`);

    // Check if already processed
    const alreadyProcessed = orders.some(ord => 
      ['allPaid', 'paidPartially'].includes(ord.paymentStatus)
    );

    if (normalizedStatus === 'success' && !alreadyProcessed) {
      // Update payment details for all orders
      for (const orderDoc of orders) {
        const { update } = buildPayuOrderUpdate(orderDoc, payload, normalizedStatus);
        await Order.findByIdAndUpdate(
          orderDoc._id,
          { $set: update },
          { new: true, session }
        ).exec();
        logs.push(`[${timestampStr}] Order ${orderDoc._id} status -> ${update.paymentStatus}`);
      }

      // Handle coupon usage increment (only once for main order)
      const mainOrder = orders.find(ord => ord.isMainOrder) || orders[0];
      if (mainOrder.couponApplied?.length > 0) {
        const [appliedCoupon] = mainOrder.couponApplied;
        if (appliedCoupon.couponCode && !appliedCoupon.incrementedCouponUsage) {
          const couponDoc = await Coupon.findOne({ code: appliedCoupon.couponCode }).session(session);
          if (couponDoc) {
            couponDoc.usageCount += 1;
            await couponDoc.save({ session });
            
            // Update coupon increment status in all orders
            for (const ord of orders) {
              if (ord.couponApplied?.length > 0) {
                const updated = await Order.findByIdAndUpdate(
                  ord._id,
                  {
                    $set: {
                      'couponApplied.$[elem].incrementedCouponUsage': true
                    }
                  },
                  {
                    arrayFilters: [{ 'elem.couponCode': appliedCoupon.couponCode }],
                    session,
                    new: true
                  }
                );
              }
            }
            logs.push(`[${timestampStr}] Coupon usage incremented: ${appliedCoupon.couponCode}`);
          }
        }
      }

      // Deduct inventory for each order
      for (const ord of orders) {
        const updatedOrd = await Order.findById(ord._id).session(session);
        if (
          (updatedOrd.paymentStatus === 'paidPartially' || updatedOrd.paymentStatus === 'allPaid') &&
          !updatedOrd.inventoryDeducted &&
          !updatedOrd.isTestingOrder
        ) {
          logs.push(`[${timestampStr}] Deducting inventory for order ${updatedOrd._id}`);
          const unitDelta = -1;

          for (const item of updatedOrd.items) {
            if (item.option) {
              logs.push(`Updating inventory for Option ${item.option} x ${item.quantity}`);
              const optionDoc = await Option.findById(item.option).session(session);
              if (optionDoc?.inventoryData) {
                await updateInventory(optionDoc.inventoryData, unitDelta * item.quantity, session);
              } else {
                logs.push(`Option ${item.option} has no inventoryData reference. Cannot update inventory.`);
              }
            } else if (item.product) {
              logs.push(`Updating inventory for Product ${item.product} x ${item.quantity}`);
              const productDoc = await Product.findById(item.product).session(session);
              if (productDoc?.inventoryData) {
                await updateInventory(productDoc.inventoryData, unitDelta * item.quantity, session);
              } else {
                logs.push(`No inventoryData reference found on product ${item.product}. Cannot update inventory.`);
              }
            } else {
              logs.push(`Order item does not have an option or product reference. Skipping.`);
            }
          }
          
          // Mark inventory as deducted
          await Order.findByIdAndUpdate(
            updatedOrd._id,
            { $set: { inventoryDeducted: true } },
            { session }
          );
        }
      }

      // Get updated orders with populated data for Shiprocket
      const updatedAllOrders = await Promise.all(
        orders.map(ord => 
          Order.findById(ord._id)
            .populate({
              path: 'items.product',
              populate: {
                path: 'specificCategoryVariant',
                model: 'SpecificCategoryVariant',
              },
            })
            .populate('user')
            .session(session)
        )
      );

      // Create Shiprocket orders
      for (const ord of updatedAllOrders) {
        if (
          ['allPaid', 'paidPartially'].includes(ord.paymentStatus) &&
          ord.deliveryStatus === 'pending' &&
          !ord.shiprocketOrderId &&
          !ord.isTestingOrder
        ) {
          logs.push(`[${timestampStr}] Attempting to create Shiprocket order for ID: ${ord._id}`);
          
          try {
            // Ensure address exists
            if (!ord.address || !ord.address.addressLine1) {
              logs.push(`[${timestampStr}] Order ${ord._id} missing address, skipping Shiprocket`);
              continue;
            }

            const { totalWeight, length, breadth, height } = getDimensionsAndWeight(ord.items);
            
            const [firstName, ...restName] = ord.address.receiverName.split(' ');
            const lastName = restName.join(' ');

            const shiprocketPayload = {
              order_id: ord._id.toString(),
              order_date: ord.createdAt.toISOString().split('T')[0],
              pickup_location: 'Auto',
              billing_customer_name: firstName,
              billing_last_name: lastName || '',
              billing_address: `${ord.address.addressLine1} ${ord.address.addressLine2 || ''}`,
              billing_city: ord.address.city,
              billing_pincode: ord.address.pincode,
              billing_state: ord.address.state,
              billing_country: ord.address.country,
              billing_phone: ord.address.receiverPhoneNumber,
              shipping_is_billing: true,
              order_items: ord.items.map((item) => ({
                name: item.name || 'Product',
                sku: item.wrapFinish ? `${item.sku}-${item.wrapFinish.charAt(0).toLowerCase()}` : item.sku,
                units: item.quantity,
                selling_price: item.priceAtPurchase || 0,
              })),
              payment_method: ord.paymentDetails.amountDueCod > 0 ? 'COD' : 'Prepaid',
              sub_total: ord.paymentDetails.amountDueCod > 0
                ? ord.paymentDetails.amountDueCod
                : ord.totalAmount,
              length,
              breadth,
              height,
              weight: totalWeight,
            };

            const shiprocketResponse = await createShiprocketOrder(shiprocketPayload);
            
            if (shiprocketResponse?.status_code === 1 && !shiprocketResponse?.packaging_box_error) {
              await Order.findByIdAndUpdate(
                ord._id,
                {
                  $set: {
                    shiprocketOrderId: shiprocketResponse.order_id.toString(),
                    deliveryStatus: 'orderCreated',
                  },
                },
                { session }
              );
              logs.push(`[${timestampStr}] Shiprocket order created: ${shiprocketResponse.order_id}`);
            } else {
              logs.push(`[${timestampStr}] Shiprocket response missing order_id or packaging_box_error`);
            }
          } catch (shiprocketError) {
            logs.push(`[${timestampStr}] Shiprocket creation failed: ${shiprocketError.message}`);
            console.error(`[PayU] Shiprocket creation failed for order ${ord._id}`, shiprocketError);
          }
        }
      }

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      // Send WhatsApp notification (after transaction)
      try {
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
      } catch (whatsappError) {
        logs.push(`[${timestampStr}] WhatsApp message sending failed: ${whatsappError.message}`);
        console.error('[PayU] WhatsApp notification failed', whatsappError);
      }

      console.info('[PayU] Processing logs:', logs);

      return {
        txnId,
        normalizedStatus,
        updatedCount: orders.length,
        orderIds: orders.map(o => o._id.toString()),
        primaryOrderId: payload.udf1 || mainOrder?._id?.toString() || null,
      };
    } else if (normalizedStatus === 'failure') {
      // Update payment status to failed for all orders
      for (const orderDoc of orders) {
        if (!['allPaid', 'paidPartially', 'failed'].includes(orderDoc.paymentStatus)) {
          const { update } = buildPayuOrderUpdate(orderDoc, payload, normalizedStatus);
          await Order.findByIdAndUpdate(
            orderDoc._id,
            { $set: update },
            { session }
          ).exec();
          logs.push(`[${timestampStr}] Order ${orderDoc._id} status -> failed`);
        }
      }

      await session.commitTransaction();
      session.endSession();

      console.info('[PayU] Processing logs:', logs);

      return {
        txnId,
        normalizedStatus,
        updatedCount: orders.length,
        orderIds: orders.map(o => o._id.toString()),
        primaryOrderId: payload.udf1 || orders[0]?._id?.toString() || null,
      };
    } else {
      // Already processed or pending status
      await session.commitTransaction();
      session.endSession();

      logs.push(`[${timestampStr}] Orders already processed or status is pending`);
      console.info('[PayU] Processing logs:', logs);

      return {
        txnId,
        normalizedStatus,
        updatedCount: 0,
        orderIds: orders.map(o => o._id.toString()),
        primaryOrderId: payload.udf1 || orders[0]?._id?.toString() || null,
      };
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('[PayU] Transaction failed, rolled back:', error);
    console.error('[PayU] Processing logs:', logs);
    throw error;
  }
}

export async function parsePayuPayload(request) {
  if (request.method === 'GET') {
    const entries = request.nextUrl ? request.nextUrl.searchParams : new URL(request.url).searchParams;
    return Object.fromEntries(entries.entries());
  }

  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return await request.json();
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const bodyText = await request.text();
    const params = new URLSearchParams(bodyText);
    return Object.fromEntries(params.entries());
  }

  try {
    const formData = await request.formData();
    const payload = {};
    for (const [key, value] of formData.entries()) {
      payload[key] = value;
    }
    return payload;
  } catch (err) {
    // Fallback to plain text parsing
    const bodyText = await request.text();
    const params = new URLSearchParams(bodyText);
    return Object.fromEntries(params.entries());
  }
}

export function getAppBaseUrl(request) {
  return (
    request.headers.get('origin') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.maddycustom.com'
  );
}
