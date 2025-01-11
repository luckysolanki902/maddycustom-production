// middleware.js

import { NextResponse } from 'next/server';

const redirectMap = {
  '/bike/royal-enfield-classic': '/shop/wraps/bike-wraps/full-bike-wraps/royal-enfield-classic-350',
  '/bike/ktm-duke': '/shop/wraps/bike-wraps/full-bike-wraps/ktm-duke',
  '/bike/yamaha-mt': '/shop/wraps/bike-wraps/full-bike-wraps/yamaha-mt',
  '/bike/pulsar-n160': '/shop/wraps/bike-wraps/full-bike-wraps/pulsar-n160',
  '/bike/pulsar-ns': '/shop/wraps/bike-wraps/full-bike-wraps/pulsar-ns-160',
  '/bike/ktm-rc': '/shop/wraps/bike-wraps/full-bike-wraps/ktm-rc-390',
  '/bike/tvs-raider': '/shop/wraps/bike-wraps/full-bike-wraps/tvs-raider',
  '/bike/hero-splendor': '/shop/wraps/bike-wraps/full-bike-wraps/hero-splender',
  '/bike/yamha-r15': '/shop/wraps/bike-wraps/full-bike-wraps/yamaha-r15-v3',
  '/bike/tvs-apache': '/shop/wraps/bike-wraps/full-bike-wraps/apache-160-4v',
  '/bike/helmet-wraps': '/shop/accessories/safety/graphic-helmets/helmet-store',
  '/bike/win-wraps': '/shop/wraps/car-wraps/window-pillar-wraps/win-wraps',
  '/bike/tank-wraps-classic': '/shop/wraps/bike-wraps/tank-wraps/medium-tank-wraps',
  '/bike/bonnet-strip-wraps': '/shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps',
  // Utm redirects
  '/r/igb':'/?utm_source=Instagram&utm_medium=Profile&utm_campaign=Bio', // For instagram bio
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
    '/bike/royal-enfield-classic',
    '/bike/ktm-duke',
    '/bike/yamaha-mt',
    '/bike/pulsar-n160',
    '/bike/pulsar-ns',
    '/bike/ktm-rc',
    '/bike/tvs-raider',
    '/bike/hero-splendor',
    '/bike/yamha-r15',
    '/bike/tvs-apache',
    '/bike/helmet-wraps',
    '/bike/win-wraps',
    '/bike/tank-wraps-classic',
    '/bike/bonnet-strip-wraps',
    // Utm redirects
    '/r/igb',
  ],
};
