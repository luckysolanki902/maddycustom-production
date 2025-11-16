import path from 'path';
import { promises as fs } from 'fs';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
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

export async function processPayuGatewayResponse(payload, options = {}) {
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
  const orders = await Order.find({ 'paymentDetails.payuDetails.txnId': txnId }).exec();
  if (!orders || orders.length === 0) {
    return {
      txnId,
      updatedCount: 0,
      normalizedStatus: normalisePayuStatus(payload.status, payload.unmappedstatus),
      primaryOrderId: payload.udf1 || null,
    };
  }

  const normalizedStatus = normalisePayuStatus(payload.status, payload.unmappedstatus);
  const updatedOrders = await Promise.all(
    orders.map((orderDoc) => {
      const { update } = buildPayuOrderUpdate(orderDoc, payload, normalizedStatus);
      return Order.findByIdAndUpdate(
        orderDoc._id,
        { $set: update },
        { new: true }
      ).exec();
    })
  );

  return {
    txnId,
    normalizedStatus,
    updatedCount: updatedOrders.length,
    primaryOrderId: payload.udf1 || updatedOrders[0]?._id?.toString() || null,
  };
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
