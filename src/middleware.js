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

export function middleware(request) {
  // Get the pathname of the request
  const { pathname } = request.nextUrl;

  // Check if the pathname exists in the redirect map
  if (redirectMap[pathname]) {
    // Redirect to the corresponding mapped path
    return NextResponse.redirect(new URL(redirectMap[pathname], request.url));
  }

  // Allow the request to proceed if no match is found
  return NextResponse.next();
}

// Configure middleware to match only the specified paths
export const config = {
  matcher: [
    '/bike/win-wraps',
    '/bike/tank-wraps-classic',
    '/bike/bonnet-strip-wraps',
    // Utm redirects
    '/r/igb',
    '/viewcart'
  ],
};
