// app/api/user/create-user/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    // Parse the JSON body
    const { name, phoneNumber, email ,source} = await request.json();
    const generatedUserId = uuidv4();
    // Validate input
    if (!phoneNumber) {
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
      if ((name && (!existingUser.name || existingUser.name === '') )) {
        // Update the user's name if it only contains the phone number but not the name
        existingUser.name = name;
        if(!existingUser.userId) {
          existingUser.userId = generatedUserId;
        }
        await existingUser.save({ validateBeforeSave: false }); // Bypass validators
        return NextResponse.json(
          {
            message: 'User exists and name updated',
            userId: existingUser._id,
          },
          { status: 200 }
        );
      } else if (!existingUser.userId) {
        await User.collection.updateOne(
          { _id: existingUser._id },
          { $set: { userId: generatedUserId } }
        );
    
        // After update, fetch the user again to verify
        const freshUser = await User.findById(existingUser._id);
        return NextResponse.json(
          {
            message: 'User exists and userId assigned',
            user: {
              userUuid: freshUser.userId,
              phoneNumber: existingUser.phoneNumber,
              name: existingUser.name,
            }
          },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          {
            message: 'User already exists',
            user: {
              userId: existingUser._id, // Return existing user ID
              userUuid: existingUser.userId, // Return user UUID
              phoneNumber: existingUser.phoneNumber,
            }
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
      userId: generatedUserId, // Assign the generated userId
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
          userUuid: newUser.userId, // Return user UUID
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
