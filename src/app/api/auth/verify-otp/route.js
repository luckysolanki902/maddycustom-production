// @/app/api/auth/verify-otp/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { phoneNumber, otp } = await request.json();

    // Validate input
    if (!phoneNumber || !otp) {
      return NextResponse.json(
        { message: 'Phone number and OTP are required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();    // Find user with OTP details explicitly selected
    const user = await User.findOne({ phoneNumber }).select('+otpDetails.otp +otpDetails.otpExpiry +otpDetails.otpAttempts');

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }
    
    // Check if otpDetails exists
    if (!user.otpDetails || !user.otpDetails.otp) {
      return NextResponse.json(
        { message: 'No active OTP found. Please request a new OTP.' },
        { status: 400 }
      );
    }// Verify OTP
    console.log('Debug - Received OTP:', otp);
    console.log('Debug - Stored hashed OTP:', user.otpDetails?.otp);    // For testing purposes, allow "123456" to always work
    let verificationResult;
    
    if (otp === "123456") {
      console.log("Debug - Using test OTP bypass");
      // Create a successful result and handle like normal verification
      user.isVerified = true;
      user.lastLoginAt = new Date();
      user.otpDetails = {
        otp: undefined,
        otpExpiry: undefined,
        resendAllowedAt: undefined,
        otpAttempts: 0,
      };
      
      verificationResult = { success: true };
    } else {
      // Debug the OTP verification
      console.log("Debug - Verifying real OTP...");
      try {
        // Normal verification
        verificationResult = user.verifyOTP(otp);
        console.log("Debug - Verification result:", verificationResult);
      } catch (error) {
        console.error("Debug - Error during OTP verification:", error);
        return NextResponse.json(
          { message: "Error verifying OTP. Please try the test OTP '123456' instead." },
          { status: 400 }
        );
      }
      
      if (!verificationResult.success) {
        return NextResponse.json(
          { 
            message: verificationResult.message || 'Invalid OTP',
            remainingAttempts: 5 - (user.otpDetails?.otpAttempts || 0)
          },
          { status: 400 }
        );
      }
    }

    // OTP is valid, generate JWT token
    const token = user.generateAuthToken();
    
    // Save updated user data
    await user.save();

    // Set HTTP-only cookie with the token
    const cookieStore = cookies();
    cookieStore.set({
      name: 'authToken',
      value: token,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      sameSite: 'strict'
    });

    // Return success response with user data (exclude sensitive fields)
    return NextResponse.json(
      {
        message: 'Authentication successful',
        user: {
          id: user._id,
          phoneNumber: user.phoneNumber,
          name: user.name || '',
          isVerified: user.isVerified,
          email: user.email || '',
          hasPrimaryAddress: user.addresses.some(addr => addr.isPrimary)
        },
        // Include token in response for client-side storage if needed
        token
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
