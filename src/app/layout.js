// src/app/layout.js

import '@/styles/globals.css';
import { createMetadata } from '@/lib/metadata/create-metadata';
import { generateWebsiteSchema, generateOrganizationSchema } from '@/lib/metadata/json-lds';
import ReduxProvider from '@/components/layouts/ReduxProvider';
import { ScrollProvider } from '@/contexts/ScrollContext';
import FloatingActionBar from '@/components/utils/FloatingActionButton';
import TopLoadingBar from '@/components/utils/TopLoadingBar';
import AnalyticsHead from '@/components/layouts/AnalyticsHead';
import UTMCapture from '@/components/analytics/UTMCapture';
// import UTMLogger from '@/components/analytics/UTMLogger';

// Google Fonts
import { Krona_One, Jost, Montserrat } from 'next/font/google';
import RecommendationDrawer from '@/components/dialogs/RecommendationDrawer';
import TimeTracker from '@/components/utils/userBehavior/TimeTracker';
import PathnameTracker from '@/components/utils/userBehavior/PathnameTracker';
import ScrollChecker from '@/components/utils/userBehavior/ScrollChecker';
import Topbar from '@/components/layouts/Topbar';
import Sidebar from '@/components/layouts/Sidebar';
import SearchCategoryDialog from '@/components/dialogs/SearchCategoryDialog';
import Footer from '@/components/layouts/Footer';
import CartDrawer from '@/components/dialogs/CartDrawer';
import CartInitializer from '@/components/utils/CartInitializer';
import CouponTimerBanner from '@/components/showcase/banners/CouponTimerBanner';
import ClientUIWrappers from '@/components/layouts/ClientUIWrappers';

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

  // Runtime hook for pathname (client only pieces inside providers)
  return (
    <html lang="en" className={`${kronaOne.className} ${jost.className} ${montserrat.className}`}>
      <head>
        <link rel="preconnect" href="https://www.youtube.com" />
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
          <ScrollProvider>
            <UTMCapture />
            <CouponTimerBanner/>
            {/* <UTMLogger /> */}
            <TopLoadingBar />
            <Topbar />
            <Sidebar />
            <SearchCategoryDialog />
            <CartDrawer />
            <RecommendationDrawer />
            <CartInitializer />
            {children}
            <FloatingActionBar />
            <Footer />
            <TimeTracker />
            <PathnameTracker />
            <ScrollChecker />
            {/* Client-only utilities (conditionally hidden in B2B) */}
            <ClientUIWrappers />
          </ScrollProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}

// Dummy component placeholder (real implementation moved to client file)
