import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';

export async function GET(request) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phoneNumber');
    if (!phoneNumber) {
      return NextResponse.json(
        { message: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the user by phone number and get the latest address
    const user = await User.findOne(
      { phoneNumber },
      { addresses: { $slice: -1 } } // Fetch only the latest address
    );
    if (user) {
      const latestAddress =
        user.addresses && user.addresses.length > 0
          ? user.addresses[user.addresses.length - 1]
          : null; // Use null instead of empty string

      console.log({ latestAddress });

      return NextResponse.json({
        exists: true,
        latestAddress,
        userId: user._id.toString(),
      });
    } else {
      return NextResponse.json({ exists: false });
    }
  } catch (error) {
    console.error('Error checking user:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
