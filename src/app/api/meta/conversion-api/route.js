import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Import Facebook SDK classes - these should be synchronous imports
import {
  FacebookAdsApi,
  ServerEvent,
  UserData,
  CustomData,
  EventRequest,
  Content,
} from 'facebook-nodejs-business-sdk';

// MUST be dynamic: Conversion tracking requires real-time event processing
export const dynamic = 'force-dynamic';

// Initialize Facebook Ads API
const pixel_id = '887502090050413';

// Validate SDK imports at module load time
const validateSDK = () => {
  const issues = [];
  
  if (typeof Content !== 'function') {
    issues.push('Content class is not a function');
  }
  if (typeof ServerEvent !== 'function') {
    issues.push('ServerEvent class is not a function');
  }
  if (typeof UserData !== 'function') {
    issues.push('UserData class is not a function');
  }
  if (typeof CustomData !== 'function') {
    issues.push('CustomData class is not a function');
  }
  if (typeof EventRequest !== 'function') {
    issues.push('EventRequest class is not a function');
  }
  if (typeof FacebookAdsApi !== 'object' && typeof FacebookAdsApi !== 'function') {
    issues.push('FacebookAdsApi is not available');
  }
  
  if (issues.length > 0) {
    console.error('[Meta CAPI] SDK Validation Issues:', issues);
    return false;
  }
  
  console.log('[Meta CAPI] SDK validated successfully');
  return true;
};

// Run validation
const isSDKValid = validateSDK();

let isInitialized = false;
const initializeFacebookAPI = () => {
  const access_token = process.env.FB_PIXEL_ACCESS_TOKEN;
  if (!isInitialized && access_token) {
    try {
      FacebookAdsApi.init(access_token);
      isInitialized = true;
    } catch (error) {
      console.error('[Meta CAPI] Failed to initialize Facebook API:', error);
      throw error;
    }
  } else if (!access_token) {
    console.error('FB_PIXEL_ACCESS_TOKEN is not defined');
  }
};

/**
 * Simple in-memory rate limiter
 * Prevents overwhelming Meta's API with too many requests
 */
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map(); // ip -> timestamps[]
  }

  /**
   * Check if request is allowed
   * @param {string} identifier - IP address or other identifier
   * @returns {boolean} - Whether request is allowed
   */
  isAllowed(identifier) {
    const now = Date.now();
    const timestamps = this.requests.get(identifier) || [];
    
    // Remove old timestamps outside the window
    const recentTimestamps = timestamps.filter(t => now - t < this.windowMs);
    
    if (recentTimestamps.length >= this.maxRequests) {
      return false;
    }
    
    // Add current timestamp
    recentTimestamps.push(now);
    this.requests.set(identifier, recentTimestamps);
    
    // Cleanup old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanup();
    }
    
    return true;
  }

  /**
   * Cleanup old entries
   */
  cleanup() {
    const now = Date.now();
    for (const [identifier, timestamps] of this.requests.entries()) {
      const recent = timestamps.filter(t => now - t < this.windowMs);
      if (recent.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, recent);
      }
    }
  }
}

// Rate limiter: 100 requests per minute per IP
const rateLimiter = new RateLimiter(100, 60000);

/**
 * Hashes a given string using SHA256.
 * @param {string} data - The data to hash.
 * @returns {string} - The hashed data in hexadecimal format.
 */
const hashData = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

const isSha256Hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value.trim());

/**
 * Creates a Content object for Facebook Conversion API.
 * @param {object} product - The product details.
 * @returns {Content} - The Content object.
 */
const createContents = (product) => {
  try {
    // Create Content instance
    const content = new Content();
    
    // Set ID (required field)
    const productId = product.id || product._id;
    if (productId) {
      content.setId(String(productId));
    } else {
      content.setId('unknown');
    }
    
    // Set quantity (with validation)
    const quantity = parseInt(product.quantity);
    if (!isNaN(quantity) && quantity > 0) {
      content.setQuantity(quantity);
    } else {
      content.setQuantity(1);
    }
    
    // Set item price (with validation)
    const itemPrice = parseFloat(product.item_price);
    if (!isNaN(itemPrice) && itemPrice >= 0) {
      content.setItemPrice(itemPrice);
    } else {
      content.setItemPrice(0);
    }
    
    return content;
  } catch (error) {
    console.error('[Meta CAPI] Error creating content:', error, product);
    // Return a minimal valid content object as fallback
    try {
      const fallbackContent = new Content();
      fallbackContent.setId('unknown');
      fallbackContent.setQuantity(1);
      fallbackContent.setItemPrice(0);
      return fallbackContent;
    } catch (fallbackError) {
      console.error('[Meta CAPI] CRITICAL: Cannot create fallback Content object:', fallbackError);
      throw new Error('Facebook SDK Content class is not functional');
    }
  }
};

