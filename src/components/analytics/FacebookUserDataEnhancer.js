'use client';
import { useEffect } from 'react';
import { initializeUserDataCollection } from '@/lib/utils/userDataEnhancer';

/**
 * Component to initialize enhanced user data collection for better Facebook Conversion API match quality
 * This should be added to your root layout or main app component
 */
const FacebookUserDataEnhancer = () => {
  useEffect(() => {
    // Initialize user data collection
    initializeUserDataCollection();

    // Set up additional monitoring for user interactions
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User returned to tab, potentially update user data
        const currentEmail = sessionStorage.getItem('currentEmail');
        const currentPhone = sessionStorage.getItem('currentPhone');
        
        if (currentEmail || currentPhone) {
          // Store latest user data for tracking
          const userData = {};
          if (currentEmail) userData.email = currentEmail;
          if (currentPhone) userData.phoneNumber = currentPhone;
          
          localStorage.setItem('latestUserData', JSON.stringify(userData));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null; // This component doesn't render anything
};

export default FacebookUserDataEnhancer;
