import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';

export async function POST(request) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ success: false, message: 'Phone Number is required.' }, { status: 400 });
    }

    await connectToDatabase();

    let user = await User.findOne({ phoneNumber });

    if (!user) {
      const newUser = new User({
        phoneNumber,
        isVerified: true,
        source: 'firebase-login'
      });

      user = await newUser.save();

      return NextResponse.json({
        success: true,
        message: 'User created successfully',
        user: {
          userId: user._id,
          name: user.name,
          phoneNumber: user.phoneNumber,
          addresses: user.addresses,
          isVerified: user.isVerified,
        },
      }, { status: 201 });
    } else {
      user.isVerified = true;
      await user.save();

      return NextResponse.json({
        success: true,
        message: 'User already exists, verified.',
        user: {
          userId: user._id,
          isVerified: user.isVerified,
        },
      }, { status: 200 });
    }
  } catch (error) {
    console.error('Error in checkOrCreateUser:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
