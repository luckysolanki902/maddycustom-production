import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = await request.json();

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const razorpaySecret = process.env.RAZORPAY_SECRET;
    if (!razorpaySecret) {
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const computedSignature = crypto
      .createHmac('sha256', razorpaySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(computedSignature, 'hex'), Buffer.from(razorpay_signature, 'hex'))) {
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
    }

    await connectToDatabase();

    const order = await Order.findById(orderId).exec();
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    if (['allPaid', 'paidPartially'].includes(order.paymentStatus)) {
      return NextResponse.json({ message: 'Order already processed.' }, { status: 200 });
    }

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
    console.error('Error in payment verification:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
