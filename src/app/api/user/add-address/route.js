// app/api/user/add-address/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';

// Helper function to compare addresses
const areAddressesEqual = (addr1, addr2) => {
  if (!addr1 || !addr2) return false;
  
  const phoneMatch = addr1.receiverPhoneNumber.trim() === addr2.receiverPhoneNumber.trim();
  const line1Match = addr1.addressLine1.trim().toLowerCase() === addr2.addressLine1.trim().toLowerCase();
  const cityMatch = addr1.city.trim().toLowerCase() === addr2.city.trim().toLowerCase();
  const stateMatch = addr1.state.trim().toLowerCase() === addr2.state.trim().toLowerCase();
  const pincodeMatch = addr1.pincode.trim() === addr2.pincode.trim();
  
  // Most significant fields match is enough - we don't need perfect equality
  return phoneMatch && line1Match && cityMatch && stateMatch && pincodeMatch;
};

export async function POST(request) {
  try {
    // Parse the JSON body of the request
    const { phoneNumber, address } = await request.json();

    // Validate required fields
    if (!phoneNumber || !address) {
      return NextResponse.json(
        { message: 'Phone number and address are required.' },
        { status: 400 }
      );
    }

    // Quick validation of essential fields only
    if (!address.addressLine1 || !address.city || !address.state || !address.pincode) {
      return NextResponse.json(
        { message: 'Address is missing essential fields.' },
        { status: 400 }
      );
    }

    // Set defaults and trim values
    const processedAddress = {
      receiverName: (address.receiverName || '').trim(),
      receiverPhoneNumber: (address.receiverPhoneNumber || phoneNumber).trim(),
      addressLine1: address.addressLine1.trim(),
      addressLine2: (address.addressLine2 || '').trim(),
      city: address.city.trim(),
      state: address.state.trim(),
      pincode: address.pincode.trim(),
      country: (address.country || 'India').trim(),
    };

    // Connect to the database
    await connectToDatabase();

    // Lean query with projection for better performance
    const user = await User.findOne(
      { phoneNumber }, 
      { addresses: 1 }
    );
    
    if (!user) {
      return NextResponse.json(
        { message: 'User not found.' },
        { status: 404 }
      );
    }

    // Check if similar address exists
    const addressExists = user.addresses.some(existingAddress => 
      areAddressesEqual(existingAddress, processedAddress)
    );

    if (addressExists) {
      // If address exists, find it and return it
      const existingAddressIndex = user.addresses.findIndex(existingAddress => 
        areAddressesEqual(existingAddress, processedAddress)
      );
      
      return NextResponse.json(
        { 
          message: 'Using existing address.',
          latestAddress: user.addresses[existingAddressIndex],
        },
        { status: 200 }
      );
    }

    // Add the new address directly with updateOne for better performance
    const updateResult = await User.updateOne(
      { phoneNumber },
      { $push: { addresses: processedAddress } }
    );
    
    if (updateResult.modifiedCount === 1) {
      // Get the updated user to get the newly added address
      const updatedUser = await User.findOne({ phoneNumber }, { addresses: { $slice: -1 } });
      return NextResponse.json(
        { 
          message: 'Address added successfully.',
          latestAddress: updatedUser.addresses[0],
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { message: 'Failed to add address.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error adding address:', error.message);
    return NextResponse.json(
      { message: 'Internal Server Error.' },
      { status: 500 }
    );
  }
}
