// @/lib/payments/makePayment.js

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
        amount: razorpayOrder.amount.toString(), // Use 'amount' instead of 'amount_due'
        order_id: razorpayOrder.id, // Razorpay's order_id
        description: "Maddy Customers",
        // callback_url: `${baseUrl}/order/${orderId}`,
        image: logoUrl,
        notes: { orderId }, // Attach internal orderId in notes
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
  
            const verificationResult = await verificationData.json();
  
            if (verificationResult?.message === "success") {
              resolve(response); // Payment verified
            } else {
              reject(new Error("Payment verification failed"));
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
  