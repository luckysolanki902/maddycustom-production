// app/api/checkout/order/create/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import User from '@/models/User';
import Coupon from '@/models/Coupon';
import ModeOfPayment from '@/models/ModeOfPayment';
import mongoose from 'mongoose';

export async function POST(request) {
  try {
    let {
      userId,
      phoneNumber,
      items,
      paymentModeId,
      address,
      couponCode,
      totalAmount,
      discountAmount,
      extraCharges,
    } = await request.json();

    // Validate input
    if ((!userId && !phoneNumber) || !items || !paymentModeId || !address || totalAmount == null) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find user
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    } else if (phoneNumber) {
      user = await User.findOne({ phoneNumber });
      if (user) {
        userId = user._id.toString();
      }
    }

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    // Find the latest existing pending order for the user
    const existingOrder = await Order.findOne({
      user: userId,
      paymentStatus: { $in: ['pending', 'paidPartially'] },
    }).sort({ createdAt: -1 });

    // Function to compare items arrays
    const itemsAreEqual = (items1, items2) => {
      if (items1.length !== items2.length) return false;

      const map1 = new Map();
      items1.forEach((item) => {
        const key = item.productId ? item.productId.toString() : item.product.toString();
        map1.set(key, item);
      });

      for (const item of items2) {
        const key = item.productId ? item.productId.toString() : item.product.toString();
        const item1 = map1.get(key);
        if (!item1) return false;

        if (
          item.quantity !== item1.quantity ||
          item.priceAtPurchase !== item1.priceAtPurchase
        ) {
          return false;
        }
      }

      return true;
    };

    // If an existing pending order with matching items is found, return that order's data
    if (existingOrder && itemsAreEqual(items, existingOrder.items)) {
      return NextResponse.json(
        {
          message: 'Existing pending order found',
          orderId: existingOrder._id,
          paymentDetails: existingOrder.paymentDetails,
        },
        { status: 200 }
      );
    }

    // Find payment mode
    const paymentMode = await ModeOfPayment.findById(paymentModeId);
    if (!paymentMode || !paymentMode.isActive) {
      return NextResponse.json(
        { message: 'Invalid or inactive payment mode' },
        { status: 400 }
      );
    }

    // Handle coupon
    let coupon = null;
    if (couponCode) {
      coupon = await Coupon.findOne({ code: couponCode, isActive: true });
      if (!coupon) {
        return NextResponse.json(
          { message: 'Invalid or inactive coupon code' },
          { status: 400 }
        );
      }

      // Ensure coupon is applicable based on usage, validity, etc.
      const now = new Date();
      if (now < coupon.validFrom || now > coupon.validUntil) {
        return NextResponse.json(
          { message: 'Coupon is not valid at this time' },
          { status: 400 }
        );
      }

      if (coupon.usageCount >= coupon.usagePerUser) {
        return NextResponse.json(
          { message: 'Coupon usage limit reached' },
          { status: 400 }
        );
      }
    }

    // Calculate payment splits based on payment mode configuration
    let amountPaidOnline = 0;
    let amountDueOnline = 0;
    let amountDueCod = 0;
    let amountPaidCod = 0;
    let paymentStatus = 'pending';

    if (paymentMode.configuration) {
      const onlinePercentage = paymentMode.configuration.onlinePercentage || 0;
      const codPercentage = paymentMode.configuration.codPercentage || 0;

      const totalPercentage = onlinePercentage + codPercentage;
      if (totalPercentage !== 100) {
        return NextResponse.json(
          { message: 'Payment mode percentages do not sum up to 100' },
          { status: 400 }
        );
      }

      amountPaidOnline = 0; // As per requirement
      amountDueOnline = Math.floor((totalAmount * onlinePercentage) / 100);
      amountDueCod = Math.ceil((totalAmount * codPercentage) / 100);
      amountPaidCod = 0;

      if (paymentMode.name === 'cod') {
        // For COD only, all amount is due via COD
        amountDueCod = totalAmount;
        amountDueOnline = 0;
        paymentStatus = 'allToBePaidCod';
      }
    } else {
      // Default to full COD if no configuration
      amountPaidOnline = 0;
      amountDueOnline = 0;
      amountDueCod = totalAmount;
      amountPaidCod = 0;
      paymentStatus = 'allToBePaidCod';
    }

    // Create new order
    const newOrder = new Order({
      user: userId,
      items: items,
      totalAmount: totalAmount,
      extraCharges: extraCharges || [],
      couponApplied: coupon
        ? {
            couponCode: coupon.code,
            discountAmount: discountAmount,
          }
        : null,
      paymentDetails: {
        mode: paymentModeId,
        amountPaidOnline: amountPaidOnline,
        amountDueOnline: amountDueOnline,
        amountDueCod: amountDueCod,
        amountPaidCod: amountPaidCod,
        razorpayDetails: {},
      },
      address: {
        receiverName: address.receiverName,
        receiverPhoneNumber: address.receiverPhoneNumber,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        country: address.country || 'India',
        pincode: address.pincode,
      },
      paymentStatus: paymentStatus,
      deliveryStatus: 'pending',
    });

    await newOrder.save();

    if (coupon) {
      // Increment coupon usage count
      coupon.usageCount += 1;
      await coupon.save();
    }

    return NextResponse.json(
      { message: 'Order created successfully', orderId: newOrder._id, paymentDetails: newOrder.paymentDetails },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
