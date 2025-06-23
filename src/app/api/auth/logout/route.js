// @/app/api/auth/logout/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectToDatabase from '@/lib/middleware/connectToDb';
import User from '@/models/User';
import { withOptionalAuth } from '@/lib/middleware/authMiddleware';

async function handler(request) {
  try {
    const cookieStore = cookies();
    
    // Clear the cookie regardless of user authentication status
    cookieStore.set({
      name: 'authToken',
      value: '',
      path: '/',
      expires: new Date(0), // Immediately expires the cookie
      maxAge: 0
    });

    // If there's a logged-in user, also invalidate their token in the database
    if (request.user) {
      await connectToDatabase();
      
      // Find user and clear their token
      const user = await User.findById(request.user._id).select('+authToken +authTokenExpiry');
      
      if (user) {
        user.authToken = undefined;
        user.authTokenExpiry = undefined;
        await user.save();
      }
    }

    return NextResponse.json(
      { message: 'Successfully logged out' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error during logout:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export const POST = withOptionalAuth(handler);
