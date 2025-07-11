export const getCookie = (name) => {
    if (typeof window === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) return match[2];
    return null;
  };
  
  export const getFbp = () => getCookie('_fbp');
  export const getFbc = () => {
    // First try to get fbc from cookie
    let fbc = getCookie('fbc');
    
    // If not found, try to get _fbc (Facebook's standard cookie)
    if (!fbc) {
      fbc = getCookie('_fbc');
    }
    
    return fbc || null; // Return null instead of undefined for better handling
  };

  // Helper function to check if we have valid Facebook tracking parameters
  export const hasValidFacebookTracking = () => {
    const fbp = getFbp();
    const fbc = getFbc();
    return !!(fbp || fbc);
  };

  // Get Facebook tracking parameters as an object
  export const getFacebookTrackingParams = () => {
    return {
      fbp: getFbp(),
      fbc: getFbc()
    };
  };
