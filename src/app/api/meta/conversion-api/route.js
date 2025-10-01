import { v4 as uuidv4 } from 'uuid';
import {
  FacebookAdsApi,
  ServerEvent,
  UserData,
  CustomData,
  EventRequest,
  Content,
} from 'facebook-nodejs-business-sdk';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Initialize Facebook Ads API
const access_token = process.env.FB_PIXEL_ACCESS_TOKEN;
const pixel_id = '887502090050413';

if (!access_token) {
  console.error('FB_PIXEL_ACCESS_TOKEN is not defined');
}

FacebookAdsApi.init(access_token);

/**
 * Hashes a given string using SHA256.
 * @param {string} data - The data to hash.
 * @returns {string} - The hashed data in hexadecimal format.
 */
const hashData = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Creates a Content object for Facebook Conversion API.
 * @param {object} product - The product details.
 * @returns {Content} - The Content object.
 */
const createContents = (product) => {
  try {
    const content = new Content();
    
    // Validate and set ID
    if (product.id || product._id) {
      content.setId(String(product.id || product._id));
    }
    
    // Validate and set quantity
    const quantity = parseInt(product.quantity) || 1;
    if (quantity > 0) {
      content.setQuantity(quantity);
    }
    
    // Validate and set item price
    const itemPrice = parseFloat(product.item_price) || 0;
    if (itemPrice >= 0) {
      content.setItemPrice(itemPrice);
    }
    
    return content;
  } catch (error) {
    console.error('Error creating content:', error, product);
    // Return a minimal valid content object
    return new Content().setId('unknown').setQuantity(1).setItemPrice(0);
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
  
  // If timestamp is in the future or too old, use current time
  if (!timestamp || timestamp > now || timestamp < sevenDaysAgo) {
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
  
  // Validate timestamp more thoroughly
  if (options.event_time) {
    if (isNaN(options.event_time) || options.event_time <= 0) {
      errors.push('Event time must be a valid Unix timestamp');
    } else if (options.event_time > now) {
      warnings.push(`Event timestamp ${options.event_time} is in the future, will be adjusted to current time`);
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
    for (const email of options.emails) {
      if (email && email.trim() && !emailRegex.test(email.trim())) {
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
 * POST /api/meta/conversion-api
 *
 * Handles sending events to Facebook's Conversion API.
 */
export async function POST(request) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // in milliseconds

  // Hoist event name for access in catch (avoid ReferenceError)
  let requestedEventName = 'Unknown';

  // Check if access token is available
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
    
    // Only log detailed info for non-PageView events
    const isPageView = eventName === 'PageView';

    
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
    ];
    if (!validEvents.includes(eventName)) {
      console.error('Invalid event type received:', eventName);
      return NextResponse.json(
        { message: `Invalid event type: ${eventName}. Valid events: ${validEvents.join(', ')}` },
        { status: 400 }
      );
    }

    // Prepare enhanced user data for better matching
    const hashedEmails = options.emails
      ? options.emails.map((email) => hashData(email.trim().toLowerCase()))
      : [];
    
    const hashedPhones = options.phones
      ? options.phones.map((phone) => hashData(normalizePhoneNumber(phone)))
      : [];

    // Hash external IDs for privacy
    const hashedExternalIds = options.external_ids
      ? options.external_ids.map((id) => hashData(String(id)))
      : [];

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
    if (options.first_name) {
      userData.setFirstNames([hashData(options.first_name.trim().toLowerCase())]);
    }

    // Add last name if available (additional matching signal)
    if (options.last_name) {
      userData.setLastNames([hashData(options.last_name.trim().toLowerCase())]);
    }

    // Add date of birth if available (YYYYMMDD format)
    if (options.date_of_birth) {
      userData.setDateOfBirths([hashData(options.date_of_birth)]);
    }

    // Add gender if available (m/f)
    if (options.gender && ['m', 'f'].includes(options.gender.toLowerCase())) {
      userData.setGenders([hashData(options.gender.toLowerCase())]);
    }

    // Add city if available
    if (options.city) {
      userData.setCities([hashData(options.city.trim().toLowerCase())]);
    }

    // Add state if available
    if (options.state) {
      userData.setStates([hashData(options.state.trim().toLowerCase())]);
    }

    // Add country if available
    if (options.country) {
      userData.setCountryCodes([hashData(options.country.trim().toLowerCase())]);
    }

    // Add zip code if available  
    if (options.zip_code) {
      userData.setZipCodes([hashData(options.zip_code.trim())]);
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
          const content = createContents(product);
          
          // Add additional content fields for better matching
          if (product.brand) {
            content.setBrand(String(product.brand));
          }
          if (product.category) {
            content.setCategory(String(product.category));
          }
          if (product.title || product.name) {
            content.setTitle(String(product.title || product.name));
          }
          
          return content;
        })
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
    const serverEvent = new ServerEvent()
      .setEventName(eventName)
      .setEventTime(eventTimestamp) // Use validated timestamp
      .setUserData(userData)
      .setCustomData(customData)
      .setEventSourceUrl(options.event_source_url || '')
      .setEventId(options.eventID || uuidv4())
      .setActionSource('website');

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

    // Fire the event request to Facebook
    const eventRequest = new EventRequest(access_token, pixel_id).setEvents([
      serverEvent,
    ]);

    let response;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        response = await eventRequest.execute();
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
      { message: 'Event sent successfully', response },
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
