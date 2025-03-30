// app/api/checkout/order/create/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import User from '@/models/User';
import Offer from '@/models/Offer';
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
      couponCode, // This now refers to an offer code
      totalAmount,
      discountAmount,
      extraCharges,
      utmDetails,
      extraFields,
    } = await request.json();

    // Validate input
    if ((!userId && !phoneNumber) || !items || !paymentModeId || !address || totalAmount == null) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const isTestingOrder = process.env.isTestingOrder || false;
    await connectToDatabase();

    // Find or create user
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    } else if (phoneNumber) {
      user = await User.findOne({ phoneNumber });
      if (!user) {
        user = new User({ phoneNumber });
        await user.save();
      }
      userId = user._id.toString();
    }

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
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

    // Handle offer (previously coupon)
    let offer = null;
    if (couponCode) {
      offer = await Offer.findOne({
        couponCodes: couponCode.toUpperCase(),
        isActive: true,
      });
      if (!offer) {
        return NextResponse.json(
          { message: 'Invalid or inactive offer code' },
          { status: 400 }
        );
      }

      // Get current time in IST
      const currentDateIST = moment().tz('Asia/Kolkata').toDate();
      if (currentDateIST < offer.validFrom || currentDateIST > offer.validUntil) {
        return NextResponse.json(
          { message: 'Offer is expired or not yet valid.' },
          { status: 400 }
        );
      }

      // Additional checks such as usage limits or condition evaluation can be added here.
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
      if (paymentMode.name.toLowerCase() === 'cod') {
        amountDueCod = totalAmount;
        amountDueOnline = 0;
        paymentStatus = 'allToBePaidCod';
      }
    } else {
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
      totalDiscount: discountAmount || 0,
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
      isTestingOrder: isTestingOrder,
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
