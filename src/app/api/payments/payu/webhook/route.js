import { NextResponse } from 'next/server';
import { parsePayuPayload, processPayuGatewayResponse } from '@/lib/payments/payu/responseProcessor';

const SKIP_HASH_VALIDATION = process.env.PAYU_SKIP_WEBHOOK_HASH === 'true';

export async function POST(request) {
  const requestId = `${Date.now()}-${Math.round(Math.random() * 1e4)}`;
  try {
    const payload = await parsePayuPayload(request);
    console.info('[PayU webhook] Payload received', {
      requestId,
      txnId: payload?.txnid || payload?.TXNID,
      status: payload?.status,
      unmappedStatus: payload?.unmappedstatus,
      mihpayid: payload?.mihpayid,
      skipHash: SKIP_HASH_VALIDATION,
    });

    const result = await processPayuGatewayResponse(payload, {
      skipHashVerification: SKIP_HASH_VALIDATION,
    });

    console.info('[PayU webhook] Order updates applied', {
      requestId,
      txnId: result.txnId,
      normalizedStatus: result.normalizedStatus,
      updatedCount: result.updatedCount,
    });

    return NextResponse.json({
      success: true,
      txnId: result.txnId,
      status: result.normalizedStatus,
      updated: result.updatedCount,
    });
  } catch (error) {
    console.error('[PayU webhook] Processing failed', {
      requestId,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    const status = error.code === 'INVALID_HASH' ? 400 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
