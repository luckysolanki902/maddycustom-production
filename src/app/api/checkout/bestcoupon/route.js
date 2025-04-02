// app/api/checkout/bestcoupon/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import Offer from '@/models/Offer';
import { NextResponse } from 'next/server';
import moment from 'moment-timezone';

export async function GET(req) {
  await connectToDatabase();

  try {
    // Get current time in IST (if needed for validity checks)
    const currentDateIST = moment().tz('Asia/Kolkata').toDate();

    // Parse the query parameter 'cartValue' from the request URL
    const { searchParams } = new URL(req.url);
    const cartValue = parseFloat(searchParams.get('cartValue')) || 0;

    // Fetch an active offer with a cart_value condition.
    // Here, we simply fetch one offer sorted by highest priority as an example.
    const bestOffer = await Offer.findOne({
      isActive: true,
      'conditions.type': 'cart_value',
      validFrom: { $lte: currentDateIST },
      validUntil: { $gte: currentDateIST },
    }).sort({ priority: -1 }).select('-__v -createdAt -updatedAt');

    if (!bestOffer) {
      return NextResponse.json(
        { message: 'No offers available at the moment.' },
        { status: 200 }
      );
    }

    // Extract the cart_value condition (if present) and compute shortfall.
    const cartCondition = bestOffer.conditions.find(
      (cond) => cond.type === 'cart_value'
    );
    const requiredCartValue = cartCondition ? cartCondition.value : 0;
    const shortfall = Math.max(0, requiredCartValue - cartValue);

    // Get discount percent from the bestOffer's actions (if applicable).
    const discountAction = bestOffer.actions.find(
      (action) => action.type === 'discount_percent'
    );
    const discountPercent = discountAction ? discountAction.discountValue : 0;

    const responseData = {
      bestOffer: {
        name: bestOffer.name,
        discountPercent,
        requiredCartValue,
      },
      shortfall,
      message:
        shortfall > 0
          ? `Add ₹${shortfall} more to unlock ${discountPercent}% off coupon!`
          : `You have unlocked ${discountPercent}% off coupon!`,
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error('Error fetching best coupon:', error.message);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
