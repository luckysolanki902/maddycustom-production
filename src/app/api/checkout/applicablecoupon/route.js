import connectToDatabase from '@/lib/middleware/connectToDb';
import Offer from '@/models/Offer';
import { NextResponse } from 'next/server';
import moment from 'moment-timezone';

export async function GET(req) {
  await connectToDatabase();

  try {
    // Get current time in IST
    const currentDateIST = moment().tz('Asia/Kolkata').toDate();

    // Parse query parameter 'cartValue' from the request URL
    const { searchParams } = new URL(req.url);
    const cartValue = parseFloat(searchParams.get('cartValue')) || 0;

    // Fetch all active offers with a cart_value condition that are valid now.
    const offers = await Offer.find({
      isActive: true,
      'conditions.type': 'cart_value',
      validFrom: { $lte: currentDateIST },
      validUntil: { $gte: currentDateIST },
    }).select('-__v -createdAt -updatedAt');

    if (!offers || offers.length === 0) {
      return NextResponse.json(
        { message: 'No offers available at the moment.' },
        { status: 200 }
      );
    }

    // Map offers to include computed fields.
    // For percentage discounts, compute effective discount (capped if needed).
    const mappedOffers = offers.map((offer) => {
      const cartCondition = offer.conditions.find(
        (cond) => cond.type === 'cart_value'
      );
      const requiredCartValue = cartCondition ? cartCondition.value : 0;
      // Calculate how much more is needed; if 0 then it's applicable.
      const shortfall = Math.max(0, requiredCartValue - cartValue);

      // Get discount action (handling both percentage and fixed)
      const discountAction = offer.actions.find(
        (action) =>
          action.type === 'discount_percent' || action.type === 'discount_fixed'
      );

      let discountType = null;
      let discountValue = 0;
      let effectiveDiscount = 0;
      if (discountAction) {
        if (discountAction.type === 'discount_percent') {
          discountType = 'percentage';
          discountValue = discountAction.discountValue;
          effectiveDiscount = (discountValue / 100) * cartValue;
          // Cap the discount if discountCap is provided.
          if (offer.discountCap && effectiveDiscount > offer.discountCap) {
            effectiveDiscount = offer.discountCap;
          }
        } else if (discountAction.type === 'discount_fixed') {
          discountType = 'fixed';
          discountValue = discountAction.discountValue;
          effectiveDiscount = discountValue;
        }
      }
      return {
        offer,
        name: offer.name,
        requiredCartValue,
        shortfall,
        discountType,
        discountValue,
        effectiveDiscount,
      };
    });

    // Filter only the offers that are fully applicable (shortfall equals 0)
    const applicableOffers = mappedOffers.filter((o) => o.shortfall === 0);

    if (applicableOffers.length === 0) {
      return NextResponse.json(
        { message: 'No applicable coupon available at the moment.' },
        { status: 200 }
      );
    }

    // Sort applicable offers by effective discount in descending order.
    applicableOffers.sort((a, b) => b.effectiveDiscount - a.effectiveDiscount);

    const bestOffer = applicableOffers[0];
    let message = '';
    if (bestOffer.discountType === 'percentage') {
      message = `Apply coupon now to get ${bestOffer.discountValue}% off!`;
    } else if (bestOffer.discountType === 'fixed') {
      message = `Apply coupon now to get ₹${bestOffer.discountValue} off!`;
    }

    const responseData = {
      bestOffer: {
        name: bestOffer.name,
        discountType: bestOffer.discountType,
        discountValue: bestOffer.discountValue,
        requiredCartValue: bestOffer.requiredCartValue,
        effectiveDiscount: bestOffer.effectiveDiscount,
      },
      shortfall: 0,
      message,
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error('Error fetching best applicable coupon:', error.message);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
