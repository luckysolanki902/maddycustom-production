import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const { phoneNumber, verificationStatus } = await request.json();
    if (!phoneNumber) {
      return NextResponse.json({ success: false, message: 'Phone Number is required.' }, { status: 400 });
    }

    // Determine verification status based on parameter
    const isVerified = verificationStatus !== 'beforeVerify';
    console.log(`User verification status: ${isVerified ? 'verified' : 'not verified'}`);

    await connectToDatabase();

    let user = await User.findOne({ phoneNumber });
    console.log('User found:', user);
    
    // Generate userId outside of conditional blocks to ensure it's always defined
    const generatedUserId = uuidv4();

    if (!user) {
      // For new users, create with userId
      console.log('No user found, creating a new user with ID:', generatedUserId);
      const newUser = new User({
        userId: generatedUserId,
        phoneNumber,
        isVerified: isVerified,  // Set based on parameter
        source: 'firebase-login'
      });

      try {
        user = await newUser.save();
        console.log('New user created:', user);
      } catch (saveError) {
        console.error('Error saving new user:', saveError);
        return NextResponse.json({ 
          success: false, 
          message: 'Failed to create user account',
          error: saveError.message
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'User created successfully',
        user: {
          userId: user._id.toString(),
          name: user.name || null,
          phoneNumber: user.phoneNumber,
          addresses: user.addresses || [],
          isVerified: user.isVerified,
          userUuid: user.userId,
        },
      }, { status: 201 });
    } else {
      // For existing users
      console.log('User exists - checking for userId');
      
      // Use MongoDB updateOne directly to bypass validation
      try {
        const updateResult = await User.updateOne(
          { _id: user._id },
          { 
            $set: { 
              // Only update isVerified if we're setting it to true or if it's currently undefined
              ...(isVerified || user.isVerified === undefined ? { isVerified } : {}),
              // Set userId only if it doesn't exist
              ...(user.userId ? {} : { userId: generatedUserId })
            } 
          }
        );
        
        console.log('User updated via direct MongoDB:', updateResult);
        
        // Refresh the user data
        user = await User.findOne({ _id: user._id });
        console.log('User after update:', user);
        return NextResponse.json({
          success: true,
          message: 'User already exists, verification status updated if needed.',
          user: {
            userId: user._id.toString(),
            isVerified: user.isVerified,
            userUuid: user.userId || generatedUserId,
            name: user.name || null,
            phoneNumber: user.phoneNumber,
          },
        }, { status: 200 });
      } catch (updateError) {
        console.error('Error updating existing user via MongoDB:', updateError);
        return NextResponse.json({ 
          success: false, 
          message: 'Failed to update user account',
          error: updateError.message
        }, { status: 500 });
      }
    }
  } catch (error) {
    console.error('Error in user login:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal Server Error',
      error: error.message
    }, { status: 500 });
  }
}