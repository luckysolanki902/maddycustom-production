import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import { initiatePayuPayment } from '@/lib/payments/payu/api';
import { validatePayuCredentials } from '@/lib/payments/payu/config';
import { formatPayuAmount, generatePayuRequestHash } from '@/lib/payments/payu/hash';

const getOrigin = (request) =>
  request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';

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
    
    // Check for intentURIData (PayU's field - contains query params only)
    if (parsed?.result?.intentURIData) {
      const params = parsed.result.intentURIData;
      // If it's just params (no upi:// prefix), build the full URL
      if (!params.startsWith('upi://')) {
        return sanitizeIntentUrl(`upi://pay?${params}`);
      }
      return sanitizeIntentUrl(params);
    }
    
    // Check for IntentURIData at root level
    if (parsed?.IntentURIData) {
      const params = parsed.IntentURIData;
      if (!params.startsWith('upi://')) {
        return sanitizeIntentUrl(`upi://pay?${params}`);
      }
      return sanitizeIntentUrl(params);
    }
    
    // Check common alternate fields
    const candidates = [
      parsed?.intentUrl,
      parsed?.intent_url,
      parsed?.intent,
      parsed?.result?.intentUrl,
      parsed?.result?.intent_url,
      parsed?.data?.intentUrl,
      parsed?.data?.intent_url,
      parsed?.data?.IntentURIData,
      parsed?.payment_response?.intentUrl,
      parsed?.payment_response?.IntentURIData,
    ];
    
    const direct = candidates.find((value) => typeof value === 'string' && value.startsWith('upi://'));
    if (direct) return sanitizeIntentUrl(direct);
    
    // Deep search in all object values
    if (typeof parsed === 'object' && parsed !== null) {
      for (const value of Object.values(parsed)) {
        if (typeof value === 'string' && value.startsWith('upi://')) {
          return sanitizeIntentUrl(value);
        }
      }
    }
  } catch (err) {
    // Not JSON, try regex extraction
  }

  // Fallback: regex extraction from raw string
  const match = rawBody.match(/upi:\/\/[A-Za-z0-9@._?&=:+\-/%]+/i);
  if (match) {
    return sanitizeIntentUrl(match[0]);
  }
  
  return null;
};

export async function POST(request) {
  try {
    const { orderId, vpa, mode = 'vpa' } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });
    }

    // For VPA mode, validate VPA
    if (mode === 'vpa' && !vpa) {
      return NextResponse.json({ error: 'vpa is required for VPA mode.' }, { status: 400 });
    }

    if (mode === 'vpa') {
      const vpaRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
      if (!vpaRegex.test(vpa)) {
        return NextResponse.json({ error: 'Invalid UPI ID format.' }, { status: 400 });
      }
    }

    await connectToDatabase();
    const order = await Order.findById(orderId).populate('user', 'email phoneNumber name').exec();

    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    if (!order.paymentDetails?.payuDetails?.txnId) {
      return NextResponse.json({ error: 'Order is not configured for PayU payments.' }, { status: 400 });
    }

    if (order.paymentDetails.amountDueOnline <= 0) {
      return NextResponse.json({ error: 'No online amount due for this order.' }, { status: 400 });
    }

    const userDoc = order.user || {};
    const { key, salt } = validatePayuCredentials();
    const origin = getOrigin(request);

    const basePayload = {
      key,
      txnid: order.paymentDetails.payuDetails.txnId,
      amount: formatPayuAmount(order.paymentDetails.amountDueOnline),
      productinfo: `Order ${order._id}`,
      firstname: order.address?.receiverName || userDoc.name || 'Customer',
      email: userDoc.email || 'noemail@maddycustom.com',
      phone: order.address?.receiverPhoneNumber || userDoc.phoneNumber,
      surl: `${origin}/api/payments/payu/return/success`,
      furl: `${origin}/api/payments/payu/return/failure`,
      notifyurl: `${origin}/api/payments/payu/webhook`,
      pg: 'UPI',
      bankcode: 'UPI',
      udf1: order._id.toString(),
      udf2: order.orderGroupId || '',
      udf3: 'upi',
    };

    // Handle intent mode - generate UPI deep link
    if (mode === 'intent') {
      const intentPayload = {
        ...basePayload,
        bankcode: 'INTENT', // Generic intent - opens app selector
        txn_s2s_flow: '4', // Required for UPI intent flow
        s2s_client_ip: getClientIp(request),
        s2s_device_info: JSON.stringify(buildS2SDeviceInfo(request)),
        upiAppName: 'genericintent', // Generic intent for all apps
      };

      // Remove vpa if accidentally included (not needed for intent)
      delete intentPayload.vpa;

      intentPayload.hash = generatePayuRequestHash(intentPayload, salt);

      const response = await initiatePayuPayment(intentPayload);
      
      // Try to parse response for better error handling
      let responseData;
      try {
        responseData = JSON.parse(response.body);
      } catch {
        responseData = { raw: response.body };
      }

      // Extract intent URL using multiple strategies
      const intentUrl = extractPayuIntentUrl(response.body);

      if (intentUrl) {
        return NextResponse.json(
          {
            intentUrl,
            txnId: intentPayload.txnid,
            status: 'intent_generated',
            responseData, // Include for debugging
          },
          { status: 200 }
        );
      } else {
        console.warn('PayU UPI intent URL not found in response', {
          snippet: response.body?.slice(0, 400),
          fullResponse: responseData,
        });
        return NextResponse.json(
          {
            error: 'Failed to generate UPI intent link. Please try VPA or QR mode.',
            details: responseData?.message || responseData?.error,
          },
          { status: 400 }
        );
      }
    }

    // Handle VPA mode - send collect request
    const vpaPayload = {
      ...basePayload,
      vpa,
    };

    vpaPayload.hash = generatePayuRequestHash(vpaPayload, salt);

    const response = await initiatePayuPayment(vpaPayload);

    // Parse response to check if collect request was sent
    let responseData;
    try {
      responseData = JSON.parse(response.body);
    } catch {
      responseData = {};
    }

    const status = responseData?.status || '';
    const message = responseData?.message || responseData?.field9 || '';

    if (status.toLowerCase() === 'success' || message.toLowerCase().includes('collect')) {
      return NextResponse.json(
        {
          status: 'pending',
          txnId: vpaPayload.txnid,
          message: 'Payment request sent to your UPI app. Please approve to complete payment.',
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          error: message || 'Failed to initiate UPI payment. Please try another method.',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('UPI seamless payment failed', error);
    return NextResponse.json({ error: 'Failed to process UPI payment.' }, { status: 500 });
  }
}

