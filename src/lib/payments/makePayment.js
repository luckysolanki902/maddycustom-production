/**
 * Wrapper around Razorpay Checkout
 * ‑ resolves with:
 *    { cancelled:true }        → user closed / dismissed
 *    { razorpay_payment_id… }  → successful & server‑verified
 * ‑ rejects only on *real* failures.
 */
import { paymentLogger } from '../utils/logger';

const GRACE_PERIOD_MS = 45000; // wait up to 45 seconds for UPI handoff to complete

export const makePayment = ({ customerName, customerMobile, orderId, razorpayOrder, onStatusChange, hideUpi = false, upiOnly = false }) =>
  new Promise((resolve, reject) => {
    let promiseSettled = false;
    const safeResolve = (value) => {
      if (promiseSettled) return;
      promiseSettled = true;
      resolve(value);
    };
    const safeReject = (err) => {
      if (promiseSettled) return;
      promiseSettled = true;
      reject(err);
    };

    const emitStatus = (status, detail = {}) => {
      if (typeof onStatusChange === 'function') {
        try {
          onStatusChange(status, detail);
        } catch (callbackErr) {
          paymentLogger.warn('Status callback failed', {
            status,
            orderId,
            error: callbackErr?.message || 'unknown',
          });
        }
      }
    };

    const buildClientContext = (extra = {}) => {
      const hasNavigator = typeof navigator !== 'undefined';
      const hasDocument = typeof document !== 'undefined';
      return {
        orderId,
        timestamp: Date.now(),
        userAgent: hasNavigator ? navigator.userAgent : undefined,
        visibilityState: hasDocument ? document.visibilityState : undefined,
        hasUserActivation: hasNavigator && navigator.userActivation
          ? navigator.userActivation.isActive
          : undefined,
        ...extra,
      };
    };

    // Validate browser environment
    if (typeof window === 'undefined') {
      paymentLogger.error('Not in browser environment');
      emitStatus('environment-mismatch', buildClientContext({ reason: 'no-window' }));
      return safeReject(new Error('Payment must be initiated from browser'));
    }

    // Validate Razorpay script is loaded
    if (!window.Razorpay) {
      paymentLogger.error('Razorpay script not loaded');
      emitStatus('sdk-not-ready', buildClientContext({ reason: 'missing-script' }));
      return safeReject(new Error('Payment system not ready. Please refresh and try again.'));
    }

    const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY;
    const logoUrl = `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/logos/maddy3logodark_rect.png`;

    if (!key || !logoUrl) {
      paymentLogger.error('Missing configuration', { hasKey: !!key, hasLogo: !!logoUrl });
      emitStatus('config-missing', buildClientContext({ hasKey: !!key, hasLogo: !!logoUrl }));
      return safeReject(new Error('Payment configuration error'));
    }

    paymentLogger.payment('Initializing payment', { orderId, amount: razorpayOrder.amount });
    emitStatus('initializing', buildClientContext({ amount: razorpayOrder.amount }));

    let paymentStarted = false;
    let modalDismissTime = null;
    let graceTimer = null;

    if (hideUpi && upiOnly) {
      paymentLogger.warn('Invalid Razorpay config: hideUpi & upiOnly cannot both be true', { orderId });
    }

    // Build display config based on hideUpi and upiOnly flags
    const displayConfig = {};
    
    if (hideUpi) {
      displayConfig.preferences = {
        hide: [{ method: 'upi' }]
      };
    } else if (upiOnly) {
      // For UPI-only mode, show only UPI methods and force collect flow (not intent)
      displayConfig.method = 'upi';
      displayConfig.config = {
        display: {
          blocks: {
            banks: {
              name: 'Pay using UPI',
              instruments: [
                { method: 'upi' }
              ]
            }
          },
          sequence: ['block.banks'],
          preferences: {
            show_default_blocks: false
          }
        }
      };
    }

    const options = {
      key,
      name: 'Maddy Custom',
      currency: razorpayOrder.currency,
      amount: razorpayOrder.amount.toString(),
      order_id: razorpayOrder.id,
      description: 'Maddy Customers',
      image: logoUrl,
      notes: { orderId },
      theme: { color: '#000000' },
      ...displayConfig,

      /** 
       * REMOVED: method: 'upi' and upi.flow: 'intent'
       * Reason: Forcing UPI intent flow causes redirect loops on mobile web browsers.
       * Let Razorpay show all available payment methods and handle flow automatically.
       */

      /** success‑callback */
      handler: async (resp) => {
        paymentStarted = true; // Mark payment as completed
        paymentLogger.payment('Payment successful, verifying...', { orderId, paymentId: resp.razorpay_payment_id });
        if (graceTimer) {
          clearTimeout(graceTimer);
          graceTimer = null;
        }
        emitStatus('success-handler', buildClientContext({ paymentId: resp.razorpay_payment_id }));

        try {
          const ver = await fetch('/api/checkout/order/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_signature: resp.razorpay_signature,
              orderId,
            }),
          });

          if (ver.status === 200) {
            paymentLogger.payment('Verification successful');
            emitStatus('success', buildClientContext({ paymentId: resp.razorpay_payment_id, verification: 'api-success' }));
            safeResolve(resp);            // verified OK
          } else {
            const { message } = await ver.json();
            paymentLogger.error('Verification failed', { message });
            emitStatus('verification-failed', buildClientContext({ message }));
            safeReject(new Error(`Payment verification failed: ${message || 'Unknown'}`));
          }
        } catch (err) {
          paymentLogger.error('Verification error', { error: err.message });
          emitStatus('verification-error', buildClientContext({ error: err.message }));
          safeReject(new Error(`Verification error: ${err.message}`));
        }
      },

      /** user closed without paying → check status before marking as cancelled */
      modal: {
        ondismiss: () => {
          modalDismissTime = Date.now();
          paymentLogger.payment('Modal dismissed', { paymentStarted, orderId });
          emitStatus('modal-dismissed', buildClientContext({ paymentStarted, modalDismissTime }));

          // If payment handler already fired, don't treat as cancellation
          if (paymentStarted) {
            paymentLogger.payment('Payment already completed, ignoring dismiss');
            emitStatus('modal-dismissed-after-success', buildClientContext());
            return;
          }

          // Give user grace period for UPI app completion, but resolve immediately so UI can recover
          paymentLogger.payment('Starting grace period for payment completion...', { graceMs: GRACE_PERIOD_MS });
          emitStatus('waiting-for-upi', buildClientContext({ gracePeriodMs: GRACE_PERIOD_MS }));

          const pollStatus = async () => {
            try {
              const statusResponse = await fetch(`/api/checkout/order/status/${orderId}`);
              const statusData = await statusResponse.json();

              paymentLogger.payment('Status check result', statusData);
              emitStatus('status-check', buildClientContext({
                isPaid: statusData.isPaid,
                paymentStatus: statusData.paymentStatus,
                hasPaymentId: Boolean(statusData.paymentDetails?.razorpayDetails?.paymentId),
              }));

              if (statusData.isPaid && statusData.paymentDetails?.razorpayDetails?.paymentId) {
                paymentLogger.payment('Payment confirmed by webhook! Recovering...', {
                  paymentId: statusData.paymentDetails.razorpayDetails.paymentId
                });
                emitStatus('recovered-success', buildClientContext({
                  paymentId: statusData.paymentDetails.razorpayDetails.paymentId,
                }));
              } else {
                paymentLogger.payment('Payment not found after grace period');
                emitStatus('grace-period-ended', buildClientContext({
                  paymentStatus: statusData.paymentStatus,
                }));
              }
            } catch (statusError) {
              paymentLogger.error('Status check failed', { error: statusError.message });
              emitStatus('status-check-error', buildClientContext({ error: statusError.message }));
            }
          };

          graceTimer = setTimeout(() => {
            pollStatus();
            graceTimer = null;
          }, GRACE_PERIOD_MS);

          safeResolve({ cancelled: true, reason: 'user-dismissed', pendingVerification: true });
        },
      },

      prefill: {
        name: customerName,
        contact: customerMobile,
        email: '',           // optional
      },
    };

    const rz = new window.Razorpay(options);

    const contextBeforeOpen = buildClientContext();
    if (contextBeforeOpen.hasUserActivation === false) {
      paymentLogger.warn('User activation missing before opening Razorpay modal', contextBeforeOpen);
      emitStatus('intent-blocked', { ...contextBeforeOpen, reason: 'lost-user-activation' });
    }
    
    paymentLogger.payment('Opening Razorpay modal...', contextBeforeOpen);
    emitStatus('modal-opening', contextBeforeOpen);
    rz.open();
    emitStatus('modal-opened', buildClientContext());

    rz.on('payment.failed', (resp) => {
      paymentStarted = false;
      if (graceTimer) {
        clearTimeout(graceTimer);
        graceTimer = null;
      }
      const msg = resp?.error?.description || 'Unknown error';
      paymentLogger.error('Payment failed', { message: msg, error: resp?.error });
      emitStatus('failure', buildClientContext({ message: msg, error: resp?.error }));
      safeReject(new Error(`Payment failed: ${msg}`));
    });
  });