/**
 * Normalizes phone number for better matching
 * @param {string} phone - The phone number to normalize
 * @returns {string} - The normalized phone number
 */
const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  // Remove all non-digit characters except + at the beginning
  let normalized = phone.replace(/[^\d+]/g, '');
  // Remove leading zeros after country code
  if (normalized.startsWith('+')) {
    const parts = normalized.split('');
    let countryCode = '+';
    let i = 1;
    // Extract country code (1-4 digits after +)
    while (i < parts.length && i <= 4) {
      countryCode += parts[i];
      i++;
    }
    // Remove leading zeros from the rest
    let number = parts.slice(i).join('').replace(/^0+/, '');
    normalized = countryCode + number;
  } else {
    // Remove leading zeros
    normalized = normalized.replace(/^0+/, '');
  }
  return normalized;
};

/**
 * Extracts external ID from cookie for better event matching
 * This reads the mc_external_id cookie set by the browser
 * @param {Request} request - The Next.js request object
 * @returns {string|null} - The extracted external ID or null
 */
const getExternalIdFromCookie = (request) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'mc_external_id' && value) {
        const decoded = decodeURIComponent(value);
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(decoded)) {
          return decoded;
        }
      }
    }
  } catch (error) {
    console.error('[External ID] Error reading cookie:', error);
  }
  
  return null;
};

/**
 * Extracts external ID from URL for better event matching
 * @param {string} url - The URL to extract external ID from
 * @returns {string|null} - The extracted external ID or null
 */
const extractExternalId = (url) => {
  try {
    const urlObj = new URL(url);
    // Try to extract meaningful identifiers from URL
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const searchParams = urlObj.searchParams;
    
    // Check for product IDs, user IDs, session IDs, etc.
    const possibleIds = [
      searchParams.get('id'),
      searchParams.get('product_id'),
      searchParams.get('user_id'),
      searchParams.get('session_id'),
      pathParts[pathParts.length - 1], // Last path segment
    ].filter(Boolean);
    
    return possibleIds[0] || null;
  } catch (error) {
    return null;
  }
};

/**
 * Validates and sanitizes timestamp to ensure it's not in the future
 * @param {number} timestamp - The timestamp to validate
 * @returns {number} - The validated timestamp
 */
const validateTimestamp = (timestamp) => {
  const now = Math.floor(Date.now() / 1000);
  const sevenDaysAgo = now - (7 * 24 * 60 * 60); // 7 days in seconds
  const futureBuffer = 10; // Allow 10 seconds into the future for clock sync issues
  
  // If timestamp is too far in future or too old, use current time
  if (!timestamp || timestamp > (now + futureBuffer) || timestamp < sevenDaysAgo) {
    return now;
  }
  
  return timestamp;
};

/**
 * Validates event data before sending to Facebook API
 * @param {string} eventName - The event name
 * @param {object} options - The event options
 * @returns {object} - Validation result with isValid and errors
 */
