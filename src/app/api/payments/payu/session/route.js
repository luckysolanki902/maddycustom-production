import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import User from '@/models/User';
import { buildPayuFormPayload } from '@/lib/payments/payu/payload';
import { DEFAULT_PAYU_METHOD, PAYU_NETBANKING_BANKS } from '@/lib/payments/payu/constants';
import { initiatePayuPayment } from '@/lib/payments/payu/api';

/**
 * Calculate total amountDueOnline from all linked orders (for split orders)
 * @param {Object} order - The main order document
 * @returns {Promise<number>} - Total amount due online across all linked orders
 */
async function getTotalAmountDueOnline(order) {
  // If no linked orders, return this order's amount
  if (!order.linkedOrderIds || order.linkedOrderIds.length === 0) {
    return order.paymentDetails.amountDueOnline;
  }

  // Fetch all linked orders and sum their amountDueOnline
  const linkedOrders = await Order.find({ _id: { $in: order.linkedOrderIds } })
    .select('paymentDetails.amountDueOnline')
    .lean();

  const totalAmount = order.paymentDetails.amountDueOnline + 
    linkedOrders.reduce((sum, linkedOrder) => sum + (linkedOrder.paymentDetails?.amountDueOnline || 0), 0);

  return totalAmount;
}

const PAYU_UPI_INTENT_BANKCODE = process.env.PAYU_UPI_INTENT_BANKCODE || 'UPI_INTENT';
const PAYU_FORCE_GENERIC_UPI = process.env.PAYU_FORCE_GENERIC_UPI === 'true';

const METHOD_CONFIG = {
  card: () => ({ pg: 'CC', bankcode: 'CC' }),
  upi: () => {
    if (!PAYU_FORCE_GENERIC_UPI) {
      return { pg: 'UPI', bankcode: 'UPI' };
    }
    return {
      pg: 'UPI',
      bankcode: PAYU_UPI_INTENT_BANKCODE,
      enforce_paymethod: 'upi',
      payment_source: 'generic_intent',
      intent_result: '1',
    };
  },
  netbanking: ({ bankCode }) => ({ pg: 'NB', bankcode: bankCode }),
};

const SUPPORTED_METHODS = Object.keys(METHOD_CONFIG);
const NETBANKING_CODES = new Set(PAYU_NETBANKING_BANKS.map((bank) => bank.code));

const getOrigin = (request) => request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';

const getClientIp = (request) => {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || '';
};

const detectDeviceType = (ua = '') => (/mobile|android|iphone|ipad|ipod/i.test(ua) ? 'MOBILE' : 'DESKTOP');
const detectDeviceOs = (ua = '') => {
  if (/android/i.test(ua)) return 'ANDROID';
  if (/iphone|ipad|ipod|ios/i.test(ua)) return 'IOS';
  if (/mac/i.test(ua)) return 'MAC';
  if (/windows/i.test(ua)) return 'WINDOWS';
  if (/linux/i.test(ua)) return 'LINUX';
  return 'WEB';
};

const buildS2SDeviceInfo = (request) => {
  const userAgent = request.headers.get('user-agent') || '';
  return {
    deviceType: detectDeviceType(userAgent),
    deviceOS: detectDeviceOs(userAgent),
    browserUserAgent: userAgent,
    channel: 'WEB',
  };
};

const sanitizeIntentUrl = (url) => (typeof url === 'string' ? url.replace(/&amp;/g, '&').trim() : null);

const extractPayuIntentUrl = (rawBody) => {
  if (!rawBody) return null;
  try {
    const parsed = JSON.parse(rawBody);
    const candidates = [
      parsed?.intentUrl,
      parsed?.intent_url,
      parsed?.intent,
      parsed?.result?.intentUrl,
      parsed?.result?.intent_url,
      parsed?.data?.intentUrl,
      parsed?.data?.intent_url,
      parsed?.payment_response?.intentUrl,
    ];
    const direct = candidates.find((value) => typeof value === 'string' && value.startsWith('upi://'));
    if (direct) return sanitizeIntentUrl(direct);
    if (typeof parsed === 'object' && parsed !== null) {
      for (const value of Object.values(parsed)) {
        if (typeof value === 'string' && value.startsWith('upi://')) {
          return sanitizeIntentUrl(value);
        }
      }
    }
  } catch (err) {
    // Body was not JSON; fall through to regex extraction.
  }

  const match = rawBody.match(/upi:\/\/[A-Za-z0-9@._?&=:+\-/%]+/i);
  if (match) {
    return sanitizeIntentUrl(match[0]);
  }
  return null;
};

