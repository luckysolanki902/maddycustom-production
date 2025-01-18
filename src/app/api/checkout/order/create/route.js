// app/api/checkout/order/create/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import User from '@/models/User';
import Coupon from '@/models/Coupon';
import ModeOfPayment from '@/models/ModeOfPayment';
import mongoose from 'mongoose';
import moment from 'moment-timezone';

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
      utmDetails,
      extraFields,
    } = await request.json();
    // Validate input
    if ((!userId && !phoneNumber) || !items || !paymentModeId || !address || totalAmount == null) {
      // console.warn('Order creation failed: Missing required fields.');
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find or create user
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    } else if (phoneNumber) {
      user = await User.findOne({ phoneNumber });
      if (!user) {
        // Create a new user if not found
        user = new User({ phoneNumber });
        await user.save();
      }
      userId = user._id.toString();
    }

    if (!user) {
      // console.warn(`User not found during order creation: userId=${userId}, phoneNumber=${phoneNumber}`);
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }


    // Find payment mode
    const paymentMode = await ModeOfPayment.findById(paymentModeId);
    if (!paymentMode || !paymentMode.isActive) {
      // console.warn(`Invalid or inactive payment mode attempted: paymentModeId=${paymentModeId}`);
      return NextResponse.json(
        { message: 'Invalid or inactive payment mode' },
        { status: 400 }
      );
    }

    // Handle coupon
    let coupon = null;
    if (couponCode) {
      coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (!coupon) {
        // console.warn(`Invalid or inactive coupon code attempted: ${couponCode}`);
        return NextResponse.json(
          { message: 'Invalid or inactive coupon code' },
          { status: 400 }
        );
      }

      // Get current time in IST
      const currentDateIST = moment().tz('Asia/Kolkata').toDate();

      // Ensure coupon is applicable based on usage, validity, etc.
      if (currentDateIST < coupon.validFrom || currentDateIST > coupon.validUntil) {
        // console.warn(`Coupon code expired or not yet valid: ${couponCode}`);
        return NextResponse.json(
          { message: 'Coupon is expired or not yet valid.' },
          { status: 400 }
        );
      }

      // Check if usage limit per user is reached (if applicable)
      // TODO Later: Implement per-user usage tracking if required

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
        // console.warn(`Payment mode percentages do not sum up to 100 for paymentModeId=${paymentModeId}`);
        return NextResponse.json(
          { message: 'Payment mode percentages do not sum up to 100' },
          { status: 400 }
        );
      }

      amountPaidOnline = 0; // As per requirement
      amountDueOnline = Math.floor((totalAmount * onlinePercentage) / 100);
      amountDueCod = Math.ceil((totalAmount * codPercentage) / 100);
      amountPaidCod = 0;

      if (paymentMode.name.toLowerCase() === 'cod') {
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
      totalDiscount: discountAmount || 0, // Set totalDiscount
      extraCharges: extraCharges || [],
      couponApplied: couponCode
        ? [{
          couponCode: couponCode.toUpperCase(),
          discountAmount: discountAmount || 0,
          incrementedCouponUsage: false, // Initialize as false
        }]
        : [],
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
      utmDetails: utmDetails,
      extraFields: extraFields,
    });

    await newOrder.save();

    return NextResponse.json(
      { message: 'Order created successfully', orderId: newOrder._id, paymentDetails: newOrder.paymentDetails },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating order:', error.message);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
