'use client';

import { useEffect, useRef } from 'react';
import funnelClient from '@/lib/analytics/funnelClient';
import { buildPurchaseEventPayload } from '@/lib/analytics/purchaseEventPayload';

function sanitizeTrackingData(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const {
    orderId,
    totalValue,
    currency,
    couponCode,
    cartSummary,
    items,
    paymentMode,
    paymentStatus,
    amountDueOnline,
    amountPaidOnline,
    amountDueCod,
    totalDiscount,
    metadata,
  } = data;

  if (!orderId) {
    return null;
  }

  return {
    orderId,
    totalValue,
    currency,
    couponCode,
    cartSummary,
    items,
    paymentMode,
    paymentStatus,
    amountDueOnline,
    amountPaidOnline,
    amountDueCod,
    totalDiscount,
    metadata,
  };
}

export default function OrderSuccessTracker({ trackingData }) {
  const trackedRef = useRef(false);

  useEffect(() => {
    const sanitized = sanitizeTrackingData(trackingData);
    if (trackedRef.current || !sanitized) {
      return;
    }

    trackedRef.current = true;

    const payload = buildPurchaseEventPayload({
      ...sanitized,
      metadata: {
        ...(sanitized.metadata || {}),
        source: 'order_success_page',
      },
    });

    if (!payload) {
      return;
    }

    try {
      funnelClient.track('purchase', payload);
      void funnelClient.flush('purchase-success');
    } catch (error) {
      // Order success purchase tracking failed
    }
  }, [trackingData]);

  return null;
}
