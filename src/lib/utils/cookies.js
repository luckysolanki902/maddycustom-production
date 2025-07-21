export const getCookie = (name) => {
    if (typeof window === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) return match[2];
    return null;
  };
  
  export const getFbp = () => {
    // Only return the actual _fbp cookie set by Facebook Pixel
    // Never auto-generate as this can cause issues with Facebook's systems
    return getCookie('_fbp');
  };
  export const getFbc = () => {
    // First try to get _fbc from cookie (Facebook's standard cookie name)
    let fbc = getCookie('_fbc');
    
    // If not found, try to get fbc (our backup cookie)
    if (!fbc) {
      fbc = getCookie('fbc');
    }
    
    // If still not found, try to construct from fbclid in URL (fallback)
    if (!fbc && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const fbclid = urlParams.get('fbclid');
      if (fbclid) {
        // Calculate subdomain index according to Meta's specification:
        // 'com' = 0, 'example.com' = 1, 'www.example.com' = 2
        const hostname = window.location.hostname;
        const domainParts = hostname.split('.');
        let subdomainIndex = 1; // Default value as recommended by Meta
        
        if (domainParts.length === 2) {
          subdomainIndex = 1; // example.com
        } else if (domainParts.length >= 3) {
          subdomainIndex = 2; // www.example.com or subdomain.example.com
        }
        
        const timestamp = Date.now(); // UNIX time in milliseconds
        fbc = `fb.${subdomainIndex}.${timestamp}.${fbclid}`;
        
        // Store it in cookie for future use (90 days as recommended by Meta)
        document.cookie = `_fbc=${fbc}; path=/; max-age=7776000; SameSite=Lax`;
        document.cookie = `fbc=${fbc}; path=/; max-age=7776000; SameSite=Lax`;
      }
    }
    
    return fbc || null; // Return null instead of undefined for better handling
  };

  // Helper function to check if we have valid Facebook tracking parameters
  export const hasValidFacebookTracking = () => {
    const fbp = getFbp();
    const fbc = getFbc();
    return !!(fbp || fbc);
  };

  // Get Facebook tracking parameters as an object with retry logic
  export const getFacebookTrackingParams = () => {
    const fbp = getFbp();
    const fbc = getFbc();
    
    // Log for debugging
    if (typeof window !== 'undefined') {
      const debugInfo = {
        fbp: fbp || 'not set by Facebook Pixel',
        fbc: fbc || 'no Facebook click tracking',
        fbqLoaded: !!window.fbq,
        cookiesEnabled: navigator.cookieEnabled,
        pixelStatus: window.fbq ? 'loaded' : 'not loaded or blocked'
      };
      
      console.log('Facebook tracking debug:', debugInfo);
      
      // Additional helpful info
      if (!fbp && !window.fbq) {
        console.log('💡 Tip: Facebook Pixel appears to be blocked or not loaded');
      } else if (!fbp && window.fbq) {
        console.log('💡 Tip: Facebook Pixel loaded but _fbp cookie not set (privacy settings?)');
      }
    }
    
    return {
      fbp: fbp || null,
      fbc: fbc || null
    };
  };

  // Get Facebook tracking parameters with a delay to ensure Pixel has loaded
  export const getFacebookTrackingParamsAsync = async (maxRetries = 3, delay = 500) => {
    // If Facebook Pixel is not loaded yet, wait for it
    if (typeof window !== 'undefined' && !window.fbPixelLoaded && !window.fbq) {
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 2000); // Max 2 seconds wait
        
        const handlePixelLoad = () => {
          clearTimeout(timeout);
          window.removeEventListener('fbPixelLoaded', handlePixelLoad);
          resolve();
        };
        
        window.addEventListener('fbPixelLoaded', handlePixelLoad);
      });
    }
    
    for (let i = 0; i < maxRetries; i++) {
      const params = getFacebookTrackingParams();
      
      // If we have at least fbp (more important than fbc), return
      if (params.fbp) {
        return params;
      }
      
      // If we have fbc but not fbp, continue trying for fbp
      if (params.fbc && i === maxRetries - 1) {
        return params;
      }
      
      // Wait before retrying
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Return whatever we have, even if null
    return getFacebookTrackingParams();
  };
