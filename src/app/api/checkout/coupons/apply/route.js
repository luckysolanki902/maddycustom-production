import connectToDatabase from '@/lib/middleware/connectToDb';
import Coupon from '@/models/Coupon';
import { NextResponse } from 'next/server';

export async function POST(request) {
  await connectToDatabase();

  const { code, totalCost } = await request.json();

  if (!code) {
    return NextResponse.json({ valid: false, message: 'Coupon code is required.' }, { status: 400 });
  }
  if (typeof totalCost !== 'number') {
    return NextResponse.json({ valid: false, message: 'Total cost must be a number.' }, { status: 400 });
  }

  try {
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) {
      return NextResponse.json({ valid: false, message: 'Invalid coupon code.' }, { status: 400 });
    }

    const currentDate = new Date();
    if (currentDate < coupon.validFrom || currentDate > coupon.validUntil) {
      return NextResponse.json({ valid: false, message: 'Coupon is expired or not yet valid.' }, { status: 400 });
    }

    if (coupon.usageCount >= coupon.usagePerUser) {
      return NextResponse.json({ valid: false, message: 'Coupon usage limit reached.' }, { status: 400 });
    }

    if (totalCost < coupon.minimumPurchasePrice) {
      return NextResponse.json({ valid: false, message: `Minimum purchase of ₹${coupon.minimumPurchasePrice} required to apply this coupon.` }, { status: 400 });
    }

    coupon.usageCount += 1;
    await coupon.save();

    return NextResponse.json({
      valid: true,
      discountValue: coupon.discountValue,
      discountType: coupon.discountType,
      message: 'Coupon applied successfully.',
    });
  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json({ valid: false, message: 'Server error. Please try again.' }, { status: 500 });
  }
}
