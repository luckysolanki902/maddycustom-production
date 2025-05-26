import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';

export async function GET() {
  const cookieStore = await cookies(); // ✅ Now correctly awaited
  const sessionCookie = cookieStore.get('session')?.value;
  console.log("Checking session cookie:", sessionCookie);
  if (!sessionCookie) {
    console.log("No session cookie found");
    return Response.json({ isLoggedIn: false });
  }

  try {
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    console.log("Session verified for user:", decodedToken.uid);
    return Response.json({
      isLoggedIn: true,
      phoneNumber: decodedToken.phone_number ?? null, // optionally return phone
    });
  } catch (error) {
    console.error("Session verification failed:", error);
    return Response.json({ isLoggedIn: false });
  }
}