const mapFieldsToRequestPayload = (fields = {}) => ({
  txnid: fields.txnid,
  amount: fields.amount,
  productinfo: fields.productinfo,
  firstname: fields.firstname,
  email: fields.email,
  phone: fields.phone,
  surl: fields.surl,
  furl: fields.furl,
  notifyurl: fields.notifyurl,
  pg: fields.pg,
  bankcode: fields.bankcode,
  vpa: fields.vpa,
  enforce_paymethod: fields.enforce_paymethod,
  payment_source: fields.payment_source,
  intent_result: fields.intent_result,
  udf1: fields.udf1,
  udf2: fields.udf2,
  udf3: fields.udf3,
  udf4: fields.udf4,
  udf5: fields.udf5,
  udf6: fields.udf6,
  udf7: fields.udf7,
  udf8: fields.udf8,
  udf9: fields.udf9,
  udf10: fields.udf10,
});

async function attemptUpiIntent(request, formFields) {
  const payload = {
    ...mapFieldsToRequestPayload(formFields),
    txn_s2s_flow: '1',
    s2s_client_ip: getClientIp(request),
    s2s_device_info: JSON.stringify(buildS2SDeviceInfo(request)),
  };

  try {
    const response = await initiatePayuPayment(payload);
    const intentUrl = extractPayuIntentUrl(response.body);
    if (intentUrl) {
      return intentUrl;
    }
    const snippet = response.body ? response.body.slice(0, 400) : '[no-body]';
    console.warn('PayU intent URL not found in response; falling back to hosted form.', { snippet });
    return null;
  } catch (intentError) {
    console.error('PayU UPI intent initialization failed', intentError);
    return null;
  }
}

async function fetchOrderWithUser(orderId) {
  await connectToDatabase();
  const order = await Order.findById(orderId)
    .populate('user', 'email phoneNumber name')
    .exec();
  return order;
}

export async function POST(request) {
  try {
    const { orderId, method = DEFAULT_PAYU_METHOD, bankCode } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });
    }

    const normalizedMethod = String(method).toLowerCase();

    if (!SUPPORTED_METHODS.includes(normalizedMethod)) {
      return NextResponse.json({ error: `Unsupported PayU method: ${method}` }, { status: 400 });
    }

    if (normalizedMethod === 'netbanking') {
      if (!bankCode) {
        return NextResponse.json({ error: 'bankCode is required for netbanking payments.' }, { status: 400 });
      }
      if (!NETBANKING_CODES.has(bankCode)) {
        return NextResponse.json({ error: 'Unsupported bank for netbanking.' }, { status: 400 });
      }
    }

    const order = await fetchOrderWithUser(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    if (!order.paymentDetails?.payuDetails?.txnId) {
      return NextResponse.json({ error: 'Order is not configured for PayU payments.' }, { status: 400 });
    }

    if (order.paymentDetails.amountDueOnline <= 0) {
      return NextResponse.json({ error: 'No online amount due for this order.' }, { status: 400 });
    }

    // Calculate total amount across all linked orders (for split orders)
    const totalAmountDueOnline = await getTotalAmountDueOnline(order);

    const userDoc = order.user || {};
    const methodConfig = METHOD_CONFIG[normalizedMethod]({ bankCode });

    const formPayload = buildPayuFormPayload({
      txnid: order.paymentDetails.payuDetails.txnId,
      amount: totalAmountDueOnline,
      productinfo: `Order ${order._id}`,
      customer: {
        firstname: order.address?.receiverName || userDoc.name || 'Customer',
        email: userDoc.email || 'noemail@maddycustom.com',
        phone: order.address?.receiverPhoneNumber || userDoc.phoneNumber,
      },
      request,
      urls: {
        surl: `${getOrigin(request)}/api/payments/payu/return/success`,
        furl: `${getOrigin(request)}/api/payments/payu/return/failure`,
        notifyurl: `${getOrigin(request)}/api/payments/payu/webhook`,
      },
      paymentConfig: methodConfig,
      udf: {
        udf1: order._id.toString(),
        udf2: order.orderGroupId || '',
        udf3: normalizedMethod,
      },
    });

    if (normalizedMethod === 'upi') {
      const intentUrl = await attemptUpiIntent(request, formPayload.fields);
      if (intentUrl) {
        return NextResponse.json(
          {
            method: normalizedMethod,
            intentUrl,
            txnId: formPayload.fields.txnid,
            amount: formPayload.fields.amount,
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json(
      {
        method: normalizedMethod,
        actionUrl: formPayload.actionUrl,
        fields: formPayload.fields,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('PayU session creation failed', error);
    return NextResponse.json({ error: 'Failed to prepare PayU payment.' }, { status: 500 });
  }
}
