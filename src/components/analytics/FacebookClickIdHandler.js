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
            // Create fbc in the format Facebook expects: fb.1.timestamp.fbclid
            const fbc = `fb.1.${Date.now()}.${fbclid}`;
            
            // Set the fbc cookie
            document.cookie = `fbc=${fbc}; path=/; max-age=31536000; SameSite=Lax`;
            
            // Also set _fbc (Facebook's standard cookie name)
            document.cookie = `_fbc=${fbc}; path=/; max-age=31536000; SameSite=Lax`;
            
            console.log('Facebook Click ID captured and stored:', fbc);
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
