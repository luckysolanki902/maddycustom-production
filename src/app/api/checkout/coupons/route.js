import connectToDatabase from '@/lib/middleware/connectToDb';
import Coupon from '@/models/Coupon';
import { NextResponse } from 'next/server';

export async function GET() {
  await connectToDatabase();

  try {
    const currentDate = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: currentDate },
      validUntil: { $gte: currentDate },
    }).select('-__v -createdAt -updatedAt');

    return NextResponse.json({ coupons });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    return NextResponse.json({ message: 'Server error. Please try again.' }, { status: 500 });
  }
}
