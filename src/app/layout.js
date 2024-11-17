// app/layout.js or app/layout.tsx
import '@/styles/globals.css';
import FacebookPixel from '@/components/analytics/FacebookPixel';
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics';
import Clarity from '@/components/analytics/Clarity';
import Razorpay from '@/components/analytics/Razorpay';
import { generateMetadataOptions } from '@/lib/metadata/generate-metadata';

// Redux
import ReduxProvider from '@/components/layouts/ReduxProvider';
import FloatingActionBar from '@/components/utils/FloatingActionButton';

export async function generateMetadata({ }) {
  return generateMetadataOptions();
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <FacebookPixel />
        <GoogleAnalytics />
        <Clarity />
        <Razorpay />
      </head>
      <body>
        <ReduxProvider>
          {children}
          <FloatingActionBar />
        </ReduxProvider>
      </body>
    </html>
  );
}
