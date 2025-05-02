// app/api/checkout/bestcoupon/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Offer from '@/models/Offer';
import { NextResponse } from 'next/server';
import moment from 'moment-timezone';

export async function GET(request) {
  await connectToDatabase();

  try {
    // 1) Parse cart value and current IST time
    const { searchParams } = new URL(request.url);
    const cartValue = parseFloat(searchParams.get('cartValue')) || 0;
    const nowIst = moment().tz('Asia/Kolkata');

    // 2) Fetch only active, cart-value offers valid right now in IST
    const offers = await Offer.find({
      isActive: true,
      'conditions.type': 'cart_value',
      validFrom: { $lte: nowIst.toDate() },
      validUntil: { $gte: nowIst.toDate() },
    }).select('-__v -createdAt -updatedAt');

    if (!offers.length) {
      return NextResponse.json(
        { message: 'No offers available at the moment.' },
        { status: 200 }
      );
    }

    // 3) Compute requiredCartValue, shortfall, discount details & effectiveDiscount
    const mapped = offers.map((offer) => {
      const cartCond = offer.conditions.find(c => c.type === 'cart_value') || {};
      const requiredCartValue = cartCond.value || 0;
      const shortfall = Math.max(0, requiredCartValue - cartValue);

      const action = offer.actions.find(a =>
        a.type === 'discount_percent' || a.type === 'discount_fixed'
      ) || {};

      let discountType = null;
      let discountValue = 0;
      let effectiveDiscount = 0;

      if (action.type === 'discount_percent') {
        discountType = 'percentage';
        discountValue = action.discountValue;
        effectiveDiscount = (discountValue / 100) * cartValue;
        if (offer.discountCap && effectiveDiscount > offer.discountCap) {
          effectiveDiscount = offer.discountCap;
        }
      } else if (action.type === 'discount_fixed') {
        discountType = 'fixed';
        discountValue = action.discountValue;
        effectiveDiscount = discountValue;
      }

      return {
        name: offer.name,
        requiredCartValue,
        shortfall,
        discountType,
        discountValue,
        effectiveDiscount,
      };
    });

    // 4) If any are already applicable (shortfall === 0), pick the one with max effectiveDiscount
    const applicable = mapped.filter(o => o.shortfall === 0);
    if (applicable.length) {
      applicable.sort((a, b) => b.effectiveDiscount - a.effectiveDiscount);
      const best = applicable[0];
      const message =
        best.discountType === 'percentage'
          ? `Apply coupon now to get ${best.discountValue}% off!`
          : `Apply coupon now to get ₹${best.discountValue} off!`;

      return NextResponse.json(
        {
          bestOffer: {
            name: best.name,
            discountType: best.discountType,
            discountValue: best.discountValue,
            requiredCartValue: best.requiredCartValue,
            effectiveDiscount: best.effectiveDiscount,
          },
          shortfall: 0,
          message,
        },
        { status: 200 }
      );
    }

    // 5) Otherwise, pick the “locked” offer with smallest shortfall (tie-break by highest discount)
    const locked = mapped.filter(o => o.shortfall > 0);
    locked.sort((a, b) => {
      if (a.shortfall !== b.shortfall) return a.shortfall - b.shortfall;
      return b.discountValue - a.discountValue;
    });
    const bestLocked = locked[0];
    const lockedMessage =
      bestLocked.discountType === 'percentage'
        ? `Add ₹${bestLocked.shortfall} more to unlock ${bestLocked.discountValue}% off coupon!`
        : `Add ₹${bestLocked.shortfall} more to unlock ₹${bestLocked.discountValue} off coupon!`;

    return NextResponse.json(
      {
        bestOffer: {
          name: bestLocked.name,
          discountType: bestLocked.discountType,
          discountValue: bestLocked.discountValue,
          requiredCartValue: bestLocked.requiredCartValue,
        },
        shortfall: bestLocked.shortfall,
        message: lockedMessage,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching coupon info:', error);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
