// @/components/analytics/GoogleAnalytics.js
import Script from "next/script";

const GoogleAnalytics = () => (
  <>
    <Script
      async
      src="https://www.googletagmanager.com/gtag/js?id=G-5RNLTQL0W7"
    />
    <Script
      id="google-analytics"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          // GA4
          gtag('config', 'G-5RNLTQL0W7');
          // Google Ads
          gtag('config', 'AW-17482342674');
        `,
      }}
    />
  </>
);

export default GoogleAnalytics;