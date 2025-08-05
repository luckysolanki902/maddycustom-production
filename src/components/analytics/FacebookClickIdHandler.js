'use client';
import { useEffect } from 'react';

/**
 * Component to handle Facebook Click ID (fbclid) parameter and convert it to fbc cookie
 * This should be used alongside the FacebookPixel component
 * Keeps fbclid in URL for the entire session to ensure fbc is available for all events
 */
const FacebookClickIdHandler = () => {
  useEffect(() => {
    // Function to handle fbclid parameter
    const handleFbclid = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const fbclid = urlParams.get('fbclid');
        
        if (fbclid) {
          // Check if we already have this fbclid stored
          const existingFbc = getCookie('fbc') || getCookie('_fbc');
          const existingFbclid = existingFbc ? existingFbc.split('.').pop() : null;
          
          // Only create new fbc if we don't have it or if it's different
          if (!existingFbc || existingFbclid !== fbclid) {
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
            
            // Create fbc in the format Facebook expects: fb.subdomainIndex.timestamp.fbclid
            const timestamp = Date.now(); // UNIX time in milliseconds
            const fbc = `fb.${subdomainIndex}.${timestamp}.${fbclid}`;
            
            // Set the _fbc cookie (Facebook's standard cookie name)
            document.cookie = `_fbc=${fbc}; path=/; max-age=7776000; SameSite=Lax`; // 90 days as recommended
            
            // Also set fbc for backward compatibility
            document.cookie = `fbc=${fbc}; path=/; max-age=7776000; SameSite=Lax`; // 90 days
            
          }
          
          // DO NOT remove fbclid from URL - keep it for subsequent page views
          // This ensures fbc is available for all events during the user session
        }
      } catch (error) {
        console.error('Error handling Facebook Click ID:', error);
      }
    };

    // Helper function to get cookie (inline for this component)
    const getCookie = (name) => {
      if (typeof window === 'undefined') return null;
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? match[2] : null;
    };

    // Run immediately
    handleFbclid();
    
    // Also listen for navigation changes (if using client-side routing)
    const handlePopState = () => {
      setTimeout(handleFbclid, 100); // Small delay to ensure URL is updated
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return null; // This component doesn't render anything
};

export default FacebookClickIdHandler;
