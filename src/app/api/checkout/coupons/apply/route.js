// app/api/checkout/coupons/apply/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import Offer from '@/models/Offer';
import { NextResponse } from 'next/server';
import moment from 'moment-timezone';

/* ------------------------------------------------------------------ */
/* -------------------  bundle‑related helpers  --------------------- */
/* ------------------------------------------------------------------ */
function getCartItemCountByScope(cartItems, scope, scopeValue) {
  if (scope === 'product') {
    return cartItems
      .filter(i => scopeValue.includes(i.productId))
      .reduce((a, b) => a + b.quantity, 0);
  }
  if (scope === 'category') {
    return cartItems
      .filter(i => scopeValue.map(String).includes(String(i.specificCategory)))
      .reduce((a, b) => a + b.quantity, 0);
  }
  return 0;
}

function getCartItemUnitPriceByScope(cartItems, scope, scopeValue) {
  if (scope === 'product') {
    const item = cartItems.find(i => scopeValue.includes(i.productId));
    return item ? item.price : 0;
  }
  if (scope === 'category') {
    const items = cartItems.filter(i =>
      scopeValue.map(String).includes(String(i.specificCategory))
    );
    return items.length ? items[0].price : 0;
  }
  return 0;
}

function calculateBundleDiscount(cartItems, offer) {
  if (!offer?.actions?.length) return 0;
  const action = offer.actions[0];
  if (action.type !== 'bundle') return 0;

  const bundleComponents =
    action.bundleComponents || action.bundleItems || [];
  const bundlePrice = action.bundlePrice;
  if (!bundleComponents.length || !bundlePrice) return 0;

  /* how many complete bundles? */
  let minBundles = Infinity;
  for (const comp of bundleComponents) {
    const cnt = getCartItemCountByScope(
      cartItems,
      comp.scope,
      comp.scopeValue
    );
    minBundles = Math.min(minBundles, Math.floor(cnt / comp.quantity));
  }
  if (!minBundles || !Number.isFinite(minBundles)) return 0;

  /* price diff */
  let normalPrice = 0;
  for (const comp of bundleComponents) {
    const unitPrice = getCartItemUnitPriceByScope(
      cartItems,
      comp.scope,
      comp.scopeValue
    );
    normalPrice += unitPrice * comp.quantity;
  }

  const totalNormal  = normalPrice * minBundles;
  const totalBundle  = bundlePrice  * minBundles;
  const discount     = totalNormal - totalBundle;

  return discount > 0 ? discount : 0;
}
/* ------------------------------------------------------------------ */

