import path from 'path';
import { promises as fs } from 'fs';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import Coupon from '@/models/Coupon';
import Product from '@/models/Product';
import Option from '@/models/Option';
import User from '@/models/User';
import Inventory from '@/models/Inventory';
import mongoose from 'mongoose';
import { createShiprocketOrder, getDimensionsAndWeight } from '@/lib/utils/shiprocket';
import { validatePayuCredentials } from './config';
import { verifyReverseHash } from './hash';
import { PAYU_FAILURE_STATUSES, PAYU_SUCCESS_STATUSES } from './constants';
import { handlePostPaymentSuccess } from '@/lib/payments/postPaymentHandler';
import { processOrderFulfillment } from '@/lib/orders/fulfillmentHandler';

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
      // Deduct inventory for each order
      // Create Shiprocket orders
      // All handled by processOrderFulfillment
      const fulfilledOrders = await processOrderFulfillment(orders.map(o => o._id), session, logs);

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      // Post-Payment Success Handler (Meta CAPI + WhatsApp)
      await handlePostPaymentSuccess(fulfilledOrders, logs);

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
