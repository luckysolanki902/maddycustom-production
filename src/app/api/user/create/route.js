import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';

export async function POST(request) {
  try {
    // Parse the JSON body
    const { name, phoneNumber } = await request.json();

    // Validate input
    if (!name || !phoneNumber) {
      return NextResponse.json(
        { message: 'Name and phone number are required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if the user already exists
    const existingUser = await User.findOne({ phoneNumber });

    if (existingUser) {
      return NextResponse.json(
        {
          message: 'User already exists',
          userId: existingUser._id, // Return existing user ID
        },
        { status: 200 }
      );
    }

    // Create a new user
    const newUser = new User({
      name,
      phoneNumber,
      addresses: [],
      isVerified: false,
    });

    await newUser.save();
    // Return success response
    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          userId: newUser._id,
          name: newUser.name,
          phoneNumber: newUser.phoneNumber,
          addresses: newUser.addresses,
          isVerified: newUser.isVerified,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
