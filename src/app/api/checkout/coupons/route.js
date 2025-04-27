// app/api/checkout/coupons/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import Offer from '@/models/Offer';
import { NextResponse } from 'next/server';
import moment from 'moment-timezone';

export async function GET(request) {
  await connectToDatabase();

  try {
    const { searchParams } = new URL(request.url);
    const showAsCards = searchParams.get('cards') === 'true';

    const nowIst     = moment().tz('Asia/Kolkata');
    const startOfDay = nowIst.clone().startOf('day');
    const endOfDay   = nowIst.clone().endOf('day');

    const allOffers = await Offer.find({
      isActive: true,
      ...(showAsCards && { showAsCard: true }),
    }).select('-__v -createdAt -updatedAt');

    const validOffers = allOffers.filter(offer => {
      const offerStartIst = moment(offer.validFrom).tz('Asia/Kolkata').startOf('day');
      const offerEndIst   = moment(offer.validUntil).tz('Asia/Kolkata').endOf('day');
      return nowIst.isBetween(offerStartIst, offerEndIst, null, '[]');
    });

    return NextResponse.json({ coupons: validOffers }, { status: 200 });
  } catch (error) {
    console.error('Error fetching offers:', error);
    return NextResponse.json(
      { message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
