// app/api/checkout/bestcoupon/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Offer from '@/models/Offer';
import { NextResponse } from 'next/server';
import moment from 'moment-timezone';

export async function GET(request) {
  await connectToDatabase();
  
  const searchParams = request.nextUrl.searchParams;
  const cartValue = parseFloat(searchParams.get('cartValue')) || 0;
  const showCardOnly = searchParams.get('showCardOnly') === 'true';
  const appliedOfferId = searchParams.get('appliedOfferId');
  const appliedCouponCode = searchParams.get('appliedCouponCode');
  const currentDiscountAmount = parseFloat(searchParams.get('currentDiscountAmount')) || 0;

  try {
    const nowIst = moment().tz('Asia/Kolkata').toDate();
    
    // Build query
    const query = {
      isActive: true,
      validFrom: { $lte: nowIst },
      validUntil: { $gte: nowIst },
    };
    
    // Add showAsCard filter if requested
    if (showCardOnly) {
      query.showAsCard = true;
    }
    
    // Exclude already applied offer by ID or coupon code
    const excludeConditions = [];
    if (appliedOfferId) {
      excludeConditions.push({ _id: { $ne: appliedOfferId } });
    }
    if (appliedCouponCode) {
      excludeConditions.push({ couponCodes: { $nin: [appliedCouponCode.toUpperCase()] } });
    }
    
    if (excludeConditions.length > 0) {
      query.$and = excludeConditions;
    }

    const offers = await Offer.find(query).lean();
    
    if (!offers || offers.length === 0) {
      return NextResponse.json({ bestOffer: null, shortfall: 0 }, { status: 200 });
    }

    // Enhanced algorithm with proper discount comparison
    let bestCurrentOffer = null;
    let bestCurrentDiscount = 0;
    let nextBestOffer = null;
    let nextBestShortfall = Infinity;
    let nextBestDiscount = 0;

    // Minimum improvement threshold (offer must be at least ₹20 better)
    const MINIMUM_IMPROVEMENT = 20;

    for (const offer of offers) {
      // Check cart value conditions and calculate shortfall
      let meetsConditions = true;
      let shortfallAmount = 0;
      let hasCartValueCondition = false;
      
      // Check each condition
      for (const condition of offer.conditions) {
        if (condition.type === 'cart_value') {
          hasCartValueCondition = true;
          const v = cartValue;
          const x = condition.value;
          
          switch (condition.operator) {
            case '>=':
              if (v < x) {
                meetsConditions = false;
                shortfallAmount = Math.max(shortfallAmount, x - v);
              }
              break;
            case '>':
              if (v <= x) {
                meetsConditions = false;
                shortfallAmount = Math.max(shortfallAmount, (x + 1) - v);
              }
              break;
            case '<=':
              if (v > x) {
                meetsConditions = false;
                // For upper limits, this offer won't be applicable
                shortfallAmount = Infinity;
              }
              break;
            case '<':
              if (v >= x) {
                meetsConditions = false;
                shortfallAmount = Infinity;
              }
              break;
            case '==':
              if (v !== x) {
                meetsConditions = false;
                shortfallAmount = Math.abs(x - v);
              }
              break;
            default:
              meetsConditions = false;
              shortfallAmount = Infinity;
          }
        } else if (condition.type === 'first_order') {
          // Handle first order condition (assuming true for now)
          meetsConditions = meetsConditions && true;
        }
      }

      // Skip offers without cart value conditions for next best suggestions
      if (!hasCartValueCondition && !meetsConditions) {
        continue;
      }

      // Calculate actual discount value
      const action = offer.actions[0];
      let actualDiscountValue = 0;
      
      if (action.type === 'discount_percent') {
        // Calculate based on current cart value for current offers
        // or potential cart value for future offers
        const calculationCartValue = meetsConditions ? cartValue : (cartValue + shortfallAmount);
        actualDiscountValue = (action.discountValue / 100) * calculationCartValue;
        if (offer.discountCap && actualDiscountValue > offer.discountCap) {
          actualDiscountValue = offer.discountCap;
        }
      } else if (action.type === 'discount_fixed') {
        actualDiscountValue = action.discountValue;
      } else if (action.type === 'bundle') {
        // For bundle offers, estimate discount (this would need cart items for exact calculation)
        actualDiscountValue = action.bundlePrice || action.discountValue || 0;
      }

      // Round to nearest rupee
      actualDiscountValue = Math.floor(actualDiscountValue);

      // If conditions are met, consider for best current offer
      if (meetsConditions && actualDiscountValue > bestCurrentDiscount) {
        // Only suggest if significantly better than current applied discount
        if (actualDiscountValue > currentDiscountAmount + MINIMUM_IMPROVEMENT) {
          bestCurrentDiscount = actualDiscountValue;
          bestCurrentOffer = {
            ...offer,
            discountValue: actualDiscountValue,
            discountType: action.type === 'discount_percent' ? 'percentage' : 
                         action.type === 'bundle' ? 'bundle' : 'fixed'
          };
        }
      }

      // If conditions are not met, consider for next best offer
      if (!meetsConditions && shortfallAmount > 0 && shortfallAmount < Infinity) {
        // Only consider if the potential discount is significantly better
        if (actualDiscountValue > currentDiscountAmount + MINIMUM_IMPROVEMENT) {
          // Calculate value proposition (discount improvement per rupee needed)
          const discountImprovement = actualDiscountValue - currentDiscountAmount;
          const valueProposition = discountImprovement / shortfallAmount;
          const currentBestValueProposition = nextBestDiscount > 0 ? 
            (nextBestDiscount - currentDiscountAmount) / nextBestShortfall : 0;
          
          // Prefer offers with:
          // 1. Lower shortfall with decent discount
          // 2. Better value proposition
          // 3. Higher absolute discount if similar shortfall
          const isBetterOffer = 
            (shortfallAmount < nextBestShortfall && actualDiscountValue > currentDiscountAmount + MINIMUM_IMPROVEMENT) ||
            (Math.abs(shortfallAmount - nextBestShortfall) <= 100 && actualDiscountValue > nextBestDiscount) ||
            (valueProposition > currentBestValueProposition && shortfallAmount <= nextBestShortfall * 1.5);

          if (isBetterOffer) {
            nextBestShortfall = shortfallAmount;
            nextBestDiscount = actualDiscountValue;
            nextBestOffer = {
              ...offer,
              calculatedDiscount: actualDiscountValue,
              shortfall: shortfallAmount,
              discountType: action.type === 'discount_percent' ? 'percentage' : 
                           action.type === 'bundle' ? 'bundle' : 'fixed',
              valueProposition: valueProposition
            };
          }
        }
      }
    }

    // Return current best offer if available and genuinely better
    if (bestCurrentOffer && bestCurrentDiscount > currentDiscountAmount + MINIMUM_IMPROVEMENT) {
      return NextResponse.json({
        bestOffer: bestCurrentOffer,
        shortfall: 0
      }, { status: 200 });
    } 

    // Return next best offer with shortfall if it's worth pursuing
    if (nextBestOffer && nextBestDiscount > currentDiscountAmount + MINIMUM_IMPROVEMENT) {
      return NextResponse.json({
        bestOffer: {
          ...nextBestOffer,
          discountValue: nextBestDiscount
        },
        shortfall: Math.ceil(nextBestShortfall) // Round up to next rupee
      }, { status: 200 });
    }

    return NextResponse.json({ bestOffer: null, shortfall: 0 }, { status: 200 });

  } catch (error) {
    console.error('Error fetching best coupon:', error);
    return NextResponse.json({ bestOffer: null, shortfall: 0 }, { status: 500 });
  }
}
