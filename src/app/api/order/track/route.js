import connectToDatabase from '@/lib/middleware/connectToDb';
import { trackShiprocketOrder } from '@/lib/utils/shiprocket';
import Order from '@/models/Order';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');
  if (!orderId) {
    return NextResponse.json({ message: 'Order ID is required' }, { status: 400 });
  }

  try {
    await connectToDatabase();

    // Verify if the order exists and check the delivery status
    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    if (order.deliveryStatus === 'pending') {
      return NextResponse.json({ message: 'Order is still pending and not shipped yet!' }, { status: 400 });
    }

    // If delivery status is not pending, proceed to track the order
    const trackingData = await trackShiprocketOrder(orderId);

    // Extract the tracking URL from the response
    const trackUrl = trackingData[0]?.tracking_data?.track_url;

    if (trackUrl) {
      // Redirect to the Shiprocket tracking URL
      return NextResponse.redirect(trackUrl);
    } else {
      return NextResponse.json({ message: 'Will be shipped soon! Please Check again tomorrow.' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error tracking order:', error);
    return NextResponse.json({ message: 'Error tracking order' }, { status: 502 });
  }
}

