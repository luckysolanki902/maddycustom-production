export const makePayment = async ({ customerName, customerMobile, orderId, razorpayOrder }) => {
  const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const logoUrl = `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/logos/maddy-custom-old-circular-logo.png`;

  if (!razorpayKey || !baseUrl || !logoUrl) {
    console.error('Environment variables are not correctly defined.');
    return Promise.reject(new Error('Server configuration error.'));
  }

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
            console.info('Payment verification succeeded:', response);
            resolve(response); // Payment verified
          } else {
            const verificationResult = await verificationData.json();
            console.warn('Payment verification failed with server response:', verificationResult);
            reject(new Error(`Payment verification failed: ${verificationResult.message || "Unknown error"}`));
          }
        } catch (error) {
          console.error('Verification failed:', error);
          reject(new Error('Verification failed: ' + error.message));
        }
      },
      prefill: {
        name: customerName,
        email: "", // Optionally, prefill with user's email if available
        contact: customerMobile,
      },
      modal: {
        ondismiss: function () {
          console.warn('Payment window was dismissed or closed by the user.');
          reject(new Error("Payment window was dismissed or closed"));
        }
      }
    };

    const paymentObject = new window.Razorpay(options);
    paymentObject.open();

    paymentObject.on("payment.failed", function (response) {
      console.error('Payment failed:', response.error);
      reject(new Error(`Payment failed: ${response.error.reason}`));
    });
  });
};
