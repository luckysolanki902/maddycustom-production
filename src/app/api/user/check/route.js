// app/api/user/check/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';

export async function GET(request) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phoneNumber');
    if (!phoneNumber) {
      console.warn('Check User Address failed: Missing phoneNumber query parameter.');
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

      console.info(`Check User Address: Found userId=${user._id} with latestAddress=${latestAddress ? latestAddress._id : 'None'}.`);
      return NextResponse.json({
        exists: true,
        latestAddress,
        userId: user._id.toString(),
      });
    } else {
      console.warn(`Check User Address: No user found with phoneNumber=${phoneNumber}.`);
      return NextResponse.json({ exists: false });
    }
  } catch (error) {
    console.error('Error checking user address:', error.message);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
