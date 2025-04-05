// app/api/checkout/bestcoupon/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import Offer from '@/models/Offer';
import { NextResponse } from 'next/server';
import moment from 'moment-timezone';

export async function GET(req) {
  await connectToDatabase();

  try {
    // Get current time in IST
    const currentDateIST = moment().tz('Asia/Kolkata').toDate();

    // Parse query parameters from the request URL
    const { searchParams } = new URL(req.url);
    const cartValue = parseFloat(searchParams.get('cartValue')) || 0;

    // Fetch all active offers that have a cart_value condition and are valid now.
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
    // This mapping handles both fixed and percentage discount types.
    const mappedOffers = offers.map((offer) => {
      const cartCondition = offer.conditions.find(
        (cond) => cond.type === 'cart_value'
      );
      const requiredCartValue = cartCondition ? cartCondition.value : 0;
      const shortfall = Math.max(0, requiredCartValue - cartValue);

      if(shortfall === 0) return ;
      const discountAction = offer.actions.find(
        (action) =>
          action.type === 'discount_percent' || action.type === 'discount_fixed'
      );

      let discountType = null;
      let discountValue = 0;
      if (discountAction) {
        if (discountAction.type === 'discount_percent') {
          discountType = 'percentage';
          discountValue = discountAction.discountValue;
        } else if (discountAction.type === 'discount_fixed') {
          discountType = 'fixed';
          discountValue = discountAction.discountValue;
        }
      }

      return {
        offer,
        name: offer.name,
        requiredCartValue,
        shortfall,
        discountType,
        discountValue,
      };
    });

    // Sort offers by smallest shortfall first.
    // In case of tie, for percentage offers, the one with higher discount percent is preferred;
    // for fixed offers, the one with higher fixed discount is preferred.
    mappedOffers.sort((a, b) => {
      if (a.shortfall !== b.shortfall) {
        return a.shortfall - b.shortfall;
      }
      return b.discountValue - a.discountValue;
    });

    // Always select the offer with the smallest shortfall.
    const selectedOffer = mappedOffers[0];

    if (!selectedOffer) {
      return NextResponse.json(
        { message: 'No offers available at the moment.' },
        { status: 200 } // Changed status to 200 to indicate success.
      );
    }

    const { name, discountType, discountValue, requiredCartValue, shortfall } = selectedOffer;
    let message = '';
    if (shortfall > 0) {
      if (discountType === 'percentage') {
        message = `Add ₹${shortfall} more to unlock ${discountValue}% off coupon!`;
      } else if (discountType === 'fixed') {
        message = `Add ₹${shortfall} more to unlock ₹${discountValue} off coupon!`;
      }
    } else {
      if (discountType === 'percentage') {
        message = `Apply coupon now to get ${discountValue}% off!`;
      } else if (discountType === 'fixed') {
        message = `Apply coupon now to get ₹${discountValue} off!`;
      }
    }

    const responseData = {
      bestOffer: {
        name,
        discountType,
        discountValue,
        requiredCartValue,
      },
      shortfall,
      message,
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

