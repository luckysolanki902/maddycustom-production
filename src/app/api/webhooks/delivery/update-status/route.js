// app/api/webhooks/delivery/update-status/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import mongoose from 'mongoose';
import { statusMapping } from '@/lib/constants/shiprocketStatusMapping';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request) {
  // Validate the security token
  const receivedToken = request.headers.get('x-api-key');
  const expectedToken = process.env.SHIPROCKET_WEBHOOK_SECRET; // Set this in your environment variables

  if (receivedToken !== expectedToken) {
    console.error('Invalid security token');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Start a MongoDB session for an atomic update
  await connectToDatabase();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);

    // Extract required details from payload
    const { order_id, current_status } = payload;
    if (!order_id || !current_status) {
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json(
        { error: 'Missing required fields.' },
        { status: 400 }
      );
    }

    // Check if order_id is a valid MongoDB ObjectId.
    if (!mongoose.Types.ObjectId.isValid(order_id)) {
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json(
        { message: 'Webhook triggered, but provided order_id is not a valid MongoDB ObjectId.' },
        { status: 200 }
      );
    }

    const order = await Order.findById(order_id).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Normalize the received status: lowercase, replace underscores with spaces, and trim whitespace
    const normalizedStatus = current_status.toLowerCase().replace(/_/g, ' ').trim();
    const mappedStatus = statusMapping[normalizedStatus];
    if (!mappedStatus) {
      await session.commitTransaction();
      session.endSession();
      return NextResponse.json(
        { message: 'Status not mapped. No update performed.' },
        { status: 200 }
      );
    }

    // Update the order:
    // - Set deliveryStatus to the mapped internal status.
    // - Save the original Shiprocket status in actualDeliveryStatus.
    order.deliveryStatus = mappedStatus;
    order.actualDeliveryStatus = current_status;

    await order.save({ session });
    await session.commitTransaction();
    session.endSession();

    return NextResponse.json({ message: 'Order updated successfully.' }, { status: 200 });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error.' },
      { status: 500 }
    );
  }
}
