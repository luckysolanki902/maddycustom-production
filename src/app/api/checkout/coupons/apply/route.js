// app/api/checkout/coupons/apply/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import Offer from '@/models/Offer';
import { NextResponse } from 'next/server';
import moment from 'moment-timezone';

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

  const { code, totalCost, isFirstOrder } = await request.json();

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
    });
    // console.log(offer,code)

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
        discount = (offer.discountCap/totalCost)*100;
      }
      else
      discount = action.discountValue;
    } else if (action.type === 'discount_fixed') {
      discount = action.discountValue;
    } else {
      // For other action types (free_item, bogo), additional logic would be needed.
    }

    return NextResponse.json(
      {
        valid: true,
        discountValue: discount,
        discountType: action.type === 'discount_percent' ? 'percentage' : 'fixed',
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
