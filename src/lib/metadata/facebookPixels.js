'use client';
import { v4 as uuidv4 } from 'uuid';
import { getFbp, getFbc, getFacebookTrackingParams, getFacebookTrackingParamsAsync } from '@/lib/utils/cookies';
import { enhanceEventData } from '@/lib/utils/userDataEnhancer';
import { getExternalId } from '@/lib/utils/externalIdManager';
import { detectClientIP, getClientIPSync } from '@/lib/utils/ipDetection';
const StopFacebookPixels = false; // Set to true to disable Facebook Pixel events

// Standard FB event names that should use fbq('track', ...). Others use 'trackCustom'.
const STANDARD_EVENTS = new Set([
  // ViewContent: Fire when a user views a product/content detail page.
  // Use to build remarketing audiences and measure interest.
  // Params: content_ids, content_type ('product' | 'product_group'), content_category, value, currency, contents[].
  'ViewContent',

  // Search: Fire when a user performs a search on the site/app.
  // Helps optimize for users actively looking for items.
  // Params: search_string, content_category, value (optional), currency, contents[], content_ids.
  'Search',

  // AddToCart: Fire when an item is added to the cart (including quick-add).
  // Critical for lower-funnel optimization and dynamic ads.
  // Params: value (line or cart value at the time), currency, contents[] (id, quantity, item_price), content_ids, content_type, num_items.
  'AddToCart',

  // AddToWishlist: Fire when an item is saved to a wishlist/favorites.
  // Signals interest slightly higher than a view, lower than cart.
  // Params: value (optional), currency, contents[], content_ids, content_type, content_category.
  'AddToWishlist',

  // InitiateCheckout: Fire when the checkout process starts (first step).
  // Use to measure funnel progression; include eventID for server deduplication.
  // Params: value (cart total at start), currency, contents[], content_ids, content_type, num_items.
  'InitiateCheckout',

  // AddPaymentInfo: Fire when payment info is submitted/selected (e.g., card entry, UPI, COD).
  // Indicates deep intent before purchase.
  // Params: value (order total or step value), currency, payment_method (string), contents[], content_ids, content_type.
  'AddPaymentInfo',

  // Purchase: Fire only after a successful order completion/confirmation.
  // Must include a stable eventID (e.g., orderId) to dedupe with server events.
  // Params: value (order total), currency, order_id (recommended), contents[] (id, quantity, item_price), content_ids, num_items.
  'Purchase',

  // Lead: Fire when a user submits a lead or expresses interest (e.g., form submit, demo request).
  // Useful for non-commerce or pre-sale objectives.
  // Params: value (optional LTV estimate), currency, content_name/category, lead_type (optional).
  'Lead',

  // CompleteRegistration: Fire when account/registration completes successfully.
  // Measures signup conversions and onboarding funnel success.
  // Params: value (optional), currency, registration_method (optional), status (optional).
  'CompleteRegistration',

  // Contact: Fire when a user makes contact (e.g., contact form submit, email/phone click).
  // Tracks successful contact intent.
  // Params: method ('phone' | 'email' | 'form'), content_name/category, value/currency (optional).
  'Contact'
]);

/**
 * CRITICAL FIX: DO NOT fetch IP from client-side
 * 
 * The previous implementation fetched IP from external services (ipify.org),
 * which caused Meta's "Server sending client IP addresses with multiple users" error.
 * 
 * CORRECT APPROACH (per Meta's documentation):
 * - Client-side code should NOT determine IP address
 * - Server-side API (/api/meta/conversion-api) must extract the REAL client IP
 *   from request headers (X-Forwarded-For, X-Real-IP, etc.)
 * - This ensures each user has their unique IP for proper attribution
 * 
 * This function now returns null, signaling the server to extract IP from headers.
 */
const getClientIp = async () => {
  // DO NOT FETCH IP FROM CLIENT SIDE
  // The server will extract the real client IP from request headers
  return null;
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

const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;

let sha256PolyfillPromise;

const loadSha256Polyfill = async () => {
  if (!sha256PolyfillPromise) {
    sha256PolyfillPromise = import('js-sha256').then((mod) => {
      if (mod && typeof mod.sha256 === 'function') {
        return mod.sha256;
      }
      if (typeof mod === 'function') {
        return mod;
      }
      if (mod && typeof mod.default === 'function') {
        return mod.default;
      }
      throw new Error('Unable to load js-sha256 module');
    });
  }
  return sha256PolyfillPromise;
};

const hashWithSubtle = async (value) => {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(value);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      // Fall through to polyfill
    }
  }

  try {
    const sha256 = await loadSha256Polyfill();
    return sha256(value);
  } catch (error) {
    return null;
  }
};

