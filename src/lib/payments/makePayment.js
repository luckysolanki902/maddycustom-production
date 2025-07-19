/**
 * Wrapper around Razorpay Checkout
 * ‑ resolves with:
 *    { cancelled:true }        → user closed / dismissed
 *    { razorpay_payment_id… }  → successful & server‑verified
 * ‑ rejects only on *real* failures.
 */
export const makePayment = ({ customerName, customerMobile, orderId, razorpayOrder }) =>
  new Promise((resolve, reject) => {
    console.log('🎯 makePayment called with:', { 
      customerName, 
      customerMobile, 
      orderId, 
      razorpayOrderId: razorpayOrder?.id,
      razorpayAmount: razorpayOrder?.amount 
    });
    
    const key      = process.env.NEXT_PUBLIC_RAZORPAY_KEY;
    const logoUrl  = `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/logos/maddy3logodark_rect.png`;

    console.log('🔑 Razorpay key available:', !!key);
    console.log('🖼️ Logo URL:', logoUrl);

    if (!key || !logoUrl) {
      return reject(new Error('Payment configuration error'));
    }

    // Check if Razorpay is loaded
    if (typeof window === 'undefined') {
      return reject(new Error('Window object not available. Make sure this runs in browser.'));
    }
    
    if (typeof window.Razorpay === 'undefined') {
      console.error('Razorpay not found on window object. Available properties:', Object.keys(window));
      return reject(new Error('Razorpay SDK not loaded. Please check your script tags.'));
    }

    console.log('✅ Razorpay SDK loaded successfully');

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

    console.log('💳 Creating Razorpay instance with options:', options);
    const rz = new window.Razorpay(options);
    
    console.log('🚀 Opening Razorpay dialog...');
    rz.open();

    rz.on('payment.failed', (resp) => {
      const msg = resp?.error?.description || 'Unknown error';
      reject(new Error(`Payment failed: ${msg}`));
    });
  });
