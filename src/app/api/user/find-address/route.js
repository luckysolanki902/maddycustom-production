import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';

export async function POST(request) {
  try {
    // Get request body
    const { phoneNumber } = await request.json();
    
    if (!phoneNumber) {
      return NextResponse.json({ 
        success: false,
        error: 'Phone number is required' 
      }, { status: 400 });
    }
    
    // Format phone number (ensure it's just the 10 digits)
    const formattedPhone = phoneNumber.replace(/\D/g, '').slice(-10);
    
    await connectToDatabase();
    
    // Find user by phone number
    const user = await User.findOne({ phoneNumber: formattedPhone });
    
    if (!user) {
      // No user found with this phone number
      return NextResponse.json({ 
        success: false, 
        exists: false,
        message: 'User not found'
      });
    }
    
    // User exists, check if they have any addresses
    const hasAddress = user.addresses && user.addresses.length > 0;
    const latestAddress = hasAddress ? user.addresses[0] : null;
    
    // Return user data with address info
    return NextResponse.json({
      success: true,
      exists: true,
      userId: user._id,
      userUuid: user.userId || null,
      name: user.name || null,
      email: user.email || null,
      phoneNumber: user.phoneNumber,
      isVerified: user.isVerified,
      hasAddress: hasAddress,
      latestAddress: hasAddress ? latestAddress : null
    });
    
  } catch (error) {
    console.error('Find address API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}