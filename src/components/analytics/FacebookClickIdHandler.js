'use client';
import { useEffect } from 'react';

/**
 * Component to handle Facebook Click ID (fbclid) parameter and convert it to fbc cookie
 * This should be used alongside the FacebookPixel component
 */
const FacebookClickIdHandler = () => {
  useEffect(() => {
    // Function to handle fbclid parameter
    const handleFbclid = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const fbclid = urlParams.get('fbclid');
        
        if (fbclid) {
          // Create fbc in the format Facebook expects: fb.1.timestamp.fbclid
          const fbc = `fb.1.${Date.now()}.${fbclid}`;
          
          // Set the fbc cookie
          document.cookie = `fbc=${fbc}; path=/; max-age=31536000; SameSite=Lax`;
          
          // Also set _fbc (Facebook's standard cookie name)
          document.cookie = `_fbc=${fbc}; path=/; max-age=31536000; SameSite=Lax`;
          
          console.log('Facebook Click ID captured and stored:', fbc);
          
          // Clean up the URL by removing fbclid parameter
          const newUrl = new URL(window.location);
          newUrl.searchParams.delete('fbclid');
          
          // Only update URL if it actually changed
          if (newUrl.href !== window.location.href) {
            window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search);
          }
        }
      } catch (error) {
        console.error('Error handling Facebook Click ID:', error);
      }
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
