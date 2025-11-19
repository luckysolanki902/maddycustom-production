import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import { initiatePayuPayment } from '@/lib/payments/payu/api';
import { validatePayuCredentials } from '@/lib/payments/payu/config';
import { formatPayuAmount, generatePayuRequestHash } from '@/lib/payments/payu/hash';

const getOrigin = (request) =>
  request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';

export async function POST(request) {
  try {
    const { orderId, cardNumber, cardName, expiryMonth, expiryYear, cvv, saveCard } = await request.json();

    if (!orderId || !cardNumber || !cardName || !expiryMonth || !expiryYear || !cvv) {
      return NextResponse.json({ error: 'All card details are required.' }, { status: 400 });
    }

    // Basic validation
    const cleanedCardNumber = cardNumber.replace(/\s/g, '');
    if (cleanedCardNumber.length < 13 || cleanedCardNumber.length > 19) {
      return NextResponse.json({ error: 'Invalid card number.' }, { status: 400 });
    }

    if (!/^\d{2}$/.test(expiryMonth) || parseInt(expiryMonth) < 1 || parseInt(expiryMonth) > 12) {
      return NextResponse.json({ error: 'Invalid expiry month.' }, { status: 400 });
    }

    if (!/^\d{2}$/.test(expiryYear)) {
      return NextResponse.json({ error: 'Invalid expiry year.' }, { status: 400 });
    }

    if (!/^\d{3,4}$/.test(cvv)) {
      return NextResponse.json({ error: 'Invalid CVV.' }, { status: 400 });
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

    const payload = {
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
      pg: 'CC',
      bankcode: 'CC',
      ccnum: cleanedCardNumber,
      ccname: cardName,
      ccvv: cvv,
      ccexpmon: expiryMonth,
      ccexpyr: expiryYear,
      store_card: saveCard ? '1' : '0',
      udf1: order._id.toString(),
      udf2: order.orderGroupId || '',
      udf3: 'card',
    };

    payload.hash = generatePayuRequestHash(payload, salt);

    const response = await initiatePayuPayment(payload);

    // Parse response
    let responseData;
    try {
      responseData = JSON.parse(response.body);
    } catch {
      // If HTML response, it's likely a 3D Secure redirect page
      if (response.body.includes('<form') || response.body.includes('3dsecure')) {
        // Extract redirect URL from response
        const urlMatch = response.body.match(/action=['"]([^'"]+)['"]/);
        if (urlMatch) {
          return NextResponse.json(
            {
              redirectUrl: urlMatch[1],
              txnId: payload.txnid,
              requires3DS: true,
            },
            { status: 200 }
          );
        }
      }
      responseData = {};
    }

    // Check if 3D Secure is required
    if (responseData?.redirectUrl || responseData?.redirect_url || responseData?.paymentUrl) {
      const redirectUrl = responseData.redirectUrl || responseData.redirect_url || responseData.paymentUrl;
      return NextResponse.json(
        {
          redirectUrl,
          txnId: payload.txnid,
          requires3DS: true,
        },
        { status: 200 }
      );
    }

    // Check if payment was successful without 3DS
    const status = (responseData?.status || '').toLowerCase();
    if (status === 'success' || status === 'captured') {
      return NextResponse.json(
        {
          status: 'success',
          txnId: payload.txnid,
        },
        { status: 200 }
      );
    }

    // Payment failed
    const errorMessage = responseData?.message || responseData?.error_Message || 'Card payment failed.';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  } catch (error) {
    console.error('Card seamless payment failed', error);
    return NextResponse.json({ error: 'Failed to process card payment.' }, { status: 500 });
  }
}