const hashIdentifier = async (value, { forceLowercase = false } = {}) => {
  if (value === undefined || value === null) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const prepared = forceLowercase ? raw.toLowerCase() : raw;
  if (SHA256_HEX_REGEX.test(prepared)) {
    return prepared.toLowerCase();
  }

  const hashed = await hashWithSubtle(prepared);
  return hashed || null;
};

const hashEmailIdentifier = async (email) => hashIdentifier(email, { forceLowercase: true });

/**
 * Sends event data to the server-side Conversion API endpoint.
 * 
 * FIRE-AND-FORGET PATTERN:
 * - Events are queued immediately (non-blocking, 0ms delay)
 * - Processed asynchronously in background
 * - Automatic retry with exponential backoff
 * - Persisted to localStorage for reliability
 * - ZERO impact on user experience
 * 
 * @param {string} eventName - The name of the event (e.g., 'Purchase', 'AddToCart').
 * @param {object} options - Additional event parameters.
 */
const sendToServer = async (eventName, options) => {
  if (StopFacebookPixels) return;
  
  // Use event queue for non-blocking, reliable delivery
  if (typeof window !== 'undefined') {
    // Lazy load the queue manager to avoid blocking initial load
    import('./eventQueueManager.js').then(module => {
      const queueManager = module.default;
      if (queueManager) {
        queueManager.enqueue(eventName, options);
      }
    }).catch(error => {
      // Fallback to direct send if queue manager fails
      console.warn('[Meta CAPI] Queue manager failed, using direct send:', error);
      sendDirectToServer(eventName, options);
    });
  } else {
    // Server-side: send directly (won't happen in normal flow)
    sendDirectToServer(eventName, options);
  }
};

/**
 * Direct send fallback (used when queue manager is unavailable)
 * @param {string} eventName - The event name
 * @param {object} options - Event options
 */
