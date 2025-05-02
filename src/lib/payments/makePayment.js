/**
 * Wrapper around Razorpay Checkout
 * ‑ resolves with:
 *    { cancelled:true }        → user closed / dismissed
 *    { razorpay_payment_id… }  → successful & server‑verified
 * ‑ rejects only on *real* failures.
 */
export const makePayment = ({ customerName, customerMobile, orderId, razorpayOrder }) =>
  new Promise((resolve, reject) => {
    const key      = process.env.NEXT_PUBLIC_RAZORPAY_KEY;
    const logoUrl  = `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/logos/maddy3logodark_rect.png`;

    if (!key || !logoUrl) {
      return reject(new Error('Payment configuration error'));
    }

    const options = {
      key,
      name: 'Maddy Custom',
      currency   : razorpayOrder.currency,
      amount     : razorpayOrder.amount.toString(),
      order_id   : razorpayOrder.id,
      description: 'Maddy Customers',
      image      : logoUrl,
      notes      : { orderId },
      theme      : { color: '#000000' },

      /** success‑callback */
      handler: async (resp) => {
        try {
          const ver = await fetch('/api/checkout/order/payment/verify', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_order_id : resp.razorpay_order_id,
              razorpay_signature: resp.razorpay_signature,
              orderId,
            }),
          });

          if (ver.status === 200) {
            resolve(resp);            // verified OK
          } else {
            const { message } = await ver.json();
            reject(new Error(`Payment verification failed: ${message || 'Unknown'}`));
          }
        } catch (err) {
          reject(new Error(`Verification error: ${err.message}`));
        }
      },

      /** user closed without paying → *resolve*, don't reject */
      modal: {
        ondismiss: () => resolve({ cancelled: true }),
      },

      prefill: {
        name   : customerName,
        contact: customerMobile,
        email  : '',           // optional
      },
    };

    const rz = new window.Razorpay(options);
    rz.open();

    rz.on('payment.failed', (resp) => {
      const msg = resp?.error?.description || 'Unknown error';
      reject(new Error(`Payment failed: ${msg}`));
    });
  });
