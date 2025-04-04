// app/api/checkout/coupons/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import Offer from '@/models/Offer';
import { NextResponse } from 'next/server';
import moment from 'moment-timezone';

export async function GET() {
  await connectToDatabase();

  try {
    // Get current time in IST
    const currentDateIST = moment().tz('Asia/Kolkata').toDate();
    // console.log(currentDateIST);

    // Fetch only active offers that should be shown as cards and are within the validity period.
    const offers = await Offer.find({isActive: true,validFrom: { $lte: currentDateIST }, validUntil: { $gte: currentDateIST }}).select('-__v -createdAt -updatedAt');

    return NextResponse.json({ coupons: offers }, { status: 200 });
  } catch (error) {
    console.error('Error fetching active offers:', error.message);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
