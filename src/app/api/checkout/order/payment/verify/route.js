import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import crypto from 'crypto';

/**
 * Handles POST requests to verify Razorpay payments and update order status.
 * This endpoint is primarily for instant UI updates.
 */
export async function POST(request) {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = await request.json();

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
      console.warn('Missing required fields in API request.');
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const razorpaySecret = process.env.RAZORPAY_SECRET;
    if (!razorpaySecret) {
      console.error('RAZORPAY_SECRET is not set.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const computedSignature = crypto
      .createHmac('sha256', razorpaySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    try {
      const isValidSignature = crypto.timingSafeEqual(
        Buffer.from(computedSignature, 'hex'),
        Buffer.from(razorpay_signature, 'hex')
      );

      if (!isValidSignature) {
        console.warn('Invalid Razorpay signature in API request.');
        return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
      }
    } catch (signatureError) {
      console.error('Error during signature verification:', signatureError);
      return NextResponse.json({ error: 'Invalid signature format.' }, { status: 400 });
    }

    await connectToDatabase();

    const order = await Order.findById(orderId).exec();
    if (!order) {
      console.warn(`Order not found for ID: ${orderId} in API request.`);
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    if (['allPaid', 'paidPartially'].includes(order.paymentStatus)) {
      console.info(`Order ID: ${orderId} already in status '${order.paymentStatus}'.`);
      return NextResponse.json({ message: 'Order already processed.' }, { status: 200 });
    }

    // Update order payment details
    order.paymentDetails.razorpayDetails = {
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    };

    order.paymentDetails.amountPaidOnline += order.paymentDetails.amountDueOnline;
    order.paymentDetails.amountDueOnline = 0;

    if (order.paymentDetails.amountDueCod <= 0) {
      order.paymentStatus = 'allPaid';
    } else {
      order.paymentStatus = 'paidPartially';
    }

    await order.save();
    return NextResponse.json({ message: 'Payment verified successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Error in payment verification API:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
