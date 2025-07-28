import { NextResponse } from 'next/server';
import Order from '@/models/Order';
import connectToDatabase from '@/lib/middleware/connectToDb'

export async function POST(request) {
  try {
    // Connect to database
    await connectToDatabase();

    // Get userId from request body
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { message: 'User ID is required' },
        { status: 400 }
      );
    }

    // Fetch orders for the user
    const orders = await Order.find({ user: '6884decad218ef44c0254932' })
      .populate('items') // Populate product details
      .sort({ createdAt: -1 }); // Sort by newest first

    // Transform orders to include only necessary information for the frontend
    const transformedOrders = orders.map(order => ({
      orderId: order._id,
      orderDate: order.createdAt,
      status: order.deliveryStatus,
      productName: order.items[0]?.name || 'Product',
      productImage: order.items[0]?.thumbnail || '/images/placeholder.png',
      description: `${order.items.length} item${order.items.length > 1 ? 's' : ''}`,
      amount: order.totalAmount,
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.priceAtPurchase,
        image: item.thumbnail
      }))
    }));

    return NextResponse.json({
      orders: transformedOrders
    });

  } catch (error) {
    console.error('Error in /api/user/my-garage:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
