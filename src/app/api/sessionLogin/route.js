// src/app/api/sessionLogin/route.js

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';

export async function POST(request) {
  console.log("Session login API called");

  try {
    const { idToken } = await request.json();
    console.log("Token received:", idToken);

    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days in milliseconds

    // Verify the ID token and create a session cookie
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    // Set the session cookie (HttpOnly, Secure, 5-day expiration)
    const cookieStore=await cookies();
    cookieStore.set({
      name: 'session',
      value: sessionCookie,
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 5, // 5 days in seconds
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in sessionLogin:', error);

    const isFirebaseError = error?.errorInfo?.code?.startsWith("auth/");
    const statusCode = isFirebaseError ? 401 : 500;

    return NextResponse.json(
      { error: isFirebaseError ? 'Invalid token' : 'Server error', details: error.message },
      { status: statusCode }
    );
  }
}