const validateEventData = (eventName, options) => {
  const errors = [];
  const warnings = [];
  
  // Validate event name
  if (!eventName || typeof eventName !== 'string') {
    errors.push('Event name is required and must be a string');
  }
  
  const now = Math.floor(Date.now() / 1000);
  const sevenDaysAgo = now - (7 * 24 * 60 * 60);
  const futureBuffer = 10; // Allow 10 seconds for clock sync
  
  // Validate timestamp more thoroughly
  if (options.event_time) {
    if (isNaN(options.event_time) || options.event_time <= 0) {
      errors.push('Event time must be a valid Unix timestamp');
    } else if (options.event_time > (now + futureBuffer)) {
      warnings.push(`Event timestamp ${options.event_time} is too far in the future, will be adjusted to current time`);
    } else if (options.event_time < sevenDaysAgo) {
      warnings.push(`Event timestamp ${options.event_time} is older than 7 days, will be adjusted to current time`);
    }
  }
  
  // Validate value for purchase events
  if (eventName === 'Purchase' && (!options.value || isNaN(options.value) || options.value <= 0)) {
    errors.push('Purchase events must have a valid value greater than 0');
  }
  
  // Validate currency
  if (options.currency && typeof options.currency !== 'string') {
    errors.push('Currency must be a string');
  }
  
  // Validate contents array
  if (options.contents && !Array.isArray(options.contents)) {
    errors.push('Contents must be an array');
  }
  
  // Validate email format (but make it optional and forgiving)
  if (options.emails && Array.isArray(options.emails)) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const sha256Regex = /^[a-f0-9]{64}$/;
    for (const email of options.emails) {
      const normalized = email?.trim();
      if (!normalized) continue;
      const isPlainEmail = emailRegex.test(normalized);
      const isSha256 = sha256Regex.test(normalized.toLowerCase());
      if (!isPlainEmail && !isSha256) {
        warnings.push(`Email format may be invalid, but will still be processed: ${email}`);
        // Don't add to errors - just warn, as email is optional
      }
    }
  }
  
  // Validate phone numbers
  if (options.phones && Array.isArray(options.phones)) {
    for (const phone of options.phones) {
      if (!phone || typeof phone !== 'string' || phone.length < 10) {
        warnings.push(`Phone number too short or invalid: ${phone}`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Delays execution for a specified number of milliseconds.
 * @param {number} ms - The delay duration in milliseconds.
 * @returns {Promise} - A promise that resolves after the delay.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extracts real client IP from request headers
 * CRITICAL: This fixes the "Server sending client IP addresses with multiple users" error
 * 
 * Enhanced with middleware pre-extraction for better performance
 * 
 * @param {Request} request - The Next.js request object
 * @returns {string} - The client IP address or empty string
 */
const extractClientIpFromRequest = (request) => {
  try {
    // First, check if middleware already extracted the IP (fastest path)
    const middlewareIp = request.headers.get('x-client-ip-extracted');
    if (middlewareIp && middlewareIp !== '' && isValidIpAddress(middlewareIp)) {
      console.log('[CAPI IP] Using middleware-extracted IP:', middlewareIp);
      return middlewareIp;
    }

    // Fallback to manual extraction (industry standard priority order)
    const headers = [
      'x-forwarded-for',      // Most common proxy/load balancer header
      'x-real-ip',            // Alternative proxy header
      'cf-connecting-ip',     // Cloudflare
      'true-client-ip',       // Cloudflare Enterprise
      'x-client-ip',          // Some CDNs
      'x-vercel-forwarded-for' // Vercel
    ];

    for (const header of headers) {
      const value = request.headers.get(header);
      if (value) {
        // x-forwarded-for can be comma-separated: "client, proxy1, proxy2"
        // We want the FIRST IP (the original client)
        const ip = value.split(',')[0].trim();
        if (ip && isValidIpAddress(ip)) {
          console.log(`[CAPI IP] Extracted from ${header}:`, ip);
          return ip;
        }
      }
    }

    // Final fallback to request.ip if available
    if (request.ip && isValidIpAddress(request.ip)) {
      console.log('[CAPI IP] Using request.ip:', request.ip);
      return request.ip;
    }

    console.warn('[CAPI IP] No valid IP found, using empty string');
    return ''; // Return empty string if no valid IP found
  } catch (error) {
    console.error('[CAPI] Error extracting client IP:', error);
    return '';
  }
};

/**
 * Validates IP address format (IPv4 or IPv6)
 * @param {string} ip - The IP address to validate
 * @returns {boolean} - Whether the IP is valid
 */
const isValidIpAddress = (ip) => {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  if (!trimmed) return false;

  // IPv4 validation
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(trimmed)) return true;

  // IPv6 validation
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^(?:[0-9a-fA-F]{1,4}:)*::[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*$/;
  if (ipv6Regex.test(trimmed) && trimmed.includes(':')) return true;

  return false;
};

/**
 * POST /api/meta/conversion-api
 *
 * Handles sending events to Facebook's Conversion API.
 */
export async function POST(request) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // in milliseconds

  // Hoist event name for access in catch (avoid ReferenceError)
  let requestedEventName = 'Unknown';

  // Validate SDK before proceeding
  if (!isSDKValid) {
    console.error('[Meta CAPI] SDK validation failed - cannot process request');
    return NextResponse.json(
      { error: 'Facebook SDK not properly initialized' },
      { status: 500 }
    );
  }

  // Initialize Facebook API and check if access token is available
  initializeFacebookAPI();
  const access_token = process.env.FB_PIXEL_ACCESS_TOKEN;
  if (!access_token) {
    console.error('FB_PIXEL_ACCESS_TOKEN is not defined');
    return NextResponse.json(
      { error: 'Facebook access token not configured' },
      { status: 500 }
    );
  }

  try {
    const { eventName, options = {} } = await request.json();
    requestedEventName = eventName || 'Unknown';
    
    // CRITICAL FIX: Extract real client IP from request headers
    const realClientIp = extractClientIpFromRequest(request);
    
    // Log IP extraction for debugging (only for non-PageView events)
    if (!eventName || eventName !== 'PageView') {
      console.log(`[Meta CAPI] IP extracted for ${eventName || 'Unknown'}:`, {
        ip: realClientIp || 'MISSING',
        ipValid: !!realClientIp,
        ipLength: realClientIp?.length || 0,
      });
    }
    
    // Rate limiting (protect API from abuse)
    if (realClientIp && !rateLimiter.isAllowed(realClientIp)) {
      console.warn(`[Meta CAPI] Rate limit exceeded for IP: ${realClientIp}`);
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.'
        },
        { status: 429 }
      );
    }
    
    // Handle client IP address - prefer client-detected IP over server extraction
    // This is CRITICAL for Meta Pixel deduplication and attribution
    const clientProvidedIp = options.client_ip_address;
    const hasValidClientIp = clientProvidedIp && 
      typeof clientProvidedIp === 'string' && 
      clientProvidedIp.trim() !== '' &&
      clientProvidedIp !== 'null' &&
      clientProvidedIp !== 'undefined';
    
    if (!hasValidClientIp) {
      // Only use server-extracted IP as fallback when client doesn't provide one
      options.client_ip_address = realClientIp;
      
      // Log the fallback usage for monitoring
      if (!['PageView'].includes(eventName)) {
        console.log(`[Meta CAPI] Using server-extracted IP (${realClientIp}) - client IP not provided for ${eventName}`);
      }
    } else {
      // Client provided valid IP - use it!
      // This ensures IP matches between browser Pixel and server CAPI
      if (!['PageView'].includes(eventName)) {
        console.log(`[Meta CAPI] Using client-detected IP (${clientProvidedIp}) for ${eventName}`);
      }
    }
    
    // Also extract user agent from headers if not provided or empty
    if (!options.client_user_agent || options.client_user_agent.trim() === '') {
      const userAgentFromHeaders = request.headers.get('user-agent');
      if (userAgentFromHeaders) {
        options.client_user_agent = userAgentFromHeaders;
      }
    }    // Only log detailed info for non-PageView events
    const isPageView = eventName === 'PageView';

    // Log incoming request for critical events (helps debug coverage issues)
    if (!isPageView && ['InitiateCheckout', 'Purchase', 'AddToCart'].includes(eventName)) {
      console.log(`[Meta CAPI] Received ${eventName} request`, {
        eventID: options.eventID || options.event_id || 'na',
        hasEmail: Boolean(options.emails?.length),
        hasPhone: Boolean(options.phones?.length),
        value: options.value ?? null,
      });
    }
    
    // Validate and fix timestamp
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const eventTimestamp = validateTimestamp(options.event_time || currentTimestamp);
    
    // Log timestamp correction if needed
    if (options.event_time && options.event_time !== eventTimestamp) {
      console.warn(`Timestamp corrected from ${options.event_time} to ${eventTimestamp} (future/old timestamp detected)`);
    }
    

    // Validate the event data
    const validation = validateEventData(eventName, options);
    if (!validation.isValid) {
      console.error(`Event validation failed [${eventName}]:`, validation.errors);
      return NextResponse.json(
        { 
          message: 'Event validation failed',
          errors: validation.errors
        },
        { status: 400 }
      );
    }
    
    // Log warnings
    if (validation.warnings && validation.warnings.length > 0 && !isPageView) {
      console.warn(`Event validation warnings [${eventName}]:`, validation.warnings);
    }
    
    // Validate eventName
    const validEvents = [
      'Purchase',
      'AddToCart',
      'ViewContent',
      'InitiateCheckout',
      'PageView',
      'ContactInfoProvided',
      'PaymentInitiated',
      'Search', // Add Search event
      'Lead',
    ];
    if (!validEvents.includes(eventName)) {
      console.error('Invalid event type received:', eventName);
      return NextResponse.json(
        { message: `Invalid event type: ${eventName}. Valid events: ${validEvents.join(', ')}` },
        { status: 400 }
      );
    }

    // Prepare enhanced user data for better matching
    // Support both array format (emails/phones) and single format (em/ph)
    const emailsToProcess = options.emails || (options.em ? [options.em] : []);
    const phonesToProcess = options.phones || (options.ph ? [options.ph] : []);
    
    const hashedEmails = emailsToProcess
      .map((email) => {
        if (!email) return null;
        const normalized = String(email).trim().toLowerCase();
        if (!normalized) return null;
        return isSha256Hash(normalized) ? normalized : hashData(normalized);
      })
      .filter(Boolean);
    
    const hashedPhones = phonesToProcess
      .map((phone) => {
        if (phone === undefined || phone === null) return null;
        const trimmed = String(phone).trim();
        if (!trimmed) return null;
        if (isSha256Hash(trimmed)) {
          return trimmed.toLowerCase();
        }
        const normalized = normalizePhoneNumber(trimmed);
        if (!normalized) return null;
        return hashData(normalized);
      })
      .filter(Boolean);

    // Hash external IDs for privacy
    // Support both external_ids (array) and external_id (single)
    const externalIdsToProcess = options.external_ids || (options.external_id ? [options.external_id] : []);
    const hashedExternalIds = externalIdsToProcess
      .map((id) => {
        if (id === undefined || id === null) return null;
        const prepared = String(id).trim();
        if (!prepared) return null;
        return isSha256Hash(prepared) ? prepared.toLowerCase() : hashData(prepared);
      })
      .filter(Boolean);
      
    // Debug log AFTER processing
    try {
      const debugLog = {
        event: eventName,
        eventId: options.eventID || options.event_id || 'na',
        emails: hashedEmails.length || 0,
        phones: hashedPhones.length || 0,
        externalIds: hashedExternalIds.length || 0,
        contents: options.contents?.length || 0,
        value: options.value ?? null,
      };
      console.debug('[Meta CAPI] Dispatch', debugLog);
    } catch (debugError) {
      console.error('Meta CAPI debug log failed:', debugError);
    }

    // CRITICAL: Get persistent external_id from cookie (shared with browser Pixel)
    const persistentExternalId = getExternalIdFromCookie(request);
    if (persistentExternalId) {
      // Add as first external_id (highest priority for deduplication)
      const hashedPersistentId = hashData(persistentExternalId);
      if (hashedPersistentId && !hashedExternalIds.includes(hashedPersistentId)) {
        hashedExternalIds.unshift(hashedPersistentId); // Add at beginning
      }
    }

    // Prepare User Data with enhanced matching
    const userData = new UserData()
      .setEmails(hashedEmails)
      .setPhones(hashedPhones)
      .setClientIpAddress(options.client_ip_address || '')
      .setClientUserAgent(options.client_user_agent || '');

    // Add external IDs for better cross-device tracking
    if (hashedExternalIds.length > 0) {
      userData.setExternalIds(hashedExternalIds);
    }

    // Add first name if available (Meta recommends this for better matching)
    if (options.first_name || options.fn) {
      const firstName = (options.first_name || options.fn).trim().toLowerCase();
      userData.setFirstName(hashData(firstName));
    }

    // Add last name if available (additional matching signal)
    if (options.last_name || options.ln) {
      const lastName = (options.last_name || options.ln).trim().toLowerCase();
      userData.setLastName(hashData(lastName));
    }

    // Add date of birth if available (YYYYMMDD format)
    if (options.date_of_birth || options.db) {
      const dob = options.date_of_birth || options.db;
      userData.setDateOfBirth(hashData(String(dob)));
    }

    // Add gender if available (m/f)
    if (options.gender && ['m', 'f', 'male', 'female'].includes(options.gender.toLowerCase())) {
      const gender = options.gender.toLowerCase().charAt(0); // 'm' or 'f'
      userData.setGender(hashData(gender));
    }

    // Add city if available (should be hashed)
    if (options.city || options.ct) {
      const city = (options.city || options.ct).trim().toLowerCase();
      userData.setCity(hashData(city));
    }

    // Add state if available (should be hashed - use 2-letter code)
    if (options.state || options.st) {
      const state = (options.state || options.st).trim().toLowerCase();
      userData.setState(hashData(state));
    }

    // Add country if available (use 2-letter ISO code, hashed)
    if (options.country) {
      const country = options.country.trim().toUpperCase(); // Should be 2-letter code like 'IN', 'US'
      userData.setCountry(hashData(country.toLowerCase()));
    }

    // Add zip code if available (should be hashed)
    if (options.zip_code || options.zp) {
      const zip = (options.zip_code || options.zp).trim();
      userData.setZip(hashData(zip));
    }

    // Add additional URL-based external ID for better matching
    const urlExternalId = extractExternalId(options.event_source_url || '');
    if (urlExternalId && !hashedExternalIds.includes(hashData(urlExternalId))) {
      const allExternalIds = [...hashedExternalIds, hashData(urlExternalId)];
      userData.setExternalIds(allExternalIds);
    }

    // Enhanced fbp and fbc validation and setting
    let fbpSet = false, fbcSet = false;
    
    if (options.fbp && options.fbp !== 'null' && options.fbp !== 'undefined' && options.fbp.trim() !== '') {
      if (options.fbp.startsWith('fb.') && options.fbp.split('.').length >= 4) {
        userData.setFbp(options.fbp);
        fbpSet = true;
        if (!isPageView) {
          console.log(`✓ Setting valid fbp [${eventName}]:`, options.fbp);
        }
      } else {
        if (!isPageView) {
          console.log(`✗ Invalid fbp format [${eventName}] - skipping:`, options.fbp);
        }
      }
    }
    
    if (options.fbc && options.fbc !== 'null' && options.fbc !== 'undefined' && options.fbc.trim() !== '') {
      if (options.fbc.startsWith('fb.') && options.fbc.split('.').length >= 4) {
        userData.setFbc(options.fbc);
        fbcSet = true;
        if (!isPageView) {
          console.log(`✓ Setting valid fbc [${eventName}]:`, options.fbc);
        }
      } else {
        if (!isPageView) {
          console.log(`✗ Invalid fbc format [${eventName}] - skipping:`, options.fbc);
        }
      }
    }

    // Prepare Contents with enhanced data
    const contents = options.contents
      ? options.contents.map((product) => {
          try {
            const content = createContents(product);
            
            // Add additional content fields for better matching (with defensive checks)
            if (product.brand) {
              try {
                content.setBrand(String(product.brand));
              } catch (e) {
                console.warn('[Meta CAPI] Failed to set brand:', e.message);
              }
            }
            if (product.category) {
              try {
                content.setCategory(String(product.category));
              } catch (e) {
                console.warn('[Meta CAPI] Failed to set category:', e.message);
              }
            }
            if (product.title || product.name) {
              try {
                content.setTitle(String(product.title || product.name));
              } catch (e) {
                console.warn('[Meta CAPI] Failed to set title:', e.message);
              }
            }
            
            return content;
          } catch (contentError) {
            console.error('[Meta CAPI] Error creating content item:', contentError, product);
            // Return minimal valid content with fallback
            try {
              const fallback = new Content();
              fallback.setId(String(product.id || product._id || 'unknown'));
              fallback.setQuantity(parseInt(product.quantity) || 1);
              fallback.setItemPrice(parseFloat(product.item_price) || 0);
              return fallback;
            } catch (fallbackError) {
              console.error('[Meta CAPI] CRITICAL: Content creation completely failed:', fallbackError);
              // Skip this product entirely if we can't create Content
              return null;
            }
          }
        }).filter(Boolean) // Remove any null entries from failed content creation
      : [];

    // Prepare Custom Data with enhanced fields
    const customData = new CustomData()
      .setCurrency(options.currency || 'INR');
    
    // Set value with proper validation
    if (options.value && !isNaN(options.value) && options.value > 0) {
      customData.setValue(parseFloat(options.value));
    }
    
    // Set content fields for better matching
    if (options.content_name) {
      customData.setContentName(String(options.content_name));
    }
    if (options.content_category) {
      customData.setContentCategory(String(options.content_category));
    }
    if (options.content_type) {
      customData.setContentType(String(options.content_type));
    }
    if (options.content_ids && Array.isArray(options.content_ids)) {
      customData.setContentIds(options.content_ids.map(String));
    }
    
    // Set order ID for Purchase events
    if (eventName === 'Purchase' && options.orderId) {
      customData.setOrderId(String(options.orderId));
    }
    
    // Set contents if available
    if (contents && contents.length > 0) {
      customData.setContents(contents);
      customData.setNumItems(contents.length);
    }

    // Build the Server Event with corrected timestamp
    let serverEvent;
    try {
      // Validate ServerEvent class
      if (typeof ServerEvent !== 'function') {
        throw new Error('[Meta CAPI] ServerEvent is not a function');
      }
      
      serverEvent = new ServerEvent();
      
      // Validate instance and methods
      if (!serverEvent) {
        throw new Error('[Meta CAPI] ServerEvent instance is null/undefined');
      }
      
      // Set required fields with validation
      if (typeof serverEvent.setEventName !== 'function') {
        throw new Error('[Meta CAPI] serverEvent.setEventName is not a function');
      }
      serverEvent.setEventName(eventName);
      
      if (typeof serverEvent.setEventTime !== 'function') {
        throw new Error('[Meta CAPI] serverEvent.setEventTime is not a function');
      }
      serverEvent.setEventTime(eventTimestamp); // Use validated timestamp
      
      if (typeof serverEvent.setUserData !== 'function') {
        throw new Error('[Meta CAPI] serverEvent.setUserData is not a function');
      }
      serverEvent.setUserData(userData);
      
      if (typeof serverEvent.setCustomData !== 'function') {
        throw new Error('[Meta CAPI] serverEvent.setCustomData is not a function');
      }
      serverEvent.setCustomData(customData);
      
      if (typeof serverEvent.setEventSourceUrl !== 'function') {
        throw new Error('[Meta CAPI] serverEvent.setEventSourceUrl is not a function');
      }
      serverEvent.setEventSourceUrl(options.event_source_url || '');
      
      if (typeof serverEvent.setEventId !== 'function') {
        throw new Error('[Meta CAPI] serverEvent.setEventId is not a function');
      }
      serverEvent.setEventId(options.eventID || uuidv4());
      
      if (typeof serverEvent.setActionSource !== 'function') {
        throw new Error('[Meta CAPI] serverEvent.setActionSource is not a function');
      }
      serverEvent.setActionSource('website');
      
    } catch (eventBuildError) {
      console.error('[Meta CAPI] Failed to build ServerEvent:', eventBuildError);
      throw new Error(`ServerEvent build failed: ${eventBuildError.message}`);
    }

    // Enhanced logging for event quality assessment
    const hasUserIdentifiers = !!(
      hashedEmails.length || 
      hashedPhones.length || 
      fbpSet || 
      fbcSet || 
      hashedExternalIds.length ||
      options.first_name ||
      options.last_name ||
      options.city ||
      options.state ||
      options.country ||
      options.zip_code
    );
    
    const matchQualityScore = calculateMatchQuality(
      hashedEmails.length, 
      hashedPhones.length, 
      fbpSet, 
      fbcSet, 
      hashedExternalIds.length > 0,
      !!options.first_name,
      !!options.last_name,
      !!options.city,
      !!options.state,
      !!options.country,
      !!options.zip_code,
      !!options.date_of_birth,
      !!options.gender
    );

    // Fire the event request to Facebook (already initialized and validated at function start)
    let eventRequest;
    try {
      // Validate EventRequest class
      if (typeof EventRequest !== 'function') {
        throw new Error('[Meta CAPI] EventRequest is not a function');
      }
      
      // Create event request with defensive checks
      eventRequest = new EventRequest(access_token, pixel_id);
      
      // Validate event request instance
      if (!eventRequest || typeof eventRequest.setEvents !== 'function') {
        throw new Error('[Meta CAPI] EventRequest instance invalid or setEvents method missing');
      }
      
      // Set events
      eventRequest.setEvents([serverEvent]);
      
      // Validate execute method
      if (typeof eventRequest.execute !== 'function') {
        throw new Error('[Meta CAPI] eventRequest.execute is not a function');
      }
    } catch (setupError) {
      console.error('[Meta CAPI] Failed to create EventRequest:', setupError);
      throw new Error(`EventRequest setup failed: ${setupError.message}`);
    }

    let response;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        response = await eventRequest.execute();
        
        // Log success for critical events to help monitor coverage
        if (!isPageView && ['InitiateCheckout', 'Purchase', 'AddToCart'].includes(eventName)) {
          console.log(`[Meta CAPI] ✓ ${eventName} sent to Meta successfully`, {
            eventID: options.eventID || options.event_id || 'na',
            matchQualityScore,
            realClientIp: realClientIp ? 'present' : 'missing',
            fbp: fbpSet ? 'present' : 'missing',
            fbc: fbcSet ? 'present' : 'missing',
          });
        }
        
        break; // success, break the retry loop
      } catch (error) {
        const errorDetails = {
          message: error.message,
          stack: error.stack,
          response: error.response?.data || error.response?.body || null,
          status: error.response?.status || null,
          headers: error.response?.headers || null,
        };
        
        if (!isPageView) {
          console.error(`Attempt ${attempt} - Error sending ${eventName} to Facebook:`, errorDetails);
        }
        
        if (attempt < MAX_RETRIES) {
          await delay(RETRY_DELAY * attempt);
        } else {
          throw error;
        }
      }
    }
    
    return NextResponse.json(
      { 
        message: 'Event sent successfully', 
        response,
        debug: {
          eventName,
          eventID: options.eventID || options.event_id,
          matchQualityScore,
          realClientIp: realClientIp ? 'present' : 'missing',
          hasEmail: hashedEmails.length > 0,
          hasPhone: hashedPhones.length > 0,
          hasFbc: fbcSet,
          hasFbp: fbpSet,
          hasExternalId: hashedExternalIds.length > 0,
          fbp: fbpSet ? 'present' : 'missing',
          fbc: fbcSet ? 'present' : 'missing',
        }
      },
      { status: 200 }
    );
  } catch (err) {
    const errorDetails = {
      message: err.message,
      stack: err.stack,
      response: err.response?.data || err.response?.body || null,
      status: err.response?.status || null,
      details: err.response || null,
    };
    // Avoid ReferenceError by using hoisted requestedEventName
    if (requestedEventName !== 'PageView') {
      console.error(`Final Error sending ${requestedEventName} to Facebook:`, errorDetails);
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to send event',
        details: err.message,
        status: err.response?.status || 500
      },
      { status: 500 }
    );
  }
}

