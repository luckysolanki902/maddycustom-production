// app/api/webhooks/delivery/update-status/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import mongoose from 'mongoose';
import { statusMapping } from '@/lib/constants/shiprocketStatusMapping';
import Inventory from '@/models/Inventory';
import Option from '@/models/Option';
import Product from '@/models/Product';

// Helper: Restore inventory for cancelled orders.
// This adds back the sold quantity: availableQuantity increases by qty and reservedQuantity decreases by qty.
async function restoreInventory(inventoryId, qty, session) {
  const result = await mongoose.model('Inventory').updateOne(
    { _id: inventoryId },
    {
      $inc: {
        availableQuantity: qty,
        reservedQuantity: -qty,
      },
    },
    { session }
  );
  return result;
}

// Helper: Clear reserved inventory for delivered orders.
// This subtracts the quantity from reservedQuantity only.
async function clearReservedInventory(inventoryId, qty, session) {
  const result = await mongoose.model('Inventory').updateOne(
    { _id: inventoryId },
    {
      $inc: {
        reservedQuantity: -qty,
      },
    },
    { session }
  );
  return result;
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
    console.error('Invalid security token:', receivedToken);
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
      console.error('Missing required fields in payload:', payload);
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // Look up the order by _id if valid, otherwise by shiprocketOrderId.
    let order;
    if (mongoose.Types.ObjectId.isValid(order_id)) {
      order = await Order.findById(order_id).session(session);
    } else {
      order = await Order.findOne({ shiprocketOrderId: order_id }).session(session);
    }

    if (!order) {
      console.error('Order not found for provided order identifier:', order_id);
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Normalize and map the current status
    const normalizedStatus = current_status.toLowerCase().replace(/[-_]/g, ' ').trim();
    const mappedStatus = statusMapping[normalizedStatus] || 'unknown';

    // Determine inventory action based on mapped status:
    // - For "cancelled": restore inventory (move quantity from reserved back to available).
    // - For "delivered": clear reserved inventory (finalize sale by clearing the reserved count).
    let inventoryAction = null;
    if (mappedStatus === 'cancelled') {
      inventoryAction = 'restore';
    } else if (mappedStatus === 'delivered') {
      inventoryAction = 'clearReserved';
    } else {
    }

    // If an inventory action is needed, process each order item accordingly.
    if (inventoryAction) {
      for (const item of order.items) {
        // Check if the order item uses an Option.
        // Some orders may use the legacy field "Option" (uppercase) or the newer "option" (lowercase).
        if (item.Option || item.option) {
          const optionId = item.Option || item.option;
          const optionDoc = await Option.findById(optionId).session(session);
          if (optionDoc?.inventoryData) {
            if (inventoryAction === 'restore') {
              await restoreInventory(optionDoc.inventoryData, item.quantity, session);
            } else if (inventoryAction === 'clearReserved') {
              await clearReservedInventory(optionDoc.inventoryData, item.quantity, session);
            }
          } else {
          }
        } else if (item.product) {
          const productDoc = await Product.findById(item.product).session(session);
          if (productDoc?.inventoryData) {
            if (inventoryAction === 'restore') {
              await restoreInventory(productDoc.inventoryData, item.quantity, session);
            } else if (inventoryAction === 'clearReserved') {
              await clearReservedInventory(productDoc.inventoryData, item.quantity, session);
            }
          } else {
          }
        } else {
        }
      }
    }

    // Update order delivery status
    order.deliveryStatus = mappedStatus;
    order.actualDeliveryStatus = current_status;
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return NextResponse.json({ message: 'Order updated successfully.' }, { status: 200 });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Webhook error during processing:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
