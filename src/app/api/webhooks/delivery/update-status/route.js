// app/api/webhooks/delivery/update-status/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import mongoose from 'mongoose';
import { statusMapping } from '@/lib/constants/shiprocketStatusMapping';
import inventory from '@/models/Inventory';
import option from '@/models/Option';

// Helper: Update inventory for a given inventory document _id
async function updateInventory(inventoryId, delta, session) {
  console.log(`Updating inventory for ID ${inventoryId} with delta ${delta}`);
  const result = await mongoose.model('Inventory').updateOne(
    { _id: inventoryId },
    {
      $inc: {
        availableQuantity: delta,
        reservedQuantity: -delta,
      },
    },
    { session }
  );
  console.log(`Inventory update result for ${inventoryId}:`, result);
  return result;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request) {
  console.log('--- Webhook request received ---');

  // Validate security token
  const receivedToken = request.headers.get('x-api-key');
  const expectedToken = process.env.SHIPROCKET_WEBHOOK_SECRET;
  if (receivedToken !== expectedToken) {
    console.error('Invalid security token:', receivedToken);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const rawBody = await request.text();
    console.log('Raw request body:', rawBody);
    const payload = JSON.parse(rawBody);
    console.log('Parsed payload:', payload);

    const { order_id, current_status } = payload;
    if (!order_id || !current_status) {
      console.error('Missing required fields in payload:', payload);
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // Look up the order by _id if valid, otherwise by shiprocketOrderId
    let order;
    if (mongoose.Types.ObjectId.isValid(order_id)) {
      console.log(`order_id ${order_id} is a valid MongoDB ObjectId. Looking up by _id.`);
      order = await Order.findById(order_id).session(session);
    } else {
      console.log(`order_id ${order_id} is NOT a valid MongoDB ObjectId. Looking up by shiprocketOrderId.`);
      order = await Order.findOne({ shiprocketOrderId: order_id }).session(session);
    }

    if (!order) {
      console.error('Order not found for provided order identifier:', order_id);
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    console.log('Order found:', order);

    // Normalize and map status
    const normalizedStatus = current_status.toLowerCase().replace(/[-_]/g, ' ').trim();
    const mappedStatus = statusMapping[normalizedStatus] || 'unknown';
    console.log(`Mapped status for '${current_status}' (normalized: '${normalizedStatus}') is '${mappedStatus}'`);

    // Determine inventory update delta
    let inventoryDelta = 0;
    if (mappedStatus === "orderCreated") {
      inventoryDelta = -1 * order.items.reduce((acc, item) => acc + item.quantity, 0);
      console.log(`Inventory delta for orderCreated: ${inventoryDelta}`);
    } else if (mappedStatus === "cancelled") {
      inventoryDelta = order.items.reduce((acc, item) => acc + item.quantity, 0);
      console.log(`Inventory delta for cancelled: ${inventoryDelta}`);
    } else {
      console.log(`No inventory update required for status: ${mappedStatus}`);
    }

    // Update inventory for each order item if needed
    if (inventoryDelta !== 0) {
      console.log('Starting inventory updates for each order item.');
      for (const item of order.items) {
        console.log('Processing order item:', item);
        if (item.Option) {
          console.log(`Updating inventory for Option ${item.Option} with quantity multiplier ${item.quantity}`);
          await updateInventory(item.Option, inventoryDelta * item.quantity, session);
        } else if (item.product) {
          console.log(`Updating inventory for Product ${item.product} with quantity multiplier ${item.quantity}`);
          const result = await mongoose.model('Product').updateOne(
            { _id: item.product },
            { 
              $inc: { 
                'inventoryData.availableQuantity': inventoryDelta * item.quantity, 
                'inventoryData.reservedQuantity': -inventoryDelta * item.quantity 
              }
            },
            { session }
          );
          console.log(`Product inventory update result for product ${item.product}:`, result);
        } else {
          console.warn('Order item does not have an Option or product reference:', item);
        }
      }
      console.log('Completed inventory updates.');
    }

    // Update order delivery status
    console.log(`Updating order delivery status to '${mappedStatus}' (actual status: '${current_status}')`);
    order.deliveryStatus = mappedStatus;
    order.actualDeliveryStatus = current_status;
    await order.save({ session });
    console.log('Order updated successfully in the database.');

    await session.commitTransaction();
    session.endSession();
    console.log('Transaction committed successfully.');

    return NextResponse.json({ message: 'Order updated successfully.' }, { status: 200 });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Webhook error during processing:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
