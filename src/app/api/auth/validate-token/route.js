// @/app/api/auth/validate-token/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';
import { withAuth } from '@/lib/middleware/authMiddleware';

async function handler(request) {
  try {
    // If execution reaches here, token is valid (handled by withAuth middleware)
    const user = request.user;
    
    // Return user data without sensitive fields
    return NextResponse.json({
      isValid: true,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name || '',
        email: user.email || '',
        isVerified: user.isVerified,
        hasPrimaryAddress: user.addresses.some(addr => addr.isPrimary),
        addressCount: user.addresses.length,
      }
    });
  } catch (error) {
    console.error('Error validating token:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handler);
