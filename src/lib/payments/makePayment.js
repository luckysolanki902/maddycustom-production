/**
 * Wrapper around Razorpay Checkout
 * ‑ resolves with:
 *    { cancelled:true }        → user closed / dismissed
 *    { razorpay_payment_id… }  → successful & server‑verified
 * ‑ rejects only on *real* failures.
 */
import { paymentLogger } from '../utils/logger';

export const makePayment = ({ customerName, customerMobile, orderId, razorpayOrder }) =>
  new Promise((resolve, reject) => {
    // Validate browser environment
    if (typeof window === 'undefined') {
      paymentLogger.error('Not in browser environment');
      return reject(new Error('Payment must be initiated from browser'));
    }

    // Validate Razorpay script is loaded
    if (!window.Razorpay) {
      paymentLogger.error('Razorpay script not loaded');
      return reject(new Error('Payment system not ready. Please refresh and try again.'));
    }

    const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY;
    const logoUrl = `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/logos/maddy3logodark_rect.png`;

    if (!key || !logoUrl) {
      paymentLogger.error('Missing configuration', { hasKey: !!key, hasLogo: !!logoUrl });
      return reject(new Error('Payment configuration error'));
    }

    paymentLogger.payment('Initializing payment', { orderId, amount: razorpayOrder.amount });

    let paymentStarted = false;
    let modalDismissTime = null;

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

      /** 
       * REMOVED: method: 'upi' and upi.flow: 'intent'
       * Reason: Forcing UPI intent flow causes redirect loops on mobile web browsers.
       * Let Razorpay show all available payment methods and handle flow automatically.
       */

      /** success‑callback */
      handler: async (resp) => {
        paymentStarted = true; // Mark payment as completed
        paymentLogger.payment('Payment successful, verifying...', { orderId, paymentId: resp.razorpay_payment_id });

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
            resolve(resp);            // verified OK
          } else {
            const { message } = await ver.json();
            paymentLogger.error('Verification failed', { message });
            reject(new Error(`Payment verification failed: ${message || 'Unknown'}`));
          }
        } catch (err) {
          paymentLogger.error('Verification error', { error: err.message });
          reject(new Error(`Verification error: ${err.message}`));
        }
      },

      /** user closed without paying → check status before marking as cancelled */
      modal: {
        ondismiss: () => {
          modalDismissTime = Date.now();
          paymentLogger.payment('Modal dismissed', { paymentStarted, orderId });

          // If payment handler already fired, don't treat as cancellation
          if (paymentStarted) {
            paymentLogger.payment('Payment already completed, ignoring dismiss');
            return;
          }

          // Give user 10 seconds grace period for UPI app completion
          // This handles cases where user switches to UPI app and comes back
          paymentLogger.payment('Starting 10s grace period for payment completion...');
          
          setTimeout(async () => {
            if (!paymentStarted) {
              paymentLogger.payment('Grace period ended, checking payment status with server...');
              
              try {
                const statusResponse = await fetch(`/api/checkout/order/status/${orderId}`);
                const statusData = await statusResponse.json();

                paymentLogger.payment('Status check result', statusData);

                if (statusData.isPaid && statusData.paymentDetails?.razorpayDetails?.paymentId) {
                  paymentLogger.payment('Payment confirmed by webhook! Recovering...', {
                    paymentId: statusData.paymentDetails.razorpayDetails.paymentId
                  });
                  resolve({
                    razorpay_payment_id: statusData.paymentDetails.razorpayDetails.paymentId,
                    recovered: true,
                    message: 'Payment was successful'
                  });
                } else {
                  paymentLogger.payment('Payment not found, marking as cancelled');
                  resolve({ cancelled: true });
                }
              } catch (statusError) {
                paymentLogger.error('Status check failed', { error: statusError.message });
                resolve({ cancelled: true });
              }
            } else {
              paymentLogger.payment('Payment completed during grace period');
            }
          }, 10000); // 10 second grace period
        },
      },

      prefill: {
        name: customerName,
        contact: customerMobile,
        email: '',           // optional
      },
    };

    const rz = new window.Razorpay(options);
    
    paymentLogger.payment('Opening Razorpay modal...');
    rz.open();

    rz.on('payment.failed', (resp) => {
      paymentStarted = false;
      const msg = resp?.error?.description || 'Unknown error';
      paymentLogger.error('Payment failed', { message: msg, error: resp?.error });
      reject(new Error(`Payment failed: ${msg}`));
    });
  });
