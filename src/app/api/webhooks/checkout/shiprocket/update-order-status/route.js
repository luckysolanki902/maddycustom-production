// app/api/checkout/webhooks/shiprocket.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const signature = request.headers.get('shiprocket-signature'); // Assume Shiprocket sends a signature
    const secret = process.env.SHIPROCKET_WEBHOOK_SECRET;

    const payload = await request.json();

    // Verify signature if Shiprocket provides it
    if (signature) {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
      }
    }

    // Assume payload contains orderId and status
    const { orderId, status } = payload;

    if (!orderId || !status) {
      return NextResponse.json(
        { message: 'Missing orderId or status' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404 }
      );
    }

    // Update order status based on Shiprocket status
    switch (status.toLowerCase()) {
      case 'shipped':
        order.status = 'shipped';
        order.purchaseStatus.shiprocketOrderCreated = true;
        break;
      case 'delivered':
        order.status = 'delivered';
        break;
      case 'cancelled':
        order.status = 'cancelled';
        break;
      // Add more cases as needed
      default:
        // Unknown status
        return NextResponse.json({ message: 'Unknown status' }, { status: 400 });
    }

    await order.save();

    return NextResponse.json({ message: 'Order status updated' }, { status: 200 });
  } catch (error) {
    console.error('Error handling Shiprocket webhook:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
