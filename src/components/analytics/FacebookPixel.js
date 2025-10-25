import Script from 'next/script';

const FacebookPixel = () => {
  return (
    <>
      <Script
        id="fb-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            
            // Initialize Pixel with autoConfig disabled to prevent auto-PageView
            // We'll manually track PageView with proper eventID for deduplication
            fbq('init', '887502090050413', {}, {
              autoConfig: false,  // Disable automatic PageView tracking
              debug: false
            }); 
            
            // Signal that Facebook Pixel has loaded
            window.fbPixelLoaded = true;
            window.dispatchEvent(new Event('fbPixelLoaded'));
          `,
        }}
        onLoad={() => {
          // Additional callback when script loads
          if (typeof window !== 'undefined') {
            window.fbPixelLoaded = true;
            window.dispatchEvent(new Event('fbPixelLoaded'));
          }
        }}
      />
    </>
  );
};

export default FacebookPixel;
