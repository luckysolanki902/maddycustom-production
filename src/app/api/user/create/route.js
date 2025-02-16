// app/api/user/create-user/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';

export async function POST(request) {
  try {
    // Parse the JSON body
    const { name, phoneNumber, email ,source} = await request.json();

    // Validate input
    if (!phoneNumber) {
      // console.warn('Create User failed: Missing phoneNumber.');
      return NextResponse.json(
        { message: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if the user already exists
    const existingUser = await User.findOne({ phoneNumber });

    if (existingUser) {
      if (name && (!existingUser.name || existingUser.name === '') ) {
        // Update the user's name if it only contains the phone number but not the name
        existingUser.name = name;
        await existingUser.save();
        return NextResponse.json(
          {
            message: 'User exists and name updated',
            userId: existingUser._id,
          },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          {
            message: 'User already exists',
            userId: existingUser._id, // Return existing user ID
          },
          { status: 200 }
        );
      }
    }

    // Create a new user
    const newUser = new User({
      phoneNumber,
      name: name || '', // Name is optional
      addresses: [],
      isVerified: false,
      email: email || '',
      source: source || 'unknown',
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
    console.error('Error creating user:', error.message);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
