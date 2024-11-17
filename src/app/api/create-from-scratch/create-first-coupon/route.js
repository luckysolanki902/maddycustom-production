import connectToDatabase from '@/lib/middleware/connectToDb';
import Coupon from '@/models/Coupon';
import { NextResponse } from 'next/server';

export async function GET() {
  await connectToDatabase();

  const couponData = {
    code: 'GET5FORALL',
    discountType: 'percentage',
    discountValue: 5,
    validFrom: new Date('2024-01-01'),
    validUntil: new Date('2034-01-01'),
    isActive: true,
    minimumPurchasePrice: 0,
    usagePerUser: 1000,
    usageCount: 0,
    showAsCard: true,
    captions: ['Limited Time Offer', 'Get 5% off on your purchase!'],
    description: 'Enjoy a 5% discount on all purchases.',
  };

  try {
    const existingCoupon = await Coupon.findOne({ code: couponData.code });

    if (existingCoupon) {
      return NextResponse.json({ message: 'Coupon already exists.' }, { status: 400 });
    }

    const newCoupon = new Coupon(couponData);
    await newCoupon.save();

    return NextResponse.json({ message: 'Temporary coupon created successfully.', coupon: newCoupon }, { status: 201 });
  } catch (error) {
    console.error('Error creating temporary coupon:', error);
    return NextResponse.json({ message: 'Server error. Please try again.' }, { status: 500 });
  }
}
