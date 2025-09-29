'use client';
import { v4 as uuidv4 } from 'uuid';
import { getFbp, getFbc, getFacebookTrackingParams, getFacebookTrackingParamsAsync } from '@/lib/utils/cookies';
import { enhanceEventData } from '@/lib/utils/userDataEnhancer';
const StopFacebookPixels = false; // Set to true to disable Facebook Pixel events

// Enhanced IP address detection with better IPv6 support and fallback
const getClientIp = async () => {
  try {
    // Try IPv6 first (Meta's recommendation for better matching)
    const ipv6Response = await fetch('https://api64.ipify.org?format=json', {
      timeout: 3000 // 3 second timeout
    });
    
    if (ipv6Response.ok) {
      const ipv6Data = await ipv6Response.json();
      if (ipv6Data.ip && isValidIPv6(ipv6Data.ip)) {
        return ipv6Data.ip;
      }
    }
  } catch (error) {
  }

  // Fallback to IPv4
  try {
    const ipv4Response = await fetch('https://api.ipify.org?format=json', {
      timeout: 3000 // 3 second timeout
    });
    
    if (ipv4Response.ok) {
      const ipv4Data = await ipv4Response.json();
      if (ipv4Data.ip && isValidIPv4(ipv4Data.ip)) {
        return ipv4Data.ip;
      }
    }
  } catch (error) {
    // console.error('IPv4 detection also failed:', error.message);
  }

  // Final fallback - try to get IP from headers (if available)
  try {
    // This might work in some server environments
    const response = await fetch('/api/get-client-ip', { 
      method: 'GET',
      timeout: 2000 
    });
    if (response.ok) {
      const data = await response.json();
      return data.ip || '';
    }
  } catch (error) {
  }

  return ''; // Return empty string instead of null
};

/**
 * Validates IPv6 address format
 * @param {string} ip - IP address to validate
 * @returns {boolean} - Whether IP is valid IPv6
 */
const isValidIPv6 = (ip) => {
  // Basic IPv6 validation - contains colons and proper format
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^(?:[0-9a-fA-F]{1,4}:)*::[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*$/;
  return ipv6Regex.test(ip) && ip.includes(':');
};

/**
 * Validates IPv4 address format
 * @param {string} ip - IP address to validate  
 * @returns {boolean} - Whether IP is valid IPv4
 */
const isValidIPv4 = (ip) => {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip) && !ip.includes(':');
};

/**
 * Sends event data to the server-side Conversion API endpoint.
 * @param {string} eventName - The name of the event (e.g., 'Purchase', 'AddToCart').
 * @param {object} options - Additional event parameters.
 */
const sendToServer = async (eventName, options) => {
  if (StopFacebookPixels) return;
  try {
    const res = await fetch('/api/meta/conversion-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName, options }),
    });
    if (!res.ok) throw new Error(`Server responded with status ${res.status}`);
    await res.json();
  } catch (error) {
    // console.error('Error sending event to server:', error);
  }
};

/**
 * Tracks a specific event by sending data to Facebook Pixel and the server-side Conversion API.
 * @param {string} name - The name of the event to track.
 * @param {object} formData - Optional form data (e.g., email, phoneNumber).
 * @param {object} otherOptions - Additional options and parameters for the event.
 */
const trackEvent = async (name, formData = {}, otherOptions = {}) => {
  if (StopFacebookPixels) return;
  try {
    const eventId = otherOptions.eventID || uuidv4(); // Allow passing eventID
    const eventTime = Math.floor(Date.now() / 1000); // Use current timestamp in seconds
    const client_ip_address = await getClientIp();
    const client_user_agent = navigator.userAgent;

    // Enhance event data with automatically collected user data
    const { userData: autoUserData, enhancedData } = enhanceEventData(name, otherOptions, {
      eventID: eventId,
      event_time: eventTime,
      event_name: name,
      action_source: 'website',
      event_source_url: window.location.href,
      client_ip_address,
      client_user_agent,
    });

    // Merge with provided form data (form data takes precedence)
    const finalUserData = { ...autoUserData, ...formData };

    // Try to get Facebook tracking parameters with retry logic
    let { fbp, fbc } = await getFacebookTrackingParamsAsync(3, 300); // 3 retries, 300ms delay
    
    // If still no parameters, try the synchronous method as fallback
    if (!fbp && !fbc) {
      const fallbackParams = getFacebookTrackingParams();
      fbp = fallbackParams.fbp;
      fbc = fallbackParams.fbc;
    }

    // Enhanced event parameters with better data structure
    const eventParams = {
      ...enhancedData,
      fbp: fbp || null, // Send null instead of undefined
      fbc: fbc || null, // Send null instead of undefined
    };

    // Add user identifiers from final merged data
    if (finalUserData.email) {
      eventParams.emails = [finalUserData.email.trim().toLowerCase()];
    }

    if (finalUserData.phoneNumber) {
      // Normalize phone number
      const normalizedPhone = finalUserData.phoneNumber.replace(/[^\d+]/g, '');
      eventParams.phones = [normalizedPhone];
    }

    if (finalUserData.firstName) {
      eventParams.first_name = finalUserData.firstName;
    }

    // Send event to Facebook Pixel (client-side)
    if (window.fbq) {
      // Create pixel event parameters (exclude server-specific fields)
      const pixelParams = { ...eventParams };
      delete pixelParams.eventID;
      delete pixelParams.event_time;
      delete pixelParams.event_name;
      delete pixelParams.action_source;
      delete pixelParams.client_ip_address;
      delete pixelParams.client_user_agent;
      delete pixelParams.fbp;
      delete pixelParams.fbc;
      delete pixelParams.external_ids;
      delete pixelParams.first_name; // Don't send PII to client-side pixel
      
      window.fbq('track', name, pixelParams, { eventID: eventId });
    }

    // Send event to server-side Conversion API
    await sendToServer(name, eventParams);
  } catch (error) {
    // console.error('Error tracking event:', error);
  }
};

