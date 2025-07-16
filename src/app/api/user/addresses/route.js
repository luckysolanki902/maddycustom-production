// @/app/api/user/addresses/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';
import { withAuth } from '@/lib/middleware/authMiddleware';

// Get all user addresses
async function handleGET(request) {
  try {
    // User is attached by auth middleware
    const user = request.user;

    return NextResponse.json({
      addresses: user.addresses,
      primaryAddress: user.addresses.find(addr => addr.isPrimary) || null
    });
  } catch (error) {
    console.error('Error retrieving addresses:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Add a new address
async function handlePOST(request) {
  try {
    const { 
      receiverName, 
      receiverPhoneNumber, 
      addressLine1, 
      addressLine2, 
      city, 
      state, 
      pincode, 
      country = 'India',
      isPrimary = false 
    } = await request.json();

    // Validate required fields
    if (!receiverName || !receiverPhoneNumber || !addressLine1 || !city || !state || !pincode) {
      return NextResponse.json(
        { message: 'Missing required address fields' },
        { status: 400 }
      );
    }

    // User is attached by auth middleware
    const user = request.user;

    // Create new address
    const newAddress = {
      receiverName,
      receiverPhoneNumber,
      addressLine1,
      addressLine2: addressLine2 || '',
      city,
      state,
      pincode,
      country,
      isPrimary
    };

    // If this is set as primary, unset any existing primary
    if (isPrimary) {
      user.addresses.forEach(address => {
        address.isPrimary = false;
      });
    }

    // Set as primary if it's the first address
    if (user.addresses.length === 0) {
      newAddress.isPrimary = true;
    }

    // Add the new address
    user.addresses.push(newAddress);

    // Save the updated user
    await user.save();

    return NextResponse.json({
      message: 'Address added successfully',
      address: newAddress,
      addresses: user.addresses
    });
  } catch (error) {
    console.error('Error adding address:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Update/Route handling based on HTTP method
async function handler(request) {
  switch (request.method) {
    case 'GET':
      return handleGET(request);
    case 'POST':
      return handlePOST(request);
    default:
      return NextResponse.json(
        { message: 'Method not allowed' },
        { status: 405 }
      );
  }
}

export const GET = withAuth(handleGET);
export const POST = withAuth(handlePOST);