/**
 * Calculates match quality score based on available user identifiers
 * @param {number} emailCount - Number of emails
 * @param {number} phoneCount - Number of phones
 * @param {boolean} hasFbp - Has Facebook browser ID
 * @param {boolean} hasFbc - Has Facebook click ID
 * @param {boolean} hasExternalId - Has external ID
 * @param {boolean} hasFirstName - Has first name
 * @param {boolean} hasLastName - Has last name
 * @param {boolean} hasCity - Has city
 * @param {boolean} hasState - Has state
 * @param {boolean} hasCountry - Has country
 * @param {boolean} hasZipCode - Has zip code
 * @param {boolean} hasDateOfBirth - Has date of birth
 * @param {boolean} hasGender - Has gender
 * @returns {number} - Match quality score (1-10)
 */
const calculateMatchQuality = (
  emailCount, 
  phoneCount, 
  hasFbp, 
  hasFbc, 
  hasExternalId, 
  hasFirstName = false,
  hasLastName = false,
  hasCity = false,
  hasState = false,
  hasCountry = false,
  hasZipCode = false,
  hasDateOfBirth = false,
  hasGender = false
) => {
  let score = 0;
  
  // Primary identifiers (most valuable)
  score += emailCount > 0 ? 4 : 0;      // Email is the most valuable
  score += phoneCount > 0 ? 3 : 0;      // Phone is very valuable
  
  // Facebook identifiers (valuable for attribution)
  score += hasFbc ? 2 : 0;              // Click ID is more valuable than browser ID
  score += hasFbp ? 1 : 0;              // Browser ID
  
  // Secondary identifiers (enhance matching)
  score += hasExternalId ? 1 : 0;       // External ID for cross-device
  score += hasFirstName ? 0.5 : 0;      // First name
  score += hasLastName ? 0.5 : 0;       // Last name
  
  // Demographic data (additional signals)
  score += hasCity ? 0.3 : 0;           // City
  score += hasState ? 0.3 : 0;          // State
  score += hasCountry ? 0.2 : 0;        // Country
  score += hasZipCode ? 0.4 : 0;        // Zip code (more specific than city)
  score += hasDateOfBirth ? 0.5 : 0;    // Date of birth
  score += hasGender ? 0.2 : 0;         // Gender
  
  return Math.min(Math.round(score * 10) / 10, 10); // Round to 1 decimal, cap at 10
};
