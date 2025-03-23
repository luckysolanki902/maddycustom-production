// app/api/webhooks/delivery/update-status/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Inventory from '@/models/Inventory';
import Option from '@/models/Option';
import mongoose from 'mongoose';
import { statusMapping } from '@/lib/constants/shiprocketStatusMapping';

// Helper: Update inventory for a given inventory document _id
// delta: a number (positive to add to available and subtract from reserved; negative to do the opposite)
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

    // Validate that order_id is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(order_id)) {
      console.error('Invalid order_id format:', order_id);
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json(
        { message: 'Webhook triggered, but provided order_id is not a valid MongoDB ObjectId.' },
        { status: 200 }
      );
    }

    const order = await Order.findById(order_id).session(session);
    if (!order) {
      console.error('Order not found for order_id:', order_id);
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    console.log('Order found:', order);

    // Normalize the received status and map it using statusMapping
    const normalizedStatus = current_status.toLowerCase().replace(/[-_]/g, ' ').trim();
    const mappedStatus = statusMapping[normalizedStatus] || 'unknown';
    console.log(`Mapped status for '${current_status}' (normalized: '${normalizedStatus}') is '${mappedStatus}'`);

    // Determine if we need to update inventory.
    // Our logic:
    // - If status is "orderCreated": update inventory by reducing available and increasing reserved.
    //   (Typically, that update would occur when the order is created, so we may not adjust it here.)
    // - If status is "cancelled": update inventory to release reserved stock.
    // - If status is "delivered": no inventory change.
    // - For other statuses, no inventory change.
    let inventoryDelta = 0;
    if (mappedStatus === "orderCreated") {
      // New order: reduce available, increase reserved.
      // (delta is negative, because we want to subtract available and add to reserved.)
      inventoryDelta = -1 * order.items.reduce((acc, item) => acc + item.quantity, 0);
      console.log(`Inventory delta for orderCreated: ${inventoryDelta}`);
    } else if (mappedStatus === "cancelled") {
      // Cancelled order: reverse the reserved; add back available.
      // (delta is positive, meaning add to available, subtract reserved.)
      inventoryDelta = order.items.reduce((acc, item) => acc + item.quantity, 0);
      console.log(`Inventory delta for cancelled: ${inventoryDelta}`);
    } else {
      console.log(`No inventory update required for status: ${mappedStatus}`);
    }

    // Update inventory for each order item if delta is non-zero.
    if (inventoryDelta !== 0) {
      console.log('Starting inventory updates for each order item.');
      // For each item in order.items:
      // If Option is present, update the Inventory referenced in that Option.
      // Otherwise, update the Inventory referenced in the Product.
      for (const item of order.items) {
        console.log('Processing order item:', item);
        // If the item has an Option reference:
        if (item.Option) {
          console.log(`Updating inventory for Option ${item.Option} with quantity multiplier ${item.quantity}`);
          await updateInventory(item.Option, inventoryDelta * item.quantity, session);
        } else if (item.product) {
          console.log(`Updating inventory for Product ${item.product} with quantity multiplier ${item.quantity}`);
          // Update using product.inventoryData. If needed, you might fetch product details to ensure the inventoryData field is available.
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

    // Update the order's delivery status fields
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
