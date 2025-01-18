// app/api/user/check/route.js 

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';

export async function PATCH(request) {
  try {
    // Parse the JSON body
    const { phoneNumber, name } = await request.json();

    // Validate phoneNumber
    if (!phoneNumber) {
      return NextResponse.json(
        { message: 'phoneNumber is required' },
        { status: 400 }
      );
    }

    // Validate name
    if (!name) {
      return NextResponse.json(
        { message: 'name is required' },
        { status: 400 }
      );  
    }

    // Connect to the database
    await connectToDatabase();

    // Find the user by phone number
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      // User does not exist
      return NextResponse.json({ exists: false }, { status: 200 });
    }

    let nameUpdated = false;

    // Check if the 'name' field is missing or empty
    if (!user.name || user.name.trim() === '') {
      user.name = name.trim();
      await user.save();
      nameUpdated = true;
    }

    // Retrieve the latest address
    const latestAddress =
      user.addresses && user.addresses.length > 0
        ? user.addresses[user.addresses.length - 1]
        : null;

    // Respond with user details
    return NextResponse.json({
      exists: true,
      latestAddress,
      userId: user._id.toString(),
      nameUpdated,
      name: user.name,
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating user name:', error.message);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
