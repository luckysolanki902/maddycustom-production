// @/app/api/user/addresses/[addressId]/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';
import { withAuth } from '@/lib/middleware/authMiddleware';
import mongoose from 'mongoose';

// Get a specific address
async function handleGET(request, { params }) {
  try {
    const { addressId } = params;

    // User is attached by auth middleware
    const user = request.user;
    
    // Find the specific address
    const address = user.addresses.id(addressId);
    
    if (!address) {
      return NextResponse.json(
        { message: 'Address not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ address });
  } catch (error) {
    console.error('Error retrieving address:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Update an address
async function handlePUT(request, { params }) {
  try {
    const { addressId } = params;
    const updates = await request.json();

    // User is attached by auth middleware
    const user = request.user;
    
    // Find the address to update
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
    
    if (addressIndex === -1) {
      return NextResponse.json(
        { message: 'Address not found' },
        { status: 404 }
      );
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (key !== '_id') { // Don't update the ID
        user.addresses[addressIndex][key] = updates[key];
      }
    });

    // If setting as primary, unset any other primary addresses
    if (updates.isPrimary) {
      user.addresses.forEach((addr, idx) => {
        if (idx !== addressIndex) {
          addr.isPrimary = false;
        }
      });
    }

    // Save changes
    await user.save();

    return NextResponse.json({
      message: 'Address updated successfully',
      address: user.addresses[addressIndex]
    });
  } catch (error) {
    console.error('Error updating address:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Delete an address
async function handleDELETE(request, { params }) {
  try {
    const { addressId } = params;

    // User is attached by auth middleware
    const user = request.user;
    
    // Find and remove the address
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
    
    if (addressIndex === -1) {
      return NextResponse.json(
        { message: 'Address not found' },
        { status: 404 }
      );
    }

    // Check if this was the primary address
    const wasDeletedAddressPrimary = user.addresses[addressIndex].isPrimary;
    
    // Remove the address
    user.addresses.splice(addressIndex, 1);
    
    // If deleted address was primary & there are other addresses, make the first one primary
    if (wasDeletedAddressPrimary && user.addresses.length > 0) {
      user.addresses[0].isPrimary = true;
    }
    
    // Save changes
    await user.save();

    return NextResponse.json({
      message: 'Address deleted successfully',
      addresses: user.addresses
    });
  } catch (error) {
    console.error('Error deleting address:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Route handling based on HTTP method
export const GET = withAuth(handleGET);
export const PUT = withAuth(handlePUT);
export const DELETE = withAuth(handleDELETE);
