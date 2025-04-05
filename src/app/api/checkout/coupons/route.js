// app/api/checkout/coupons/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Coupon from '@/models/Coupon';
import { NextResponse } from 'next/server';
import moment from 'moment-timezone';

export const revalidate = 60; // seconds
export async function GET() {
  await connectToDatabase();

  try {
    // Get current time in IST
    const currentDateIST = moment().tz('Asia/Kolkata').toDate();

    const coupons = await Coupon.find({
      isActive: true,
      showAsCard: true,
      validFrom: { $lte: currentDateIST },
      validUntil: { $gte: currentDateIST },
    })
      .select('-__v -createdAt -updatedAt');

    return NextResponse.json({ coupons }, { status: 200 });
  } catch (error) {
    console.error('Error fetching active coupons:', error.message);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
