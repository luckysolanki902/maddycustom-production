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

    const order = await Order.findById(orderId)
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
    return NextResponse.json({ order }, { status: 200 });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
