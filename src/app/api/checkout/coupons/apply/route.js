// app/api/checkout/coupons/apply/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Coupon from '@/models/Coupon';
import { NextResponse } from 'next/server';
import moment from 'moment-timezone';

export async function POST(request) {
  await connectToDatabase();

  const { code, totalCost } = await request.json();

  if (!code) {
    console.warn('Coupon application failed: Coupon code is missing.');
    return NextResponse.json(
      { valid: false, message: 'Coupon code is required.' },
      { status: 400 }
    );
  }
  if (typeof totalCost !== 'number') {
    console.warn('Coupon application failed: Total cost is not a number.');
    return NextResponse.json(
      { valid: false, message: 'Total cost must be a number.' },
      { status: 400 }
    );
  }

  try {
    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
    });
    if (!coupon) {
      console.warn(`Invalid coupon code attempted: ${code}`);
      return NextResponse.json(
        { valid: false, message: 'Invalid coupon code.' },
        { status: 400 }
      );
    }

    // Get current time in IST
    const currentDateIST = moment().tz('Asia/Kolkata').toDate();

    if (currentDateIST < coupon.validFrom || currentDateIST > coupon.validUntil) {
      console.warn(`Coupon code expired or not yet valid: ${code}`);
      return NextResponse.json(
        { valid: false, message: 'Coupon is expired or not yet valid.' },
        { status: 400 }
      );
    }

    // Optionally, you can perform additional checks like usage limits here

    // No changes needed to the coupon document in this context
    // If you have logic to track usage per application, include it here

    return NextResponse.json(
      {
        valid: true,
        discountValue: coupon.discountValue,
        discountType: coupon.discountType,
        message: 'Coupon applied successfully.',
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
