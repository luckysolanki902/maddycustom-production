import { buffer } from 'micro';
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false, // Disallow body parsing, consume as stream
  },
};

export async function POST(request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const reqBuffer = await buffer(request);
  const payload = reqBuffer.toString('utf8');
  const signature = request.headers.get('x-razorpay-signature');

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(payload);

  try {
    await connectToDatabase();

    if (event.event === 'payment.captured') {
      const paymentId = event.payload.payment.entity.id;
      const orderId = event.payload.payment.entity.order_id;

      // Find the order by Razorpay order ID
      const order = await Order.findOne({ 'paymentDetails.razorpayDetails.orderId': orderId }).populate('paymentDetails.mode');
      if (!order) {
        console.error('Order not found for Razorpay order ID:', orderId);
        return NextResponse.json({ message: 'Order not found' }, { status: 404 });
      }

      // Update payment details
      order.paymentDetails.razorpayDetails.paymentId = paymentId;
      order.paymentDetails.razorpayDetails.signature = signature;

      // Update amounts
      order.paymentDetails.amountPaidOnline += order.paymentDetails.amountPaidOnline; // Assuming full payment online
      order.paymentDetails.amountDueCod -= order.paymentDetails.amountPaidOnline; // Adjust COD amount

      // Update purchase status based on payment mode
      if (order.paymentDetails.mode.type === 'fifty') {
        // For fifty, mark paymentVerified as true only if online part is paid
        order.purchaseStatus.paymentVerified = true;
        // Status remains 'pending' since COD is still due
      } else if (order.paymentDetails.mode.type === 'full_online') {
        // For full online, mark as paid
        order.purchaseStatus.paymentVerified = true;
        order.status = 'paid';
      }

      await order.save();

      // Optionally, trigger Shiprocket order creation here if fully paid

      // Respond with success
      return NextResponse.json({ message: 'Payment captured and order updated' }, { status: 200 });
    }

    // Handle other events if necessary

    return NextResponse.json({ message: 'Event not handled' }, { status: 200 });
  } catch (error) {
    console.error('Error handling Razorpay webhook:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
