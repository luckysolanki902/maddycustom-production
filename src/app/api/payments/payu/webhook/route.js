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
    
    console.info('📦 [PayU Webhook] Payload parsed successfully', {
      requestId,
      txnId: payload?.txnid || payload?.TXNID,
      status: payload?.status,
      unmappedStatus: payload?.unmappedstatus,
      mihpayid: payload?.mihpayid,
      mode: payload?.mode,
      amount: payload?.amount,
      productinfo: payload?.productinfo,
      firstname: payload?.firstname,
      email: payload?.email,
      phone: payload?.phone,
      bankcode: payload?.bankcode,
      PG_TYPE: payload?.PG_TYPE,
      bank_ref_num: payload?.bank_ref_num,
      error: payload?.error,
      error_Message: payload?.error_Message,
      cardCategory: payload?.cardCategory,
      card_type: payload?.card_type,
      skipHash: SKIP_HASH_VALIDATION,
      payloadKeys: Object.keys(payload || {}),
    });

    if (!payload?.txnid && !payload?.TXNID) {
      console.warn('⚠️ [PayU Webhook] Missing transaction ID in payload', {
        requestId,
        payloadKeys: Object.keys(payload || {}),
      });
    }

    if (payload?.status === 'failure' || payload?.status === 'failed') {
      console.warn('⚠️ [PayU Webhook] Payment failure received', {
        requestId,
        txnId: payload?.txnid || payload?.TXNID,
        status: payload?.status,
        unmappedStatus: payload?.unmappedstatus,
        error: payload?.error,
        errorMessage: payload?.error_Message,
        failureReason: payload?.field9,
      });
    }

    console.info('🔄 [PayU Webhook] Processing payment response...', {
      requestId,
      skipHashVerification: SKIP_HASH_VALIDATION,
    });

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
      name: error?.name,
      stack: error?.stack,
      processingTimeMs: processingTime,
    });

    if (error.code === 'INVALID_HASH') {
      console.error('🔒 [PayU Webhook] Hash validation failed - potential security issue', {
        requestId,
        skipValidation: SKIP_HASH_VALIDATION,
        errorDetails: error.message,
      });
    }

    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const status = error.code === 'INVALID_HASH' ? 400 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
