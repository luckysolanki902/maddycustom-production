// app/api/user/add-address/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';

// Helper function to compare addresses
const areAddressesEqual = (addr1, addr2) => {
  return (
    addr1.receiverPhoneNumber.trim() === addr2.receiverPhoneNumber.trim() &&
    addr1.addressLine1.trim().toLowerCase() === addr2.addressLine1.trim().toLowerCase() &&
    (addr1.addressLine2?.trim().toLowerCase() === (addr2.addressLine2 || '').trim().toLowerCase()) &&
    addr1.city.trim().toLowerCase() === addr2.city.trim().toLowerCase() &&
    addr1.state.trim().toLowerCase() === addr2.state.trim().toLowerCase() &&
    addr1.pincode.trim() === addr2.pincode.trim() &&
    (addr1.country?.trim().toLowerCase() === (addr2.country || 'india').trim().toLowerCase())
  );
};

export async function POST(request) {
  try {
    // Parse the JSON body of the request
    const { phoneNumber, address } = await request.json();

    // Validate required fields
    if (!phoneNumber || !address) {
      // console.warn('Add Address failed: Missing phoneNumber or address.');
      return NextResponse.json(
        { message: 'Phone number and address are required.' },
        { status: 400 }
      );
    }

    // Validate address fields
    const requiredAddressFields = ['receiverName', 'receiverPhoneNumber', 'addressLine1', 'city', 'state', 'pincode'];
    for (const field of requiredAddressFields) {
      if (!address[field] || typeof address[field] !== 'string' || address[field].trim() === '') {
        // console.warn(`Add Address failed: Missing or invalid address field '${field}'.`);
        return NextResponse.json(
          { message: `Address field '${field}' is required and must be a non-empty string.` },
          { status: 400 }
        );
      }
    }

    // Optional field: country (default to 'India' if not provided)
    if (!address.country || typeof address.country !== 'string' || address.country.trim() === '') {
      address.country = 'India';
    } else {
      address.country = address.country.trim();
    }

    // Trim all string fields in the address to maintain consistency
    for (const key in address) {
      if (typeof address[key] === 'string') {
        address[key] = address[key].trim();
      }
    }

    // Connect to the database
    await connectToDatabase();

    // Find the user by phone number
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      // console.warn(`Add Address failed: User not found with phoneNumber=${phoneNumber}.`);
      return NextResponse.json(
        { message: 'User not found.' },
        { status: 404 }
      );
    }

    // Check if the address already exists
    const addressExists = user.addresses.some(existingAddress => areAddressesEqual(existingAddress, address));

    if (addressExists) {
      // console.warn(`Add Address skipped: Address already exists for userId=${user._id}.`);
      return NextResponse.json(
        { message: 'Address already exists.', addresses: user.addresses },
        { status: 200 }
      );
    }

    // Add the new address to the user's addresses array
    user.addresses.push(address);
    await user.save();

    // Retrieve the latest address (the one just added)
    const latestAddress = user.addresses[user.addresses.length - 1];

    return NextResponse.json(
      { message: 'Address added successfully.', latestAddress, addresses: user.addresses },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error adding address:', error.message);
    return NextResponse.json(
      { message: 'Internal Server Error.' },
      { status: 500 }
    );
  }
}
