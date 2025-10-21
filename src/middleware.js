// middleware.js

import { NextResponse } from 'next/server';

const redirectMap = {
  // deprecated urls
  '/bike/win-wraps': '/shop/wraps/car-wraps/window-pillar-wraps/win-wraps',
  '/bike/tank-wraps-classic': '/shop/wraps/bike-wraps/tank-wraps/medium-tank-wraps',
  '/bike/bonnet-strip-wraps': '/shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps',
  // Utm redirects
  '/r/igb':'/?utm_source=Instagram&utm_medium=Profile&utm_campaign=Bio', // For instagram bio
  '/viewcart': '/?openCart=true' // For view cart
};

/**
 * Extract real client IP from request headers
 * This runs at the edge, ensuring accurate IP extraction for all requests
 */
function extractClientIp(request) {
  // Priority order for IP extraction
  const headers = [
    'x-forwarded-for',
    'x-real-ip', 
    'cf-connecting-ip',
    'true-client-ip',
    'x-client-ip',
    'x-vercel-forwarded-for'
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can be comma-separated
      const ip = value.split(',')[0].trim();
      if (ip) return ip;
    }
  }

  return request.ip || '';
}

export function middleware(request) {
  // Get the pathname of the request
  const { pathname } = request.nextUrl;

  // Check if the pathname exists in the redirect map
  if (redirectMap[pathname]) {
    // Redirect to the corresponding mapped path
    return NextResponse.redirect(new URL(redirectMap[pathname], request.url));
  }

  // For Meta CAPI requests, add client IP to headers
  // This ensures accurate IP tracking across the entire request chain
  if (pathname === '/api/meta/conversion-api') {
    const clientIp = extractClientIp(request);
    const response = NextResponse.next();
    
    // Add client IP to request headers for downstream use
    response.headers.set('x-client-ip-extracted', clientIp);
    
    return response;
  }

  // Allow the request to proceed if no match is found
  return NextResponse.next();
}

// Configure middleware to match specified paths + API routes
export const config = {
  matcher: [
    '/bike/win-wraps',
    '/bike/tank-wraps-classic',
    '/bike/bonnet-strip-wraps',
    // Utm redirects
    '/r/igb',
    '/viewcart',
    // API routes for IP extraction
    '/api/meta/conversion-api'
  ],
};
