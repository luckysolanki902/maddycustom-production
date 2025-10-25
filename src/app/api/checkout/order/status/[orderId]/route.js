import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import { paymentLogger } from '@/lib/utils/logger';

/**
 * GET /api/checkout/order/status/[orderId]
 * Returns payment status for an order
 * Used to check if payment completed after modal dismissal
 */
export async function GET(request, { params }) {
  try {
    await connectToDatabase();
    const { orderId } = params;

    paymentLogger.info('Checking order status', { orderId });

    const order = await Order.findById(orderId)
      .select('paymentStatus paymentDetails.razorpayDetails paymentDetails.amountPaidOnline')
      .lean();

    if (!order) {
      paymentLogger.warn('Order not found', { orderId });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const result = {
      paymentStatus: order.paymentStatus,
      paymentDetails: order.paymentDetails,
      isPaid: ['allPaid', 'paidPartially'].includes(order.paymentStatus)
    };

    paymentLogger.info('Order status retrieved', {
      orderId,
      paymentStatus: order.paymentStatus,
      isPaid: result.isPaid,
      hasPaymentId: !!order.paymentDetails?.razorpayDetails?.paymentId
    });

    return NextResponse.json(result);
  } catch (error) {
    paymentLogger.error('Status check failed', {
      orderId: params.orderId,
      error: error.message,
      stack: error.stack
    });
    
    return NextResponse.json(
      { error: 'Failed to check payment status' },
      { status: 500 }
    );
  }
}
