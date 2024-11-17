// @/lib/payments/makePayment.js
export const makePayment = async ({ customerName, customerMobile, orderId, razorpayOrder }) => {
    const razorpaykey = process.env.NEXT_PUBLIC_RAZORPAY_KEY;

    return new Promise((resolve, reject) => {
        const options = {
            key: razorpaykey,
            name: "Maddy Custom",
            currency: razorpayOrder.currency,
            amount: razorpayOrder.amount_due.toString(),
            order_id: razorpayOrder.id,
            description: "Maddy Customers",
            image: '/500500.png',
            notes: { orderId }, // MongoDB ID is added to the notes field
            handler: async function (response) {
                try {
                    const verificationData = await fetch("/api/checkout/payment/verify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature,
                            orderId, // Pass the MongoDB orderId for verification
                        }),
                    });

                    const verificationResult = await verificationData.json();

                    if (verificationResult?.message === "success") {
                        resolve(response); // Resolve when verification is successful
                    } else {
                        reject(new Error("Payment verification failed"));
                    }
                } catch (error) {
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
                    reject(new Error("Payment window was dismissed or closed"));

                }
            }
        };

        const paymentObject = new window.Razorpay(options);
        paymentObject.open();

        paymentObject.on("payment.failed", function (response) {
            reject(new Error(`Payment failed: ${response.error.reason}`));
        });
    });
};
