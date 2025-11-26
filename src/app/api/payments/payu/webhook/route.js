import { NextResponse } from 'next/server';
import { parsePayuPayload, processPayuGatewayResponse } from '@/lib/payments/payu/responseProcessor';

const SKIP_HASH_VALIDATION = process.env.PAYU_SKIP_WEBHOOK_HASH === 'true';

export async function POST(request) {
  const requestId = `${Date.now()}-${Math.round(Math.random() * 1e4)}`;
  const startTime = Date.now();
  
  console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.info('🔔 [PayU Webhook] Incoming request', {
    requestId,
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    headers: {
      contentType: request.headers.get('content-type'),
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin'),
    },
  });

  try {
    const payload = await parsePayuPayload(request);
    
    // Production-safe logging - no sensitive data
    console.info('📦 [PayU Webhook] Payload parsed', {
      requestId,
      txnId: payload?.txnid || payload?.TXNID,
      status: payload?.status,
      mode: payload?.mode,
      amount: payload?.amount,
    });

    if (!payload?.txnid && !payload?.TXNID) {
      console.warn('⚠️ [PayU Webhook] Missing transaction ID', { requestId });
    }

    if (payload?.status === 'failure' || payload?.status === 'failed') {
      console.warn('⚠️ [PayU Webhook] Payment failure', {
        requestId,
        txnId: payload?.txnid || payload?.TXNID,
        error: payload?.error,
      });
    }

    console.info('🔄 [PayU Webhook] Processing...', { requestId });

    const result = await processPayuGatewayResponse(payload, {
      skipHashVerification: SKIP_HASH_VALIDATION,
    });

    const processingTime = Date.now() - startTime;

    console.info('✅ [PayU Webhook] Order updates applied successfully', {
      requestId,
      txnId: result.txnId,
      normalizedStatus: result.normalizedStatus,
      updatedCount: result.updatedCount,
      orderIds: result.orderIds,
      processingTimeMs: processingTime,
    });

    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return NextResponse.json({
      success: true,
      txnId: result.txnId,
      status: result.normalizedStatus,
      updated: result.updatedCount,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('❌ [PayU Webhook] Processing failed', {
      requestId,
      message: error?.message,
      code: error?.code,
      processingTimeMs: processingTime,
    });

    if (error.code === 'INVALID_HASH') {
      console.error('🔒 [PayU Webhook] Hash validation failed', { requestId });
    }

    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const status = error.code === 'INVALID_HASH' ? 400 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
