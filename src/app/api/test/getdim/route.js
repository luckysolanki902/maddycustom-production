import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import { getDimensionsAndWeight } from '@/lib/utils/shiprocket';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import PackagingBox from '@/models/PackagingBox';
import Product from '@/models/Product';

export async function GET(request) {
  try {
    console.log('Requesting dimensions...');
    // Connect to the database
    await connectToDatabase();

    // Mock Order ID for testing purposes
    const orderId = '673d2a03a2433c5f68e5ad4a'; 

    // Fetch the order details from the database
    const order = await Order.findById(orderId).populate({
      path: 'items.product',
      populate: {
        path: 'specificCategoryVariant', // Ensure variant is populated
        populate: { path: 'packagingDetails.boxId' }, // Populate box details
      },
    });

    // if (!order) {
    //   return NextResponse.json(
    //     { error: `Order with ID ${orderId} not found.` },
    //     { status: 404 }
    //   );
    // }
console.log(order.packagingDetails);
    // Extract items from the order
    const items = order.items.map((item) => ({
      product: {
        specificCategoryVariant: item.product.specificCategoryVariant,
      },
      quantity: item.quantity,
    }));

    // Call the getDimensionsAndWeight function
    const dimensionsAndWeight = await getDimensionsAndWeight(items);
console.log({dimensionsAndWeight});
    // Return the result as a JSON response
    return NextResponse.json(
      { orderId, dimensionsAndWeight },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching dimensions:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching dimensions.' },
      { status: 500 }
    );
  }
}
