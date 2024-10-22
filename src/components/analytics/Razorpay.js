// @/components/analytics/Razorpay.js
import Script from 'next/script';

const Razorpay = () => (
    <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
    />
);

export default Razorpay;
