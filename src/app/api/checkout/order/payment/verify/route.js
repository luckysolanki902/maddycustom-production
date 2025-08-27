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

  let order = await Order.findById(orderId).exec();
    if (!order) {
      // console.warn(`Payment verification failed: Order not found for ID: ${orderId}`);
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // If this order belongs to a group and is not primary, fetch primary for payment distribution
    if (order.groupId && !order.isGroupPrimary && order.parentPaymentOrder) {
      const primary = await Order.findById(order.parentPaymentOrder).exec();
      if (primary) order = primary;
    }

    // Group distribution path
    if (order.isGroupPrimary && order.groupId) {
      if (order.groupPaymentLocked) {
        return NextResponse.json({ message: 'Group payment already processed.' }, { status: 200 });
      }
      // Gather all group orders
      const groupOrders = await Order.find({ groupId: order.groupId }).exec();
      const totalOnlineExpected = groupOrders.reduce((s, o) => s + o.paymentDetails.amountDueOnline, 0);
      // Basic assumption: full capture happened for expected online; client verify triggered post success page
      // We don't verify amount value here (signature already validated) - web hook will perform deeper reconciliation.
      for (const g of groupOrders) {
        if (g.paymentDetails.amountDueOnline > 0) {
          g.paymentDetails.amountPaidOnline += g.paymentDetails.amountDueOnline;
          g.paymentDetails.amountDueOnline = 0;
        }
        // Update paymentStatus per order
        if (g.paymentDetails.amountDueCod > 0) {
          g.paymentStatus = 'paidPartially';
        } else {
          g.paymentStatus = 'allPaid';
        }
      }
      order.groupPaymentLocked = true;
      // Increment coupon usage once (primary only)
      if (order.couponApplied?.length) {
        const applied = order.couponApplied[0];
        if (applied.couponCode && !applied.incrementedCouponUsage) {
          try {
            const coupon = await Coupon.findOne({ code: applied.couponCode }).exec();
            if (coupon) { coupon.usageCount += 1; await coupon.save(); applied.incrementedCouponUsage = true; }
          } catch (e) { console.error('Coupon increment failed (verify route group):', e.message); }
        }
      }
      await Promise.all(groupOrders.map(o => o.save()));
      return NextResponse.json({ message: 'Group payment verified.' }, { status: 200 });
    }

    if (['allPaid', 'paidPartially'].includes(order.paymentStatus)) {
      return NextResponse.json({ message: 'Order already processed.' }, { status: 200 });
    }

    // Update order payment details
    order.paymentDetails.razorpayDetails = {
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    };

    // Calculate the amount paid online based on the payment mode
    // Assuming the entire amountDueOnline is being paid
    order.paymentDetails.amountPaidOnline += order.paymentDetails.amountDueOnline;
    order.paymentDetails.amountDueOnline = 0;

    // Update paymentStatus based on remaining dues
    if (order.paymentDetails.amountDueCod <= 0) {
      order.paymentStatus = 'allPaid';
    } else {
      order.paymentStatus = 'paidPartially';
    }

    // Increment usageCount for the applied coupon if not already done
    if (order.couponApplied && order.couponApplied.length > 0) {
      const appliedCoupon = order.couponApplied[0]; // Assuming only one coupon is applied
      if (appliedCoupon.couponCode && !appliedCoupon.incrementedCouponUsage) {
        const coupon = await Coupon.findOne({ code: appliedCoupon.couponCode }).exec();
        if (coupon) {
          coupon.usageCount += 1;
          await coupon.save();
          appliedCoupon.incrementedCouponUsage = true;
          order.couponApplied = order.couponApplied.map(couponEntry =>
            couponEntry.couponCode === appliedCoupon.couponCode
              ? { ...couponEntry.toObject(), incrementedCouponUsage: true }
              : couponEntry
          );
        } else {
          // console.warn(`Coupon not found for code: ${appliedCoupon.couponCode}`);
        }
      }
    }

  await order.save();
  return NextResponse.json({ message: 'Payment verified successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Error in payment verification API:', error.message);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
