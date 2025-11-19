'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { clearCart } from '@/store/slices/cartSlice';
import { clearUTMDetails } from '@/store/slices/utmSlice';
import { resetOrderForm, setOrderFormAutoOpen } from '@/store/slices/orderFormSlice';
import { closeAllDialogs, openCartDrawer } from '@/store/slices/uiSlice';

const PayuResultPage = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const handledRef = useRef(false);

  const status = (searchParams.get('status') || '').toLowerCase();
  const orderId = searchParams.get('orderId');
  const gateway = (searchParams.get('gateway') || '').toLowerCase();

  useEffect(() => {
    if (handledRef.current) return;
    if (gateway && gateway !== 'payu') return;

    handledRef.current = true;

    const clearPendingMarker = () => {
      if (typeof window === 'undefined') return;
      try {
        window.sessionStorage.removeItem('maddy:payuPending');
      } catch (storageError) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Unable to remove PayU pending state', storageError);
        }
      }
    };

    if (status === 'success' && orderId) {
      clearPendingMarker();
      dispatch(closeAllDialogs());
      dispatch(clearUTMDetails());
      if (process.env.NEXT_PUBLIC_isTestingOrder !== 'true') {
        dispatch(clearCart());
      }
      dispatch(resetOrderForm());
      router.replace(`/orders/myorder/${orderId}`);
      return;
    }

    const severity = status === 'invalid' ? 'error' : 'warning';
    const messageMap = {
      invalid: 'We could not verify your payment. Please try again.',
      failure: 'Payment failed. You can review your details and retry.',
      error: 'Something went wrong while processing your payment. Please try again.',
      cancelled: 'Payment was cancelled before completion. You can try again.',
      pending: 'We could not confirm your payment yet. Please retry in a moment.',
    };
    const fallbackMessage = messageMap[status] || 'We could not complete your payment. Please try again.';

    clearPendingMarker();
    dispatch(openCartDrawer({ source: 'bottom' }));
    dispatch(setOrderFormAutoOpen({
      reason: 'payu-return',
      issuedAt: Date.now(),
      snackbar: {
        message: fallbackMessage,
        severity,
      },
    }));
    router.replace('/');
  }, [dispatch, gateway, orderId, router, status]);

  const displayMessage = useMemo(() => {
    if (status === 'success' && orderId) {
      return 'Payment successful. Redirecting to your order summary...';
    }
    return 'Bringing you back to checkout to try again...';
  }, [orderId, status]);

  return (
    <main
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Processing PayU response</h1>
      <p style={{ maxWidth: 420, color: '#4b5563', lineHeight: 1.5 }}>{displayMessage}</p>
    </main>
  );
};

export default PayuResultPage;
