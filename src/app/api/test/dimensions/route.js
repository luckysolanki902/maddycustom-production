import { NextResponse } from 'next/server';
import { getDimensionsAndWeight } from '@/lib/utils/shiprocket';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';

/**
 * API route to fetch dimensions and weight for a given order ID
 * 
 * @route POST /api/test/dimensions
 */
export async function POST(request) {
  try {
    await connectToDatabase();

    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json(
        { success: false, message: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Fetch the order and its items with population for product and variant
    const order = await Order.findById(orderId).populate({
      path: 'items.product',
      model: 'Product',
      populate: {
        path: 'specificCategoryVariant',
        model: 'SpecificCategoryVariant'
      }
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
      );
    }

    // Extract order items for dimension calculation
    const orderItems = order.items.map(item => ({
      product: item.product,
      quantity: item.quantity,
    }));

    // Get packaging dimensions and weight
    const dimensionsAndWeight = await getDimensionsAndWeight(orderItems);
console.log(dimensionsAndWeight);
    return NextResponse.json(
      { success: true, dimensionsAndWeight },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/test/dimensions:', error.message);
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
