import path from 'path';
import { promises as fs } from 'fs';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import mongoose from 'mongoose';
import { validatePayuCredentials } from './config';
import { verifyReverseHash } from './hash';
import { PAYU_FAILURE_STATUSES, PAYU_SUCCESS_STATUSES } from './constants';
import { handlePaymentSuccess, sendPaymentSuccessWhatsApp } from '@/lib/payments/handlePaymentSuccess';
import { createLogger } from '@/lib/utils/logger';

const SUCCESS_SET = new Set(PAYU_SUCCESS_STATUSES.map((status) => status.toLowerCase()));
const FAILURE_SET = new Set(PAYU_FAILURE_STATUSES.map((status) => status.toLowerCase()));
const logger = createLogger('PayUWebhook');

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

  logs.push(`\n${'='.repeat(80)}`);
  logs.push(`[${timestampStr}] 🔔 PayU Webhook Received`);
  logs.push(`${'='.repeat(80)}`);

  if (!payload || typeof payload !== 'object') {
    throw new Error('Empty payload received from PayU');
  }

  logs.push(`Transaction ID: ${payload.txnid || payload.TXNID || 'N/A'}`);
  logs.push(`Payment Status: ${payload.status || 'N/A'}`);
  logs.push(`Amount: ${payload.amount || 'N/A'}`);
  logs.push(`Product Info: ${payload.productinfo || 'N/A'}`);
  logs.push(`Payment ID: ${payload.mihpayid || payload.payuid || 'N/A'}`);
  logs.push(`${'='.repeat(80)}\n`);

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
      logs.push(`[${timestampStr}] ❌ No orders found for txnId: ${txnId}`);
      await session.abortTransaction();
      session.endSession();
      return {
        txnId,
        updatedCount: 0,
        normalizedStatus: normalisePayuStatus(payload.status, payload.unmappedstatus),
        primaryOrderId: payload.udf1 || null,
      };
    }

    // Log detailed order info including analytics
    const mainOrder = orders.find(ord => ord.isMainOrder) || orders[0];
    logs.push(`Found ${orders.length} order(s), main: ${mainOrder._id}`);
    
    // Check analytics data completeness (for monitoring)
    const hasAnalyticsData = mainOrder.analyticsInfo && (
      mainOrder.analyticsInfo.ip || mainOrder.analyticsInfo.externalId
    );
    if (!hasAnalyticsData) {
      logger.warn('Missing analytics data for order', {
        orderId: mainOrder._id.toString(),
        txnId,
      });
    }

    const normalizedStatus = normalisePayuStatus(payload.status, payload.unmappedstatus);
    logs.push(`[${timestampStr}] Normalized Payment Status: ${normalizedStatus}`);
    logger.info('Payment status normalized', {
      txnId,
      normalizedStatus,
      rawStatus: payload.status,
      unmappedStatus: payload.unmappedstatus,
    });

    // Check if already processed
    const alreadyProcessed = orders.some(ord => 
      ['allPaid', 'paidPartially'].includes(ord.paymentStatus)
    );

    if (normalizedStatus === 'success' && !alreadyProcessed) {
      logs.push(`[${timestampStr}] Processing payment success for ${orders.length} orders`);
      logger.info('Processing payment success', {
        txnId,
        orderCount: orders.length,
      });

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

      // Use centralized payment success handler
      logs.push(`[${timestampStr}] Calling centralized payment success handler`);
      logger.info('Invoking centralized handler', {
        txnId,
        orderCount: orders.length,
        paymentProvider: 'payu',
      });
      
      const handlerResult = await handlePaymentSuccess(orders, session, {
        paymentProvider: 'payu',
      });
      
      logs.push(...handlerResult.logs);
      logger.info('Centralized handler completed', {
        success: handlerResult.success,
        mainOrderId: handlerResult.mainOrderId,
        txnId,
      });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();
      logger.info('Transaction committed successfully', {
        txnId,
        orderIds: orders.map(o => o._id.toString()),
      });

      // Send WhatsApp notification (after transaction)
      try {
        const mainOrder = orders.find(ord => ord.isMainOrder) || orders[0];
        const populatedMainOrder = await Order.findById(mainOrder._id).populate('user');
        
        const whatsappLogs = await sendPaymentSuccessWhatsApp(populatedMainOrder);
        logs.push(...whatsappLogs);
      } catch (whatsappError) {
        logs.push(`[${timestampStr}] WhatsApp notification error: ${whatsappError.message}`);
        logger.error('WhatsApp notification failed', {
          txnId,
          error: whatsappError.message,
        });
      }

      logger.info('PayU webhook processed successfully', {
        txnId,
        orderCount: orders.length,
      });

      const mainOrder = orders.find(ord => ord.isMainOrder) || orders[0];
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
          logger.info('Order marked as failed', {
            txnId,
            orderId: orderDoc._id.toString(),
          });
        }
      }

      await session.commitTransaction();
      session.endSession();

      logger.info('Payment failure processed', {
        txnId,
        orderIds: orders.map(o => o._id.toString()),
      });

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

      logs.push(`Orders already processed or status is pending`);
      logger.info('Orders already processed', {
        txnId,
        normalizedStatus,
        orderIds: orders.map(o => o._id.toString()),
      });

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
    logger.error('Transaction failed and rolled back', {
      txnId,
      error: error.message,
      orderIds: orders.map(o => o._id.toString()),
    });
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
