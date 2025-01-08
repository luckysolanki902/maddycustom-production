// pages/api/update-orders.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';

// Define the handler for GET requests
export async function GET(req) {
    try {
        // Connect to the database
        await connectToDatabase();

        // Find orders where itemsCount or itemsTotal do not exist or are null
        const ordersToUpdate = await Order.find({
            $or: [
                { itemsCount: { $exists: false } },
                { itemsCount: null },
                { itemsTotal: { $exists: false } },
                { itemsTotal: null }
            ]
        });

        if (ordersToUpdate.length === 0) {
            return NextResponse.json({ message: 'No orders require updating.' }, { status: 200 });
        }

        // Prepare bulk operations
        const bulkOps = ordersToUpdate.map(order => {
            const itemsCount = order.items.reduce((count, item) => count + item.quantity, 0);
            const itemsTotal = order.items.reduce((total, item) => total + (item.priceAtPurchase * item.quantity), 0);

            return {
                updateOne: {
                    filter: { _id: order._id },
                    update: { itemsCount, itemsTotal },
                }
            };
        });

        // Execute bulk operations
        const bulkWriteResult = await Order.bulkWrite(bulkOps);

        return NextResponse.json({
            message: 'Orders updated successfully.',
            modifiedCount: bulkWriteResult.modifiedCount,
            matchedCount: bulkWriteResult.matchedCount,
            acknowledged: bulkWriteResult.acknowledged,
        }, { status: 200 });

    } catch (error) {
        console.error('Error updating orders:', error);
        return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
    }
}