const sendDirectToServer = async (eventName, options) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch('/api/meta/conversion-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName, options }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error(`[Meta CAPI] Direct send failed for ${eventName}:`, error);
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
    
    // Detect client IP address (will use cache if available)
    // This is CRITICAL for Meta Pixel deduplication and attribution
    let client_ip_address = getClientIPSync(); // Try cache first (synchronous)
    if (!client_ip_address) {
      // If not cached, detect it (async, but won't block event)
      client_ip_address = await detectClientIP().catch(err => {
        console.warn('[Meta Pixel] IP detection failed:', err);
        return null;
      });
    }
    
    const client_user_agent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

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

    // Get persistent external_id for deduplication (CRITICAL for matching browser + server events)
    const persistentExternalId = getExternalId();
    
    // Enhanced event parameters with better data structure
    const eventParams = {
      ...enhancedData,
      fbp: fbp || null, // Send null instead of undefined
      fbc: fbc || null, // Send null instead of undefined
    };

    // Process external_ids array (merge existing + persistent)
    const externalIdsToHash = [];
    
    // Add persistent external_id first (highest priority)
    if (persistentExternalId) {
      externalIdsToHash.push(persistentExternalId);
    }
    
    // Add any additional external_ids from enhancedData
    if (eventParams.external_ids && Array.isArray(eventParams.external_ids)) {
      externalIdsToHash.push(...eventParams.external_ids);
    }
    
    // Hash all external IDs
    if (externalIdsToHash.length > 0) {
      const hashedExternalIds = (await Promise.all(
        externalIdsToHash.map(id => hashIdentifier(id))
      )).filter(Boolean);

      if (hashedExternalIds.length > 0) {
        eventParams.external_ids = hashedExternalIds;
      } else {
        delete eventParams.external_ids;
      }
    } else {
      delete eventParams.external_ids;
    }

    const normalizedEmail = finalUserData.email ? finalUserData.email.trim().toLowerCase() : '';
    if (normalizedEmail) {
      const hashedEmail = await hashEmailIdentifier(normalizedEmail);
      if (hashedEmail) {
        eventParams.emails = [hashedEmail];
      }
    }

    if (finalUserData.phoneNumber) {
      const normalizedPhone = finalUserData.phoneNumber.replace(/[^\d+]/g, '');
      const hashedPhone = await hashIdentifier(normalizedPhone);
      if (hashedPhone) {
        eventParams.phones = [hashedPhone];
      }
    }

    if (finalUserData.firstName) {
      eventParams.first_name = finalUserData.firstName.trim();
    }

    // Lightweight debug log (avoid PII output)
    try {
      const debugDetails = {
        event: name,
        eventId,
        email: Boolean(finalUserData.email || eventParams.emails?.length),
        phone: Boolean(finalUserData.phoneNumber || eventParams.phones?.length),
        value: otherOptions?.value ?? null,
        contents: otherOptions?.contents?.length || 0,
      };
      console.debug('[FB Pixel] Dispatch', debugDetails);
    } catch (logError) {
      console.error('FB Pixel debug log failed:', logError);
    }

    // Send event to Facebook Pixel (client-side)
    if (typeof window !== 'undefined' && window.fbq) {
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
      delete pixelParams.first_name; // Don't send PII to client-side pixel
      if (eventParams.external_ids) {
        pixelParams.external_ids = eventParams.external_ids;
      }

      const cmd = STANDARD_EVENTS.has(name) ? 'track' : 'trackCustom';
      window.fbq(cmd, name, pixelParams, { eventID: eventId });
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
    // Generate a unique event ID for deduplication between Pixel and CAPI
    const eventID = pageData.eventID || uuidv4();
    
    await trackEvent('PageView', userData, {
      eventID, // Include eventID for deduplication
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

/**
 * Custom event: user provided contact info (name, phone/email) on checkout step 1.
 * @param {object} userData - { firstName, email, phoneNumber }
 * @param {object} context - { totalValue, contents, numItems }
 */
export const contactInfoProvided = async (userData = {}, context = {}) => {
  try {
    await trackEvent('ContactInfoProvided', userData, {
      eventID: uuidv4(),
      value: context.totalValue || 0,
      currency: 'INR',
      contents: (context.contents || []).map(item => ({
        id: item.productId || item._id,
        quantity: item.quantity,
        item_price: item.price || 0,
        brand: item.brand,
        category: item.category,
        title: item.name
      })),
      content_name: context.contentName,
      content_category: 'checkout_contact',
      content_type: 'product',
      content_ids: (context.contents || []).map(item => item.productId || item._id),
      num_items: context.numItems || 0,
      step: 'contact'
    });
  } catch (error) {
    // swallow
  }
};

/**
 * Custom event: user initiated payment (opened payment gateway)
 * @param {object} paymentData - { value, amount_due_online, payment_mode, payment_mode_id, is_split_payment, contents, numItems, orderId? }
 * @param {object} userData - { email, phoneNumber }
 */
export const paymentInitiated = async (paymentData = {}, userData = {}) => {
  try {
    await trackEvent('PaymentInitiated', userData, {
      eventID: uuidv4(),
      value: paymentData.value || 0,
      currency: 'INR',
      amount_due_online: paymentData.amount_due_online || 0,
      payment_mode: paymentData.payment_mode || '',
      payment_mode_id: paymentData.payment_mode_id || '',
      is_split_payment: !!paymentData.is_split_payment,
      orderId: paymentData.orderId,
      contents: (paymentData.contents || []).map(item => ({
        id: item.productId || item._id,
        quantity: item.quantity,
        item_price: item.price || 0,
        brand: item.brand,
        category: item.category,
        title: item.name
      })),
      content_name: paymentData.contentName,
      content_category: 'payment',
      content_type: 'product',
      content_ids: (paymentData.contents || []).map(item => item.productId || item._id),
      num_items: paymentData.numItems || 0,
    });
  } catch (error) {
    // swallow
  }
};

/**
 * Lead event helper
 * @param {object} userData - { email?, phoneNumber?, firstName? }
 * @param {object} details - { value?, currency?, content_name?, content_category?, lead_type?, contents?, num_items? }
 */
export const lead = async (userData = {}, details = {}) => {
  try {
    await trackEvent('Lead', userData, {
      eventID: uuidv4(),
      value: details.value || 0,
      currency: details.currency || 'INR',
      content_name: details.content_name,
      content_category: details.content_category || 'lead',
      lead_type: details.lead_type,
      contents: (details.contents || []).map(item => ({
        id: item.productId || item._id,
        quantity: item.quantity || 1,
        item_price: item.price || 0,
        brand: item.brand,
        category: item.category,
        title: item.name
      })),
      content_type: details.content_type || 'product',
      content_ids: (details.contents || []).map(item => item.productId || item._id),
      num_items: details.num_items || (details.contents ? details.contents.length : 0),
    });
  } catch (error) {
    // swallow
  }
};

/**
 * Search event helper
 * @param {object} details - { search_string, content_category?, value?, currency?, contents?, num_items? }
 * @param {object} userData - optional { email?, phoneNumber? }
 */
export const searchEvent = async (details = {}, userData = {}) => {
  try {
    await trackEvent('Search', userData, {
      eventID: uuidv4(),
      search_string: details.search_string || details.query || '',
      value: details.value || 0,
      currency: details.currency || 'INR',
      content_category: details.content_category || 'search',
      contents: (details.contents || []).map(item => ({
        id: item.productId || item._id,
        quantity: item.quantity || 1,
        item_price: item.price || 0,
        brand: item.brand,
        category: item.category,
        title: item.name
      })),
      content_type: details.content_type || 'product',
      content_ids: (details.contents || []).map(item => item.productId || item._id),
      num_items: details.num_items || (details.contents ? details.contents.length : 0),
    });
  } catch (error) {
    // swallow
  }
};