/**
 * Tracks the "AddToCart" event.
 * @param {object} product - The product details.
 */
export const addToCart = async (product) => {
  try {
    await trackEvent('AddToCart', {}, {
      value: product.price,
      currency: 'INR',
      contents: [{
        id: product.id || product._id,
        quantity: product.quantity || 1,
        item_price: product.price || 0,
        brand: product.brand,
        category: product.category,
        title: product.name
      }],
      content_name: product.name,
      content_category: product.category,
      content_type: 'product',
      content_ids: [product.id || product._id],
      num_items: 1
    });
  } catch (error) {
    // console.error('Error in addToCart function:', error);
  }
};

/**
 * Tracks the "Purchase" event.
 * @param {object} order - The order details.
 * @param {object} userData - Optional user data (e.g., email, phoneNumber).
 */
export const purchase = async (order, userData = {}) => {
  try {
    await trackEvent('Purchase', userData, {
      eventID: order.orderId, // Use orderId as eventID for idempotency
      value: order.totalAmount,
      currency: 'INR',
      orderId: order.orderId,
      contents: order.items.map(item => ({
        id: item.product || item._id,
        quantity: item.quantity,
        item_price: item.priceAtPurchase,
        brand: item.brand,
        category: item.category,
        title: item.name
      })),
      content_name: order.items.map(item => item.name).join(', '),
      content_category: 'purchase',
      content_type: 'product',
      content_ids: order.items.map(item => item.product || item._id),
      num_items: order.items.length
    });
  } catch (error) {
    // console.error('Error in purchase function:', error);
  }
};

/**
 * Tracks the "ViewContent" event.
 * @param {object} product - The product details.
 * @param {object} userData - Optional user data (e.g., email, phoneNumber).
 */
export const viewContent = async (product, userData = {}) => {
  try {
    await trackEvent('ViewContent', userData, {
      content_name: product.name,
      content_ids: [product.id || product._id],
      content_category: product.category,
      content_type: 'product',
      value: product.price,
      currency: 'INR',
      contents: [{
        id: product.id || product._id,
        item_price: product.price || 0,
        brand: product.brand,
        category: product.category,
        title: product.name
      }],
    });
  } catch (error) {
    // console.error('Error in viewContent function:', error);
  }
};

/**
 * Tracks the "PageView" event.
 * @param {object} userData - Optional user data (e.g., email, phoneNumber).
 * @param {object} pageData - Optional page data (e.g., content_name, content_category).
 */
export const pageView = async (userData = {}, pageData = {}) => {
  try {
    await trackEvent('PageView', userData, {
      content_name: pageData.content_name || document.title,
      content_category: pageData.content_category || 'page',
      content_type: 'website',
      ...pageData,
    });
  } catch (error) {
    // console.error('Error in pageView function:', error);
  }
};

/**
 * Tracks the "InitiateCheckout" event.
 * @param {object} checkoutData - The checkout details.
 * @param {object} userData - Optional user data (e.g., email, phoneNumber).
 */
export const initiateCheckout = async (checkoutData, userData = {}) => {
  try {
    await trackEvent('InitiateCheckout', userData, {
      eventID: checkoutData.eventID || uuidv4(),
      value: checkoutData.totalValue,
      currency: 'INR',
      contents: checkoutData.contents.map(item => ({
        id: item.productId || item._id,
        quantity: item.quantity,
        item_price: item.price || 0,
        brand: item.brand,
        category: item.category,
        title: item.name
      })),
      content_name: checkoutData.contentName,
      content_category: checkoutData.contentCategory || 'checkout',
      content_type: 'product',
      content_ids: checkoutData.contents.map(item => item.productId || item._id),
      num_items: checkoutData.numItems,
    });
  } catch (error) {
    // console.error('Error in initiateCheckout function:', error);
  }
};
