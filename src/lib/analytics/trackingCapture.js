/**
 * Client-side Tracking Data Capture
 * Captures browser-specific data that can only be obtained from the client
 * This data is sent during order creation and used later in webhook analytics
 */

/**
 * Extracts Facebook Pixel cookies (_fbp and _fbc)
 */
function getFacebookPixelData() {
  if (typeof document === 'undefined') return {};

  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});

  return {
    fbp: cookies._fbp || null,
    fbc: cookies._fbc || null,
  };
}

/**
 * Extracts Google Analytics Client ID from cookies
 */
function getGoogleAnalyticsClientId() {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key.startsWith('_ga_')) {
      // Extract client ID from GA4 cookie format: GA1.1.XXXXXXXXXX.XXXXXXXXXX
      const parts = value.split('.');
      if (parts.length >= 4) {
        return `${parts[2]}.${parts[3]}`;
      }
    }
  }
  return null;
}

/**
 * Gets the client's IP address using a public API
 * Note: This is best-effort and may not work in all environments
 */
async function getClientIP() {
  if (typeof window === 'undefined') return null;

  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      method: 'GET',
      cache: 'no-cache',
    });
    const data = await response.json();
    return data.ip || null;
  } catch (error) {
    console.warn('Failed to fetch client IP:', error);
    return null;
  }
}

/**
 * Captures all client-side tracking data needed for analytics
 * This should be called on the client side before order creation
 * 
 * @returns {Promise<Object>} Object containing tracking metadata
 */
export async function captureClientTrackingData() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const trackingData = {
      capturedAt: new Date().toISOString(),
      sourceUrl: window.location.href,
    };

    // Get Client IP
    try {
      trackingData.ip = await getClientIP();
    } catch (ipError) {
      trackingData.ip = null;
    }

    // Get User Agent
    try {
      trackingData.userAgent = navigator.userAgent;
    } catch (uaError) {
      trackingData.userAgent = null;
    }

    // Get External ID
    try {
      const facebookData = getFacebookPixelData();
      let externalId = null;
      
      // Try to get from sessionStorage if previously set
      if (typeof sessionStorage !== 'undefined') {
        externalId = sessionStorage.getItem('external_id');
      }

      // If no external_id, generate one using fbp or create random
      if (!externalId) {
        if (facebookData.fbp) {
          externalId = facebookData.fbp;
        } else {
          externalId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // Store for future use
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('external_id', externalId);
        }
      }
      
      trackingData.externalId = externalId;
    } catch (extIdError) {
      trackingData.externalId = null;
    }

    // Get Facebook Pixel data
    try {
      const fbData = getFacebookPixelData();
      trackingData.fbp = fbData.fbp || null;
      trackingData.fbc = fbData.fbc || null;
    } catch (fbError) {
      trackingData.fbp = null;
      trackingData.fbc = null;
    }

    // Get Google Analytics Client ID
    try {
      trackingData.gaClientId = getGoogleAnalyticsClientId() || null;
    } catch (gaError) {
      trackingData.gaClientId = null;
    }

    return trackingData;
  } catch (error) {
    console.error('[TrackingCapture] Failed:', error.message);
    throw error;
  }
}

/**
 * Updates external_id with user email when available
 * Should be called after user logs in or provides email
 */
export async function updateExternalIdWithEmail(email) {
  if (typeof window === 'undefined' || !email) return;

  try {
    // Hash the email using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(email.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('external_id', hashHex);
    }
    
    return hashHex;
  } catch (error) {
    console.warn('Failed to hash email for external_id:', error);
    return null;
  }
}

/**
 * Updates external_id with user phone when available
 * Should be called after user provides phone number
 */
export async function updateExternalIdWithPhone(phone) {
  if (typeof window === 'undefined' || !phone) return;

  try {
    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizedPhone = phone.replace(/\D/g, '');
    
    // Hash the phone using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizedPhone);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('external_id', hashHex);
    }
    
    return hashHex;
  } catch (error) {
    console.warn('Failed to hash phone for external_id:', error);
    return null;
  }
}
