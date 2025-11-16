import { NextResponse } from 'next/server';
import { getAppBaseUrl, parsePayuPayload, processPayuGatewayResponse } from '@/lib/payments/payu/responseProcessor';

function buildRedirectUrl(request, orderId, outcome) {
  const baseUrl = getAppBaseUrl(request);
  const url = new URL(orderId ? `/orders/myorder/${orderId}` : '/orders/myorder', baseUrl);
  url.searchParams.set('gateway', 'payu');
  url.searchParams.set('status', outcome);
  return url.toString();
}

export async function handlePayuReturnRequest(request) {
  let orderId = null;
  let outcome = 'pending';

  try {
    const payload = await parsePayuPayload(request);
    orderId = payload.udf1 || null;
    const result = await processPayuGatewayResponse(payload);
    outcome = result.normalizedStatus;
    if (!orderId && result.primaryOrderId) {
      orderId = result.primaryOrderId;
    }
  } catch (error) {
    outcome = error.code === 'INVALID_HASH' ? 'invalid' : 'error';
  }

  const redirectUrl = buildRedirectUrl(request, orderId, outcome);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
