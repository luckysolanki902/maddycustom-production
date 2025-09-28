// app/api/user/check/route.js 

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';

export async function PATCH(request) {
  try {
    // Parse the JSON body
    const { phoneNumber, name, email } = await request.json();

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

    // Lean query for better performance - only fetch necessary fields
    const user = await User.findOne(
      { phoneNumber }, 
      { name: 1, email: 1, addresses: 1 } // Include structured by default in addresses
    ).lean();

    if (!user) {
      // User does not exist
      return NextResponse.json({ exists: false }, { status: 200 });
    }

    // Check if we need to update the user
    const updateFields = {};
    let needsUpdate = false;
    
    // Check if the 'name' field is missing or empty
    if (!user.name || user.name.trim() === '') {
      updateFields.name = name.trim();
      needsUpdate = true;
    }
    
    // Check if the 'email' field is missing or empty
    if (email && (!user.email || user.email.trim() === '')) {
      updateFields.email = email.trim();
      needsUpdate = true;
    }
    
    // Use updateOne for better performance if an update is needed
    if (needsUpdate) {
      await User.updateOne({ phoneNumber }, { $set: updateFields });
    }

    // Get latest address efficiently
    const latestAddress = user.addresses && user.addresses.length > 0
      ? user.addresses[user.addresses.length - 1]
      : null;

    // Return minimal data
    return NextResponse.json({
      exists: true,
      latestAddress,
      userId: user._id.toString(),
      name: user.name || name, // Return the name even if we just updated it
    }, { status: 200 });

  } catch (error) {
    console.error('Error checking user:', error.message);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
