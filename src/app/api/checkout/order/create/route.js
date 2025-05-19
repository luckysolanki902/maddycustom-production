// app/api/checkout/order/create/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import User from '@/models/User';
import Offer from '@/models/Offer';
import ModeOfPayment from '@/models/ModeOfPayment';
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

    // Basic validation
    if ((!userId && !phoneNumber) || !items || !paymentModeId || !address || totalAmount == null) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const isTestingOrder = process.env.isTestingOrder || false;
    await connectToDatabase();

    // Prepare parallel database queries for better performance
    const promises = [];
    
    // Find payment mode (essential for order creation)
    const paymentModePromise = ModeOfPayment.findById(paymentModeId, { 
      name: 1, 
      isActive: 1, 
      configuration: 1 
    }).lean();
    promises.push(paymentModePromise);
    
    // Find or create user (if needed)
    let userPromise;
    if (userId) {
      userPromise = User.findById(userId, { _id: 1 }).lean();
    } else if (phoneNumber) {
      userPromise = User.findOne({ phoneNumber }, { _id: 1 }).lean();
    }
    promises.push(userPromise);
    
    // Find offer (if coupon code provided)
    let offerPromise = null;
    if (couponCode) {
      offerPromise = Offer.findOne({
        couponCodes: couponCode.toUpperCase(),
        isActive: true,
      }, { 
        _id: 1, 
        validFrom: 1, 
        validUntil: 1 
      }).lean();
      promises.push(offerPromise);
    }
    
    // Wait for all database queries to complete
    const results = await Promise.all(promises);
    
    // Extract results
    const paymentMode = results[0];
    let user = results[1];
    let offer = offerPromise ? results[2] : null;
    
    // Validate payment mode
    if (!paymentMode || !paymentMode.isActive) {
      return NextResponse.json(
        { message: 'Invalid or inactive payment mode' },
        { status: 400 }
      );
    }
    
    // Handle user creation if needed
    if (!user && phoneNumber) {
      const newUser = new User({ phoneNumber });
      user = await newUser.save();
    }
    
    if (!user) {
      return NextResponse.json(
        { message: 'User not found or could not be created' },
        { status: 404 }
      );
    }
    
    // If we have an offer, verify it's valid
    if (couponCode && offer) {
      // Get current time in IST
      const currentDateIST = moment().tz('Asia/Kolkata').toDate();
      if (currentDateIST < offer.validFrom || currentDateIST > offer.validUntil) {
        return NextResponse.json(
          { message: 'Offer is expired or not yet valid.' },
          { status: 400 }
        );
      }
    }
    
    // Calculate payment splits
    let amountPaidOnline = 0;
    let amountDueOnline = 0;
    let amountDueCod = 0;
    let amountPaidCod = 0;
    let paymentStatus = 'pending';

    if (paymentMode.configuration) {
      const onlinePercentage = paymentMode.configuration.onlinePercentage || 0;
      const codPercentage = paymentMode.configuration.codPercentage || 0;
      
      // Fast path for common cases
      if (paymentMode.name && paymentMode.name.toLowerCase() === 'cod') {
        amountDueOnline = 0;
        amountDueCod = totalAmount;
        paymentStatus = 'allToBePaidCod';
      } else if (onlinePercentage === 100) {
        amountDueOnline = totalAmount;
        amountDueCod = 0;
      } else {
        // Mixed payment mode
        amountDueOnline = Math.floor((totalAmount * onlinePercentage) / 100);
        amountDueCod = Math.ceil((totalAmount * codPercentage) / 100);
      }
    } else {
      // Default to COD if no configuration
      amountDueCod = totalAmount;
      paymentStatus = 'allToBePaidCod';
    }

    // Create new order document
    const newOrder = {
      user: user._id,
      items: items,
      totalAmount: totalAmount,
      totalDiscount: discountAmount || 0,
      extraCharges: extraCharges || [],
      couponApplied: couponCode
        ? [{
            couponCode: couponCode.toUpperCase(),
            discountAmount: discountAmount || 0,
            incrementedCouponUsage: false,
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
    };

    const order = new Order(newOrder);
    await order.save();

    // Return minimal data needed for the next steps
    return NextResponse.json(
      { 
        message: 'Order created successfully', 
        orderId: order._id, 
        paymentDetails: {
          amountDueOnline: amountDueOnline,
          amountDueCod: amountDueCod
        }
      },
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
