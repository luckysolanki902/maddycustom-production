// app/api/checkout/coupons/apply/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import Offer from '@/models/Offer';
import { NextResponse } from 'next/server';
import moment from 'moment-timezone';

// --- Bundle Discount Calculation Helper ---
// Helper: Get count of items in cart by scope (product or category)
function getCartItemCountByScope(cartItems, scope, scopeValue) {
  if (scope === 'product') {
    return cartItems.filter(i => scopeValue.includes(i.productId)).reduce((a, b) => a + b.quantity, 0);
  } else if (scope === 'category') {
    // Use specificCategory (ObjectId) for category scope
    return cartItems.filter(i => scopeValue.map(String).includes(String(i.specificCategory))).reduce((a, b) => a + b.quantity, 0);
  }
  return 0;
}

// Helper: Get price of items in cart by scope (product or category)
function getCartItemUnitPriceByScope(cartItems, scope, scopeValue) {
  if (scope === 'product') {
    const item = cartItems.find(i => scopeValue.includes(i.productId));
    return item ? item.price : 0;
  } else if (scope === 'category') {
    // Use specificCategory (ObjectId) for category scope
    const items = cartItems.filter(i => scopeValue.map(String).includes(String(i.specificCategory)));
    return items.length > 0 ? items[0].price : 0;
  }
  return 0;
}

function calculateBundleDiscount(cartItems, offer) {
  if (!offer || !offer.actions || !offer.actions.length) return 0;
  const action = offer.actions[0];
  if (action.type !== 'bundle') return 0;
  console.log('calculateBundleDiscount: offer', offer);
  console.log('calculateBundleDiscount: action', action);
  const bundleComponents = action.bundleComponents || action.bundleItems || [];
  console.log('calculateBundleDiscount: bundleComponents', bundleComponents);
  const bundlePrice = action.bundlePrice;
  if (!bundleComponents.length || !bundlePrice) return 0;
  let minBundles = Infinity;
  console.log('calculateBundleDiscount: bundleComponents loop');
  for (const comp of bundleComponents) {
    console.log('calculateBundleDiscount: checking component', comp);
    const countInCart = getCartItemCountByScope(cartItems, comp.scope, comp.scopeValue);
    console.log('calculateBundleDiscount: countInCart', countInCart);
    const possibleBundles = Math.floor(countInCart / comp.quantity);
    console.log('calculateBundleDiscount: possibleBundles', possibleBundles);
    minBundles = Math.min(minBundles, possibleBundles);
    console.log('calculateBundleDiscount: minBundles', minBundles);
  }
  if (minBundles === 0 || minBundles === Infinity) return 0;
  let normalPrice = 0;
  console.log('calculateBundleDiscount: normal price loop');
  for (const comp of bundleComponents) {
    console.log('calculateBundleDiscount: checking component', comp);
    const unitPrice = getCartItemUnitPriceByScope(cartItems, comp.scope, comp.scopeValue);
    console.log('calculateBundleDiscount: unitPrice', unitPrice);
    normalPrice += unitPrice * comp.quantity;
    console.log('calculateBundleDiscount: normalPrice', normalPrice);
  }
  const totalNormalPrice = normalPrice * minBundles;
  console.log('calculateBundleDiscount: totalNormalPrice', totalNormalPrice);
  const totalBundlePrice = bundlePrice * minBundles;
  console.log('calculateBundleDiscount: totalBundlePrice', totalBundlePrice);
  const discount = totalNormalPrice - totalBundlePrice;
  console.log('calculateBundleDiscount: discount', discount);
  return discount > 0 ? discount : 0;
}

function evaluateCondition(condition, totalCost, isFirstOrder = false) {
  // Currently supporting 'cart_value' and 'first_order' conditions.
  if (condition.type === 'cart_value') {
    switch (condition.operator) {
      case '>=':
        return totalCost >= condition.value;
      case '<=':
        return totalCost <= condition.value;
      case '>':
        return totalCost > condition.value;
      case '<':
        return totalCost < condition.value;
      case '==':
        return totalCost === condition.value;
      default:
        return false;
    }
  }
  if (condition.type === 'first_order') {
    // condition.value should be true to indicate it applies only on the first order.
    return isFirstOrder === condition.value;
  }
  // Additional condition types can be added here.
  return false;
}

export async function POST(request) {
  await connectToDatabase();

  const { code, totalCost, isFirstOrder, cartItems } = await request.json();
console.log({cartItems})
  if (!code) {
    console.error('Coupon code is required.');
    return NextResponse.json(
      { valid: false, message: 'Coupon code is required.' },
      { status: 400 }
    );
  }
  if (typeof totalCost !== 'number') {
    console.error('Total cost must be a number.');
    return NextResponse.json(
      { valid: false, message: 'Total cost must be a number.' },
      { status: 400 }
    );
  }

  try {
    // Look up the offer by coupon code.
    const offer = await Offer.findOne({
      couponCodes: code.toUpperCase(),
      isActive: true,
    }).lean();

    if (!offer) {
      console.error('Invalid coupon code.');
      return NextResponse.json(
        { valid: false, message: 'Invalid coupon code.' },
        { status: 400 }
      );
    }

    // Get current time in IST.
    const currentDateIST = moment().tz('Asia/Kolkata').toDate();
    if (currentDateIST < offer.validFrom || currentDateIST > offer.validUntil) {
      console.error('Coupon is expired or not yet valid.');
      return NextResponse.json(
        { valid: false, message: 'Coupon is expired or not yet valid.' },
        { status: 400 }
      );
    }

    // Evaluate all conditions.
    let conditionsMet = true;
    for (let condition of offer.conditions) {
      if (!evaluateCondition(condition, totalCost, isFirstOrder)) {
        conditionsMet = false;
        break;
      }
    }

    if (!conditionsMet) {
      return NextResponse.json(
        { valid: false, message: offer.conditionMessage || 'Coupon conditions are not met.' },
        { status: 400 }
      );
    }

    // Calculate discount based on the action.
    // Assuming one action per offer for now.
    const action = offer.actions[0];
    let discount = 0;
    if (action.type === 'discount_percent') {
      discount = (action.discountValue / 100) * totalCost;
      // If a discountCap is specified, cap the discount.
      if (offer.discountCap && discount > offer.discountCap) {
        discount = offer.discountCap;
      }
    } else if (action.type === 'discount_fixed') {
      discount = action.discountValue;
    } else if (action.type === 'bundle' && Array.isArray(cartItems)) {
      discount = calculateBundleDiscount(cartItems, offer);
      console.log('Bundle discount:', discount);
    }

    return NextResponse.json(
      {
        valid: true,
        discountValue: discount,
        discountType: action.type === 'discount_percent' ? 'percentage' : (action.type === 'bundle' ? 'bundle' : 'fixed'),
        message: 'Coupon applied successfully.',
        offer: offer,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Server Error during coupon application:', error.message);
    return NextResponse.json(
      { valid: false, message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
