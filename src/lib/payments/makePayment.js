/**
 * Wrapper around Razorpay Checkout
 * - resolves with razorpay response on successful payment
 * - rejects on user dismissal or payment failure
 */
import { paymentLogger } from '../utils/logger';

export const makePayment = async ({ customerName, customerMobile, orderId, razorpayOrder }) => {
  const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY;
  const logoUrl = `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/logos/maddy3logodark_rect.png`;

  if (!razorpayKey || !logoUrl) {
    paymentLogger.error('Environment variables are not correctly defined.', { hasKey: !!razorpayKey, hasLogo: !!logoUrl });
    return Promise.reject(new Error('Server configuration error.'));
  }

  paymentLogger.payment('Initializing payment', { orderId, amount: razorpayOrder.amount });

  return new Promise((resolve, reject) => {
    const options = {
      key: razorpayKey,
      name: "Maddy Custom",
      currency: razorpayOrder.currency,
      amount: razorpayOrder.amount.toString(),
      order_id: razorpayOrder.id,
      description: "Maddy Customers",
      image: logoUrl,
      notes: { orderId },
      theme: {
        color: "#000000",
      },
      handler: async function (response) {
        paymentLogger.payment('Payment successful, verifying...', { orderId, paymentId: response.razorpay_payment_id });
        try {
          const verificationData = await fetch("/api/checkout/order/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              orderId,
            }),
          });

          if (verificationData.status === 200) {
            paymentLogger.payment('Verification successful', { orderId, paymentId: response.razorpay_payment_id });
            resolve(response); // Payment verified
          } else {
            const verificationResult = await verificationData.json();
            paymentLogger.error('Verification failed', { orderId, message: verificationResult.message });
            reject(new Error(`Payment verification failed: ${verificationResult.message || "Unknown error"}`));
          }
        } catch (error) {
          paymentLogger.error('Verification error', { orderId, error: error.message });
          reject(new Error('Verification failed: ' + error.message));
        }
      },
      prefill: {
        name: customerName,
        email: "",
        contact: customerMobile,
      },
      modal: {
        ondismiss: function () {
          paymentLogger.payment('Modal dismissed by user', { orderId });
          reject(new Error("Payment window was dismissed or closed"));
        }
      }
    };

    paymentLogger.payment('Opening Razorpay modal...', { orderId });
    const paymentObject = new window.Razorpay(options);
    paymentObject.open();

    paymentObject.on("payment.failed", function (response) {
      const errorMsg = response.error ? response.error.description : 'Unknown error';
      paymentLogger.error('Payment failed', { orderId, error: response.error, message: errorMsg });
      reject(new Error(`Payment failed: ${errorMsg}`));
    });
  });
};
