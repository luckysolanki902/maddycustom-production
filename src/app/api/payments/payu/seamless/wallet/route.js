import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import { buildPayuFormPayload } from '@/lib/payments/payu/payload';

const getOrigin = (request) =>
  request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';

const WALLET_CODES = {
  PAYTM: 'PAYTM',
  PHONEPE: 'PHONEPE',
  MOBIKWIK: 'MOBIKWIK',
  OLAMONEY: 'OLAMONEY',
  FREECHARGE: 'FREECHARGE',
};

export async function POST(request) {
  try {
    const { orderId, walletCode } = await request.json();

    if (!orderId || !walletCode) {
      return NextResponse.json({ error: 'orderId and walletCode are required.' }, { status: 400 });
    }

    if (!Object.values(WALLET_CODES).includes(walletCode)) {
      return NextResponse.json({ error: 'Unsupported wallet.' }, { status: 400 });
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
    const origin = getOrigin(request);

    const formPayload = buildPayuFormPayload({
      txnid: order.paymentDetails.payuDetails.txnId,
      amount: order.paymentDetails.amountDueOnline,
      productinfo: 'Order ' + order._id,
      customer: {
        firstname: order.address?.receiverName || userDoc.name || 'Customer',
        email: userDoc.email || 'noemail@maddycustom.com',
        phone: order.address?.receiverPhoneNumber || userDoc.phoneNumber,
      },
      request,
      urls: {
        surl: origin + '/api/payments/payu/return/success',
        furl: origin + '/api/payments/payu/return/failure',
        notifyurl: origin + '/api/payments/payu/webhook',
      },
      paymentConfig: {
        pg: 'WALLET',
        bankcode: walletCode,
      },
      udf: {
        udf1: order._id.toString(),
        udf2: order.orderGroupId || '',
        udf3: 'wallet',
      },
    });

    // For wallets, we need to redirect to PayU's hosted page
    // Create auto-submit form HTML
    const formHtml = generateAutoSubmitForm(formPayload.actionUrl, formPayload.fields);

    return new NextResponse(formHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Wallet seamless payment failed', error);
    return NextResponse.json({ error: 'Failed to process wallet payment.' }, { status: 500 });
  }
}

function generateAutoSubmitForm(actionUrl, fields) {
  const formFields = Object.entries(fields)
    .map(([key, value]) => {
      return '<input type="hidden" name="' + key + '" value="' + value + '" />';
    })
    .join('\n');

  const html = '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
    '<title>Redirecting to Wallet...</title>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<style>' +
    'body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #8E44AD 0%, #3498DB 100%); }' +
    '.container { text-align: center; background: white; padding: 3rem 2rem; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 400px; }' +
    '.spinner { width: 60px; height: 60px; border: 4px solid #f3f3f3; border-top: 4px solid #8E44AD; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 2rem; }' +
    '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' +
    'h1 { color: #333; font-size: 1.5rem; margin-bottom: 0.5rem; }' +
    'p { color: #666; font-size: 0.9rem; }' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div class="container">' +
    '<div class="spinner"></div>' +
    '<h1>Redirecting to Wallet</h1>' +
    '<p>Please wait while we redirect you to the secure payment page...</p>' +
    '</div>' +
    '<form id="payuForm" method="POST" action="' + actionUrl + '">' +
    formFields +
    '</form>' +
    '<script>' +
    'window.onload = function() { document.getElementById("payuForm").submit(); };' +
    '</script>' +
    '</body>' +
    '</html>';

  return html;
}
