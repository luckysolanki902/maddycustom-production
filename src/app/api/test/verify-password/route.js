import { NextResponse } from 'next/server';

/**
 * API route to verify test page password
 * Password is stored in ADMIN_TEST_PASSWORD env variable
 * Returns success/failure without exposing the actual password
 */
export async function POST(request) {
  try {
    const { password } = await request.json();
    
    const correctPassword = process.env.ADMIN_TEST_PASSWORD;
    
    if (!correctPassword) {
      return NextResponse.json(
        { success: false, message: 'Test page password not configured' },
        { status: 500 }
      );
    }
    
    const isValid = password === correctPassword;
    
    if (isValid) {
      return NextResponse.json(
        { success: true, message: 'Access granted' },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { success: false, message: 'Invalid password' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('[Test Password API] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