function evaluateCondition(condition, totalCost, isFirstOrder = false) {
  if (condition.type === 'cart_value') {
    const v = totalCost;
    const x = condition.value;
    switch (condition.operator) {
      case '>=': return v >= x;
      case '<=': return v <= x;
      case '>':  return v >  x;
      case '<':  return v <  x;
      case '==': return v === x;
      default:   return false;
    }
  }
  if (condition.type === 'first_order') {
    return isFirstOrder === condition.value;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* ---------------------------  POST  ------------------------------- */
/* ------------------------------------------------------------------ */
export async function POST(request) {
  await connectToDatabase();

  const {
    code        = '',           // manual mode
    totalCost   = 0,
    isFirstOrder = false,
    cartItems   = [],
    auto        = false,        // ← AUTO‑APPLY flag
  } = await request.json();

  /* ================================================================
     AUTO‑APPLY MODE  ––  pick the best auto‑applicable offer with bundle priority
  =================================================================*/
  if (auto) {
    try {
      const nowIst = moment().tz('Asia/Kolkata').toDate();

      const offers = await Offer.find({
        isActive : true,
        autoApply: true,
        validFrom : { $lte: nowIst },
        validUntil: { $gte: nowIst },
      }).lean();

      if (!offers || offers.length === 0) {
        return NextResponse.json(
          { valid: false, message: 'No auto-apply offers available.' },
          { status: 200 }
        );
      }

      let bestBundleOffer = null;
      let bestBundleDiscount = 0;
      let bestOtherOffer = null;
      let bestOtherDiscount = 0;

      for (const offer of offers) {
        /* conditions */
        const ok = offer.conditions.every(c =>
          evaluateCondition(c, totalCost, isFirstOrder)
        );
        if (!ok) continue;

        /* discount value */
        const act = offer.actions[0] || {};
        let d = 0;
        
        if (act.type === 'bundle') {
          d = calculateBundleDiscount(cartItems, offer);
          if (d > bestBundleDiscount) {
            bestBundleDiscount = d;
            bestBundleOffer = offer;
          }
        } else {
          // Handle percentage and fixed discounts
          if (act.type === 'discount_percent') {
            d = (act.discountValue / 100) * totalCost;
            if (offer.discountCap && d > offer.discountCap) d = offer.discountCap;
          } else if (act.type === 'discount_fixed') {
            d = act.discountValue;
          }
          
          if (d > bestOtherDiscount) {
            bestOtherDiscount = d;
            bestOtherOffer = offer;
          }
        }
      }

      // Priority: Bundle offers first, then other offers
      let finalOffer = null;
      let finalDiscount = 0;
      
      if (bestBundleOffer && bestBundleDiscount > 0) {
        finalOffer = bestBundleOffer;
        finalDiscount = bestBundleDiscount;
      } else if (bestOtherOffer && bestOtherDiscount > 0) {
        finalOffer = bestOtherOffer;
        finalDiscount = bestOtherDiscount;
      }

      if (!finalOffer || finalDiscount <= 0) {
        return NextResponse.json(
          { valid: false, message: 'No applicable auto‑offers meet the conditions.' },
          { status: 200 }
        );
      }

      const act = finalOffer.actions[0];
      const type = act.type === 'discount_percent'
        ? 'percentage'
        : act.type === 'bundle'
          ? 'bundle'
          : 'fixed';

      return NextResponse.json(
        {
          valid        : true,
          discountValue: Math.floor(finalDiscount),
          discountType : type,
          offer        : finalOffer,
          message      : `Auto-applied: ${finalOffer.name}`,
        },
        { status: 200 }
      );
    } catch (err) {
      console.error('Auto‑apply error:', err);
      return NextResponse.json(
        { valid: false, message: 'Server error during auto-apply.' },
        { status: 500 }
      );
    }
  }

  /* ================================================================
     MANUAL MODE  ––  user entered a code (old behaviour)
  =================================================================*/
  if (!code.trim()) {
    return NextResponse.json(
      { valid: false, message: 'Coupon code is required.' },
      { status: 400 }
    );
  }

  try {
    /* 1 ‑ fetch offer by code */
    const offer = await Offer.findOne({
      couponCodes: code.trim().toUpperCase(),
      isActive   : true,
    }).lean();

    if (!offer) {
      return NextResponse.json(
        { valid: false, message: 'Invalid coupon code.' },
        { status: 400 }
      );
    }

    /* 2 ‑ check validity window */
    const now = moment().tz('Asia/Kolkata').toDate();
    if (now < offer.validFrom || now > offer.validUntil) {
      return NextResponse.json(
        { valid: false, message: 'Coupon is expired or not yet valid.' },
        { status: 400 }
      );
    }

    /* 3 ‑ conditions */
    const ok = offer.conditions.every(c =>
      evaluateCondition(c, totalCost, isFirstOrder)
    );
    if (!ok) {
      return NextResponse.json(
        { valid: false, message: offer.conditionMessage || 'Coupon conditions are not met.' },
        { status: 400 }
      );
    }

    /* 4 ‑ discount calculation */
    const action = offer.actions[0] || {};
    let discount = 0;
    if (action.type === 'discount_percent') {
      discount = (action.discountValue / 100) * totalCost;
      if (offer.discountCap && discount > offer.discountCap)
        discount = offer.discountCap;
    } else if (action.type === 'discount_fixed') {
      discount = action.discountValue;
    } else if (action.type === 'bundle') {
      discount = calculateBundleDiscount(cartItems, offer);
    }

    const type = action.type === 'discount_percent'
      ? 'percentage'
      : action.type === 'bundle'
        ? 'bundle'
        : 'fixed';

    return NextResponse.json(
      {
        valid        : true,
        discountValue: Math.floor(discount),
        discountType : type,
        offer,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Server Error during coupon application:', err);
    return NextResponse.json(
      { valid: false, message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
