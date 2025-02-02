// app/api/checkpurchase/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import User from '@/models/User';

export async function GET(req) {

    try {
        await connectToDatabase();

        const { searchParams } = new URL(req.url);
        const phoneNumber = searchParams.get('phoneNumber');
        const productId = searchParams.get('productId');
        console.log({ productId, phoneNumber },)


        if (!phoneNumber || !productId) {
            return NextResponse.json(
                { success: false, message: 'phoneNumber and productId are required' },
                { status: 400 }
            );
        }

        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return NextResponse.json(
                { success: false, message: 'No matching order found', hasPurchased: false },
                { status: 404 }
            );
        }

        // Find orders where address.receiverPhoneNumber matches and items array contains the productId
        const order = await Order.findOne({
            'address.receiverPhoneNumber': phoneNumber,
            'items.product': productId,
        }).select('address.receiverName');

        if (order) {
            return NextResponse.json(
                { success: true, message: 'Order found', receiverName: order.address.receiverName, hasPurchased: true, userId: user._id },
                { status: 200 }
            );
        } else {
            return NextResponse.json(
                { success: false, message: 'No matching order found', hasPurchased: false },

                { status: 404 }
            );
        }
    } catch (error) {
        console.error('Error fetching order:', error);
        return NextResponse.json(
            { success: false, message: 'Internal Server Error', hasPurchased: false },
            { status: 500 }
        );
    }
}
