// src/app/api/sessionLogin/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';

export async function POST(request) {
  console.log("Session login API called");
  
  try {
    const { idToken } = await request.json();
    console.log("Token received:", idToken);
    
    // Special handling for development mock token
    if (idToken === 'mock-id-token') {
      console.log("Development mock token detected - bypassing verification");
      
      // Create a session cookie without verification
      const sessionId = 'dev-session-' + Date.now();
      cookies().set({
        name: 'session',
        value: sessionId,
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 5, // 5 days
        path: '/',
      });
      
      return NextResponse.json({ 
        success: true,
        message: 'Development mock token accepted',
        sessionId
      });
    }
    
    // For real tokens, verify with Firebase Admin
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      
      // Create a session cookie
      const sessionId = uid + '-' + Date.now();
      cookies().set({
        name: 'session',
        value: sessionId,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 5, // 5 days
        path: '/',
      });
      
      return NextResponse.json({ success: true });
    } catch (firebaseError) {
      console.error("Firebase verification error:", firebaseError);
      return NextResponse.json(
        { error: 'Invalid token', details: firebaseError.message },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Error in sessionLogin:', error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}