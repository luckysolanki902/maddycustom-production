// src/app/layout.js
// Note: can't use 'use client' like use router directly in layout.js

import '@/styles/globals.css';
import { createMetadata } from '@/lib/metadata/create-metadata';
import { generateWebsiteSchema, generateOrganizationSchema } from '@/lib/metadata/json-lds';
import ReduxProvider from '@/components/layouts/ReduxProvider';
import FloatingActionBar from '@/components/utils/FloatingActionButton';
import TopLoadingBar from '@/components/utils/TopLoadingBar';
import AnalyticsHead from '@/components/layouts/AnalyticsHead';
import UTMCapture from '@/components/analytics/UTMCapture';

// Google Fonts
import { Krona_One, Jost, Montserrat } from 'next/font/google';

// Configure Krona One with its only available weight
const kronaOne = Krona_One({
  subsets: ['latin'],
  weight: '400', // Krona One supports only 400 weight
  display: 'swap',
});

// Configure Jost
const jost = Jost({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'], // All weights
  style: ['normal', 'italic'],
  display: 'swap',
});

// Configure Montserrat
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'], // All weights
  style: ['normal', 'italic'],
  display: 'swap',
});

// Generate metadata
export async function generateMetadata() {
  return createMetadata();
}

export default function RootLayout({ children }) {
  const websiteSchema = generateWebsiteSchema();
  const organizationSchema = generateOrganizationSchema();

  return (
    <html lang="en" className={`${kronaOne.className} ${jost.className} ${montserrat.className}`}>
      <head>
        <AnalyticsHead />

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body>
        <ReduxProvider>
          <TopLoadingBar />
          <UTMCapture />
          {children}
          <FloatingActionBar />
        </ReduxProvider>
      </body>
    </html>
  );
}
