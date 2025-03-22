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
  // delta > 0: order cancelled → available increases, reserved decreases
  // delta < 0: order created → available decreases, reserved increases
  return mongoose.model('Inventory').updateOne(
    { _id: inventoryId },
    {
      $inc: {
        availableQuantity: delta,
        reservedQuantity: -delta,
      },
    },
    { session }
  );
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request) {
  // Validate security token
  const receivedToken = request.headers.get('x-api-key');
  const expectedToken = process.env.SHIPROCKET_WEBHOOK_SECRET;
  if (receivedToken !== expectedToken) {
    console.error('Invalid security token');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);

    const { order_id, current_status } = payload;
    if (!order_id || !current_status) {
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // Validate that order_id is a valid ObjectId
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

    // Normalize the received status and map it using statusMapping
    const normalizedStatus = current_status.toLowerCase().replace(/[-_]/g, ' ').trim();
    const mappedStatus = statusMapping[normalizedStatus] || 'unknown';

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
    } else if (mappedStatus === "cancelled") {
      // Cancelled order: reverse the reserved; add back available.
      // (delta is positive, meaning add to available, subtract reserved.)
      inventoryDelta = order.items.reduce((acc, item) => acc + item.quantity, 0);
    }
    // For delivered and others, no update.
    
    // Update inventory for each order item if delta is non-zero.
    if (inventoryDelta !== 0) {
      // For each item in order.items:
      // If Option is present, update the Inventory referenced in that Option.
      // Otherwise, update the Inventory referenced in the Product.
      for (const item of order.items) {
        // If the item has an Option reference:
        if (item.Option) {
          await updateInventory(item.Option, inventoryDelta * (item.quantity), session);
        } else {
          // Otherwise, update the product's inventory.
          // Assume the Product model has an inventoryData field referencing an Inventory document.
          // You might need to fetch the product if not populated.
          // For this example, we assume order items include a reference (or you can query Product separately).
          if (item.product) {
            // For simplicity, assume we update using product.inventoryData.
            // In practice, you might need to populate the product.
            // Here we do a direct update:
            await mongoose.model('Product').updateOne(
              { _id: item.product },
              { $inc: { 'inventoryData.availableQuantity': inventoryDelta * item.quantity, 'inventoryData.reservedQuantity': -inventoryDelta * item.quantity } },
              { session }
            );
          }
        }
      }
    }

    // Update the order's delivery status fields
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
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
