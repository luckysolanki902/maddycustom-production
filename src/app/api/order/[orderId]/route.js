import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Option from '@/models/Option';

export async function GET(request, { params }) {
  const { orderId } = await params; // Retrieve orderId from params

  // Validate orderId
  if (!orderId) {
    return NextResponse.json({ message: 'Order ID is required.' }, { status: 400 });
  }

  try {
    await connectToDatabase();

  let order = await Order.findById(orderId)
      .populate({
        path: 'items.product',
        model: 'Product',
      })
      .populate({
        path: 'items.option',
        model: 'Option',
      })
      .exec();

    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }
    let group = null;
    if (order.groupId) {
      const siblings = await Order.find({ groupId: order.groupId })
        .select('_id partitionKey isGroupPrimary paymentStatus deliveryStatus totalAmount paymentDetails.amountDueCod paymentDetails.amountDueOnline')
        .lean();
      const aggregate = siblings.reduce((acc, s) => {
        acc.total += s.totalAmount; acc.dueCod += s.paymentDetails.amountDueCod; acc.dueOnline += s.paymentDetails.amountDueOnline; return acc;
      }, { total: 0, dueCod: 0, dueOnline: 0 });
      group = { groupId: order.groupId, orders: siblings, aggregate };
    }
    return NextResponse.json({ order, group }, { status: 200 });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
