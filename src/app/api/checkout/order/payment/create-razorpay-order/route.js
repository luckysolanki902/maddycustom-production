import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import shortid from 'shortid';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET,
});

const isTesting = process.env.IS_TESTING === 'true' || false;

export async function POST(request) {
    try {
        const { price, orderId } = await request.json();

        if (!price || !orderId) {
            return NextResponse.json(
                { msg: 'Price and orderId are required' },
                { status: 400 }
            );
        }

        await connectToDatabase();

        // Find the order
        const order = await Order.findById(orderId).populate('paymentDetails.mode');
        if (!order) {
            return NextResponse.json(
                { msg: 'Invalid order' },
                { status: 400 }
            );
        }
        else if (order && order.status !== 'pending') {
            return NextResponse.json(
                { msg: 'Order is already created' },
                { status: 400 }
            );
        }

        // Determine the amount to be paid online based on payment mode
        let amountToPayOnline = order.paymentDetails.amountPaidOnline;

        if (order.paymentDetails.mode.type === 'cod') {
            return NextResponse.json(
                { msg: 'No online payment required for COD' },
                { status: 400 }
            );
        } else {
            amountToPayOnline = order.paymentDetails.amountPaidOnline;
        }

        // Calculate the amount in the smallest currency unit (e.g., paise)
        const actualAmount = parseInt(amountToPayOnline, 10);
        const amount = isTesting ? 100 : actualAmount * 100; // in paise
        const currency = 'INR';

        const options = {
            amount: amount.toString(),
            currency,
            receipt: shortid.generate(),
            payment_capture: 1,
        };

        const razorpayOrder = await instance.orders.create(options);

        // Update the order with Razorpay details
        order.paymentDetails.razorpayDetails.orderId = razorpayOrder.id;
        await order.save();

        return NextResponse.json(
            { msg: 'success', order: razorpayOrder },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        return NextResponse.json(
            { msg: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
