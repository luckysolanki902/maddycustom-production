// layout.js

import '@/styles/globals.css';
import FacebookPixel from '@/components/analytics/FacebookPixel';
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics';
import Clarity from '@/components/analytics/Clarity';
import Razorpay from '@/components/analytics/Razorpay';
import { createMetadata } from '@/lib/metadata/create-metadata';
import { generateWebsiteSchema, generateOrganizationSchema } from '@/lib/metadata/generateProductSchema';
import ReduxProvider from '@/components/layouts/ReduxProvider';
import FloatingActionBar from '@/components/utils/FloatingActionButton';
import TopLoadingBar from '@/components/utils/TopLoadingBar';

export async function generateMetadata() {
  return createMetadata();
}

export default function RootLayout({ children }) {
  const websiteSchema = generateWebsiteSchema();
  const organizationSchema = generateOrganizationSchema();

  return (
    <html lang="en">
      <head>
        <FacebookPixel />
        <GoogleAnalytics />
        <Clarity />
        <Razorpay />

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
          {children}
          <FloatingActionBar />
        </ReduxProvider>
      </body>
    </html>
  );
}
