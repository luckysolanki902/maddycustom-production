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
 * Validates event data before sending to Facebook API
 * @param {string} eventName - The event name
 * @param {object} options - The event options
 * @returns {object} - Validation result with isValid and errors
 */
const validateEventData = (eventName, options) => {
  const errors = [];
  
  // Validate event name
  if (!eventName || typeof eventName !== 'string') {
    errors.push('Event name is required and must be a string');
  }
  
  // Validate timestamp
  if (options.event_time && (isNaN(options.event_time) || options.event_time <= 0)) {
    errors.push('Event time must be a valid Unix timestamp');
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
  
  // Validate email format
  if (options.emails && Array.isArray(options.emails)) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of options.emails) {
      if (!emailRegex.test(email)) {
        errors.push(`Invalid email format: ${email}`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
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
    
    // Log the entire request payload for debugging
    console.log('Conversion API Request:', {
      eventName,
      options: {
        ...options,
        // Don't log sensitive data like emails/phones in production
        emails: options.emails ? '[REDACTED]' : undefined,
        phones: options.phones ? '[REDACTED]' : undefined,
      }
    });
    
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    // Use client timestamp if provided, otherwise use server timestamp
    const eventTimestamp = options.event_time || currentTimestamp;
    
    // Debug logging for fbc and fbp
    console.log('Facebook tracking parameters received:', {
      fbp: options.fbp || 'null',
      fbc: options.fbc || 'null',
      fbpType: typeof options.fbp,
      fbcType: typeof options.fbc,
      hasUserAgent: !!options.client_user_agent,
      hasClientIP: !!options.client_ip_address
    });
    
    // Validate the event data
    const validation = validateEventData(eventName, options);
    if (!validation.isValid) {
      console.error('Event validation failed:', validation.errors);
      return NextResponse.json(
        { 
          message: 'Event validation failed',
          errors: validation.errors
        },
        { status: 400 }
      );
    }
    
    // Validate eventName
    const validEvents = ['Purchase', 'AddToCart', 'ViewContent', 'InitiateCheckout', 'PageView'];
    if (!validEvents.includes(eventName)) {
      console.error('Invalid event type received:', eventName);
      return NextResponse.json(
        { message: `Invalid event type: ${eventName}. Valid events: ${validEvents.join(', ')}` },
        { status: 400 }
      );
    }

    // Prepare hashed user data
    const hashedEmails = options.emails
      ? options.emails.map((email) => hashData(email.trim().toLowerCase()))
      : [];
    const hashedPhones = options.phones
      ? options.phones.map((phone) => hashData(phone.trim()))
      : [];

    // Prepare User Data
    const userData = new UserData()
      .setEmails(hashedEmails) // hashed emails
      .setPhones(hashedPhones) // hashed phone numbers
      .setClientIpAddress(options.client_ip_address || '')
      .setClientUserAgent(options.client_user_agent || '');

    // Only set fbp and fbc if they have valid values and format
    // IMPORTANT: Only use real fbp values from Facebook Pixel, never auto-generated ones
    if (options.fbp && options.fbp !== 'null' && options.fbp !== 'undefined' && options.fbp.trim() !== '') {
      // Validate fbp format (should start with 'fb.' and have proper structure)
      if (options.fbp.startsWith('fb.') && options.fbp.split('.').length >= 4) {
        userData.setFbp(options.fbp);
        console.log('✓ Setting valid fbp from Facebook Pixel:', options.fbp);
      } else {
        console.log('✗ Invalid fbp format - skipping to avoid Facebook issues:', options.fbp);
      }
    } else {
      console.log('ℹ No fbp available - common with ad blockers, privacy settings, or first-time visitors');
    }
    
    if (options.fbc && options.fbc !== 'null' && options.fbc !== 'undefined' && options.fbc.trim() !== '') {
      // Validate fbc format (should start with 'fb.' and have proper structure)
      if (options.fbc.startsWith('fb.') && options.fbc.split('.').length >= 4) {
        userData.setFbc(options.fbc);
        console.log('✓ Setting valid fbc from Facebook click:', options.fbc);
      } else {
        console.log('✗ Invalid fbc format - skipping to avoid Facebook issues:', options.fbc);
      }
    } else {
      console.log('ℹ No fbc available - user likely didn\'t come from Facebook ad (organic traffic)');
    }

    // Prepare Contents
    const contents = options.contents
      ? options.contents.map(createContents)
      : [];

    // Prepare Custom Data with validation
    const customData = new CustomData()
      .setCurrency(options.currency || 'INR');
    
    // Only set value if it's a valid number
    if (options.value && !isNaN(options.value) && options.value > 0) {
      customData.setValue(parseFloat(options.value));
    }
    
    // Only set orderId for Purchase events
    if (eventName === 'Purchase' && options.orderId) {
      customData.setOrderId(options.orderId);
    }
    
    // Only set contents if they exist and are valid
    if (contents && contents.length > 0) {
      customData.setContents(contents);
    }

    // Build the Server Event
    const serverEvent = new ServerEvent()
      .setEventName(eventName)
      .setEventTime(eventTimestamp)
      .setUserData(userData)
      .setCustomData(customData)
      .setEventSourceUrl(options.event_source_url || window?.location?.href || '')
      .setEventId(options.eventID || uuidv4())
      .setActionSource('website');

    // Log the event data being sent (for debugging)
    const hasUserIdentifiers = !!(hashedEmails.length || hashedPhones.length || options.fbp || options.fbc);
    console.log('Sending event to Facebook:', {
      eventName,
      eventTime: eventTimestamp,
      eventId: options.eventID || 'generated',
      hasUserData: hasUserIdentifiers,
      hasCustomData: !!(options.value || contents.length),
      userIdentifiers: {
        emails: hashedEmails.length,
        phones: hashedPhones.length,
        fbp: !!options.fbp,
        fbc: !!options.fbc
      }
    });

    // Warn if no user identifiers are available
    if (!hasUserIdentifiers) {
      console.warn('⚠️ No user identifiers available (no email, phone, fbp, or fbc).');
      console.warn('   This is normal for:');
      console.warn('   - Users with ad blockers');
      console.warn('   - Privacy-focused browsers');
      console.warn('   - First-time visitors');
      console.warn('   - Organic traffic (non-Facebook)');
      console.warn('   Event will still be sent but attribution may be limited.');
    }

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
        console.error(`Attempt ${attempt} - Error sending event to Facebook:`, {
          message: error.message,
          stack: error.stack,
          response: error.response?.data || error.response?.body || null,
          status: error.response?.status || null,
          headers: error.response?.headers || null,
        });
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
    console.error('Final Error sending event to Facebook:', {
      message: err.message,
      stack: err.stack,
      response: err.response?.data || err.response?.body || null,
      status: err.response?.status || null,
      details: err.response || null,
    });
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
