// app/api/checkout/applicablecoupon/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import Offer from '@/models/Offer';
import { NextResponse } from 'next/server';
import moment from 'moment-timezone';

export async function GET(request) {
  await connectToDatabase();

  try {
    const { searchParams } = new URL(request.url);
    const cartValue = parseFloat(searchParams.get('cartValue')) || 0;

    const nowIst     = moment().tz('Asia/Kolkata');
    const startOfDay = nowIst.clone().startOf('day');
    const endOfDay   = nowIst.clone().endOf('day');

    // fetch all active cart_value offers
    const allOffers = await Offer.find({
      isActive: true,
      'conditions.type': 'cart_value',
    }).select('-__v -createdAt -updatedAt');

    // filter by validity today in IST
    const dateValid = allOffers.filter(offer => {
      const startIst = moment(offer.validFrom).tz('Asia/Kolkata').startOf('day');
      const endIst   = moment(offer.validUntil).tz('Asia/Kolkata').endOf('day');
      return nowIst.isBetween(startIst, endIst, null, '[]');
    });

    if (dateValid.length === 0) {
      return NextResponse.json(
        { message: 'No offers available at the moment.' },
        { status: 200 }
      );
    }

    // map with computed discounts
    const mapped = dateValid.map(offer => {
      const cond = offer.conditions.find(c => c.type === 'cart_value') || {};
      const required = cond.value || 0;
      const shortfall = Math.max(0, required - cartValue);

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
        offer,
        name: offer.name,
        requiredCartValue: required,
        shortfall,
        discountType,
        discountValue,
        effectiveDiscount,
      };
    });

    const applicable = mapped.filter(o => o.shortfall === 0);
    if (applicable.length === 0) {
      return NextResponse.json(
        { message: 'No applicable coupon available at the moment.' },
        { status: 200 }
      );
    }

    applicable.sort((a, b) => b.effectiveDiscount - a.effectiveDiscount);
    const best = applicable[0];

    let message = '';
    if (best.discountType === 'percentage') {
      message = `Apply coupon now to get ${best.discountValue}% off!`;
    } else if (best.discountType === 'fixed') {
      message = `Apply coupon now to get ₹${best.discountValue} off!`;
    }

    return NextResponse.json({
      bestOffer: {
        name: best.name,
        discountType: best.discountType,
        discountValue: best.discountValue,
        requiredCartValue: best.requiredCartValue,
        effectiveDiscount: best.effectiveDiscount,
      },
      shortfall: 0,
      message,
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching best applicable coupon:', error.message);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
