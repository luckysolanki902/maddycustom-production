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
  return new Content()
    .setId(product.id || product._id)
    .setQuantity(product.quantity || 1)
    .setItemPrice(product.item_price || 0);
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

  try {
    const { eventName, options = {} } = await request.json();
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    // Debug logging for fbc
    console.log('Received fbc:', options.fbc);
    console.log('Received fbp:', options.fbp);
    
    // Validate eventName
    const validEvents = ['Purchase', 'AddToCart', 'ViewContent', 'InitiateCheckout'];
    if (!validEvents.includes(eventName)) {
      return NextResponse.json(
        { message: 'Invalid event type.' },
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

    // Only set fbp and fbc if they have valid values
    if (options.fbp && options.fbp.trim() !== '' && options.fbp !== 'null' && options.fbp !== 'undefined') {
      userData.setFbp(options.fbp);
      console.log('Setting fbp:', options.fbp);
    } else {
      console.log('No valid fbp provided');
    }
    
    if (options.fbc && options.fbc.trim() !== '' && options.fbc !== 'null' && options.fbc !== 'undefined') {
      userData.setFbc(options.fbc);
      console.log('Setting fbc:', options.fbc);
    } else {
      console.log('No valid fbc provided');
    }

    // Prepare Contents
    const contents = options.contents
      ? options.contents.map(createContents)
      : [];

    // Prepare Custom Data
    const customData = new CustomData()
      .setCurrency(options.currency || 'INR')
      .setValue(options.value || 0)
      .setOrderId(eventName === 'Purchase' ? options.orderId : null)
      .setContents(contents);

    // Build the Server Event
    const serverEvent = new ServerEvent()
      .setEventName(eventName)
      .setEventTime(currentTimestamp)
      .setUserData(userData)
      .setCustomData(customData)
      .setEventSourceUrl(options.event_source_url || '')
      .setEventId(options.eventID || uuidv4())
      .setActionSource('website');

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
      response: err.response ? err.response.body : null,
    });
    return NextResponse.json(
      { error: 'Failed to send event' },
      { status: 500 }
    );
  }
}
