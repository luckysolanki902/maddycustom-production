// app/api/checkout/order/payment/verify/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import Coupon from '@/models/Coupon'; // Import Coupon model
import crypto from 'crypto';

/**
 * Handles POST requests to verify Razorpay payments and update order status.
 * This endpoint is primarily for instant UI updates.
 */
export async function POST(request) {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = await request.json();

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
      // console.warn('Payment verification failed: Missing required fields in API request.');
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const razorpaySecret = process.env.RAZORPAY_SECRET;
    if (!razorpaySecret) {
      console.error('Payment verification failed: RAZORPAY_SECRET is not set.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const computedSignature = crypto
      .createHmac('sha256', razorpaySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    try {
      const isValidSignature = crypto.timingSafeEqual(
        Buffer.from(computedSignature, 'hex'),
        Buffer.from(razorpay_signature, 'hex')
      );

      if (!isValidSignature) {
        // console.warn('Payment verification failed: Invalid Razorpay signature in API request.');
        return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
      }
    } catch (signatureError) {
      console.error('Payment verification failed: Error during signature verification.', signatureError.message);
      return NextResponse.json({ error: 'Invalid signature format.' }, { status: 400 });
    }

    await connectToDatabase();

    const order = await Order.findById(orderId).exec();
    if (!order) {
      // console.warn(`Payment verification failed: Order not found for ID: ${orderId}`);
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Get all linked orders for payment processing
    const linkedOrders = order.linkedOrderIds.length > 0 
      ? await Order.find({ _id: { $in: order.linkedOrderIds } }).exec()
      : [];
    
    const allOrders = [order, ...linkedOrders];

    // Check if any order in the group is already processed
    const alreadyProcessed = allOrders.some(ord => 
      ['allPaid', 'paidPartially'].includes(ord.paymentStatus)
    );

    if (alreadyProcessed) {
      // console.warn(`Payment verification skipped: Order group already processed.`);
      return NextResponse.json({ message: 'Order already processed.' }, { status: 200 });
    }

    // Update payment details for all orders with online payments due
    for (const ord of allOrders) {
      if (ord.paymentDetails.amountDueOnline > 0) {
        ord.paymentDetails.razorpayDetails = {
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
        };

        // Calculate the amount paid online based on the payment mode
        ord.paymentDetails.amountPaidOnline += ord.paymentDetails.amountDueOnline;
        ord.paymentDetails.amountDueOnline = 0;

        // Update paymentStatus based on remaining dues
        if (ord.paymentDetails.amountDueCod <= 0) {
          ord.paymentStatus = 'allPaid';
        } else {
          ord.paymentStatus = 'paidPartially';
        }

        await ord.save();
      }
    }

    // Increment usageCount for the applied coupon if not already done
    // Check the main order (first one) for coupon details
    const mainOrder = allOrders.find(ord => ord.isMainOrder) || allOrders[0];
    if (mainOrder.couponApplied && mainOrder.couponApplied.length > 0) {
      const appliedCoupon = mainOrder.couponApplied[0]; // Assuming only one coupon is applied
      if (appliedCoupon.couponCode && !appliedCoupon.incrementedCouponUsage) {
        const coupon = await Coupon.findOne({ code: appliedCoupon.couponCode }).exec();
        if (coupon) {
          coupon.usageCount += 1;
          await coupon.save();
          
          // Mark coupon as incremented in all orders
          for (const ord of allOrders) {
            if (ord.couponApplied && ord.couponApplied.length > 0) {
              ord.couponApplied = ord.couponApplied.map(couponEntry =>
                couponEntry.couponCode === appliedCoupon.couponCode
                  ? { ...couponEntry.toObject(), incrementedCouponUsage: true }
                  : couponEntry
              );
              await ord.save();
            }
          }
        } else {
          // console.warn(`Coupon not found for code: ${appliedCoupon.couponCode}`);
        }
      }
    }
    return NextResponse.json({ message: 'Payment verified successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Error in payment verification API:', error.message);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
