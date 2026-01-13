// Create Razorpay order for existing order
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import Razorpay from 'razorpay';
import shortid from 'shortid';

// MUST be dynamic: Payment creation requires real-time, secure handling
export const dynamic = 'force-dynamic';

/**
 * Calculate total amountDueOnline from all linked orders (for split orders)
 * @param {Object} order - The main order document
 * @returns {Promise<number>} - Total amount due online across all linked orders
 */
async function getTotalAmountDueOnline(order) {
  // If no linked orders, return this order's amount
  if (!order.linkedOrderIds || order.linkedOrderIds.length === 0) {
    return order.paymentDetails?.amountDueOnline || order.totalAmount;
  }

  // Fetch all linked orders and sum their amountDueOnline
  const linkedOrders = await Order.find({ _id: { $in: order.linkedOrderIds } })
    .select('paymentDetails.amountDueOnline totalAmount')
    .lean();

  const thisOrderAmount = order.paymentDetails?.amountDueOnline || order.totalAmount;
  const totalAmount = thisOrderAmount + 
    linkedOrders.reduce((sum, linkedOrder) => {
      return sum + (linkedOrder.paymentDetails?.amountDueOnline || linkedOrder.totalAmount || 0);
    }, 0);

  return totalAmount;
}

// Lazy initialization of Razorpay instance
let razorpayInstance = null;
const getRazorpayInstance = () => {
  if (!razorpayInstance && process.env.RAZORPAY_KEY && process.env.RAZORPAY_SECRET) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY,
      key_secret: process.env.RAZORPAY_SECRET,
    });
  }
  return razorpayInstance;
};

export async function POST(request) {
  try {
    await connectToDatabase();
    
    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Fetch the order
    const order = await Order.findById(orderId);
    
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Calculate total amount across all linked orders (for split orders)
    const totalAmountDueOnline = await getTotalAmountDueOnline(order);

    // Check if Razorpay order already exists
    if (order.paymentDetails?.razorpayDetails?.orderId) {
      return NextResponse.json({
        success: true,
        razorpayOrderId: order.paymentDetails.razorpayDetails.orderId,
        amount: totalAmountDueOnline,
        existing: true,
      });
    }

    // Create new Razorpay order
    const amountDueOnline = totalAmountDueOnline;
    const amountInPaise = Math.floor(amountDueOnline * 100);
    const receiptId = shortid.generate();

    const razorpayOptions = {
      amount: amountInPaise.toString(),
      currency: 'INR',
      receipt: receiptId,
      payment_capture: 1,
      notes: {
        databaseOrderId: order._id.toString(),
        orderGroupId: order.orderGroupId || '',
      },
    };

    const razorpay = getRazorpayInstance();
    if (!razorpay) {
      throw new Error('Razorpay is not configured');
    }
    const razorpayOrderResponse = await razorpay.orders.create(razorpayOptions);

    // Update order with Razorpay details
    if (!order.paymentDetails.razorpayDetails) {
      order.paymentDetails.razorpayDetails = {};
    }
    order.paymentDetails.razorpayDetails.orderId = razorpayOrderResponse.id;
    order.paymentDetails.razorpayDetails.receipt = receiptId;
    await order.save();

    return NextResponse.json({
      success: true,
      razorpayOrderId: razorpayOrderResponse.id,
      amount: totalAmountDueOnline,
      existing: false,
    });

  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create Razorpay order',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
