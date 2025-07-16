// middleware.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose'; // Lightweight JWT library for Edge functions

const redirectMap = {
  // deprecated urls
  '/bike/win-wraps': '/shop/wraps/car-wraps/window-pillar-wraps/win-wraps',
  '/bike/tank-wraps-classic': '/shop/wraps/bike-wraps/tank-wraps/medium-tank-wraps',
  '/bike/bonnet-strip-wraps': '/shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps',
  // Utm redirects
  '/r/igb':'/?utm_source=Instagram&utm_medium=Profile&utm_campaign=Bio', // For instagram bio
  '/viewcart': '/?openCart=true' // For view cart
};

// Protected routes that require authentication
const protectedRoutes = [
  '/orders',
  '/account',
  '/api/user/addresses',
  '/api/user/profile',
  '/api/order/history'
];

// Verifies JWT token from cookies
async function verifyAuthToken(token) {
  try {
    if (!token) return null;
    
    // Use jose for edge compatibility
    const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secretKey);
    
    // Check token expiration
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < currentTimestamp) {
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
}

export async function middleware(request) {
  // Get the pathname of the request
  const { pathname } = request.nextUrl;
  
  // Check for redirects first
  if (redirectMap[pathname]) {
    // Redirect to the corresponding mapped path
    return NextResponse.redirect(new URL(redirectMap[pathname], request.url));
  }
  
  // Check if the path is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  if (isProtectedRoute) {
    // Get the token from cookies
    const authToken = request.cookies.get('authToken')?.value;
    
    // Verify the token
    const user = await verifyAuthToken(authToken);
    
    if (!user) {
      // If it's an API route, return 401 Unauthorized
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { message: 'Unauthorized' }, 
          { status: 401 }
        );
      }
      
      // For regular routes, redirect to login with callback URL
      const callbackUrl = encodeURIComponent(pathname);
      return NextResponse.redirect(new URL(`/?login=true&callback=${callbackUrl}`, request.url));
    }
    
    // User is authenticated, proceed with the request
    const response = NextResponse.next();
    
    // Add user ID to headers for API routes to access
    response.headers.set('X-User-ID', user.id);
    
    return response;
  }

  // Allow the request to proceed if not a protected route
  return NextResponse.next();
}

// Configure middleware to match the specified paths
export const config = {
  matcher: [
    // Include all the redirects
    '/bike/win-wraps',
    '/bike/tank-wraps-classic',
    '/bike/bonnet-strip-wraps',
    '/r/igb',
    '/viewcart',
    // Protected routes
    '/orders/:path*',
    '/account/:path*',
    '/api/user/:path*',
    '/api/order/:path*'
  ],
};
