import {
  FacebookAdsApi,
  ServerEvent,
  UserData,
  CustomData,
  EventRequest,
  Content,
} from 'facebook-nodejs-business-sdk';
import crypto from 'crypto';

const pixel_id = '887502090050413'; // Hardcoded in original file, keeping it same

// Lazy initialization of Facebook API
let isInitialized = false;
const initializeFacebookAPI = () => {
  if (!isInitialized && process.env.FB_PIXEL_ACCESS_TOKEN) {
    FacebookAdsApi.init(process.env.FB_PIXEL_ACCESS_TOKEN);
    isInitialized = true;
  }
};

const hashData = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Normalizes phone number for Meta Conversions API
 * 
 * CRITICAL: Ensures consistent phone number formatting to prevent
 * the "duplicate client phone numbers" error from Meta.
 * 
 * Meta requires: digits only with country code (e.g., "919876543210" for India)
 * 
 * @param {string} phone - The phone number to normalize
 * @returns {string} - The normalized phone number (digits only with country code)
 */
const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Convert to string and remove all non-digit characters
  let digitsOnly = String(phone).replace(/\D/g, '');
  
  if (!digitsOnly) return '';
  
  // Handle Indian phone numbers (most common case)
  if (digitsOnly.length === 10) {
    // Assume Indian number without country code - add 91
    digitsOnly = '91' + digitsOnly;
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    // Already has Indian country code - good
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    // Starts with 0 (local format) - remove 0 and add country code
    digitsOnly = '91' + digitsOnly.substring(1);
  } else if (digitsOnly.length > 12 && digitsOnly.startsWith('91')) {
    // Too many digits - extract last 10 and prepend 91
    digitsOnly = '91' + digitsOnly.slice(-10);
  } else if (digitsOnly.length > 10 && digitsOnly.length < 12) {
    // Has partial country code - extract 10 digit number
    digitsOnly = '91' + digitsOnly.slice(-10);
  }
  
  return digitsOnly;
};

export const sendPurchaseEvent = async (order, analyticsInfo = {}) => {
  // Disabled - Facebook tracking turned off
  return;

  const access_token = process.env.FB_PIXEL_ACCESS_TOKEN;
  if (!access_token) {
    console.error('FB_PIXEL_ACCESS_TOKEN is not defined');
    return;
  }

  // Initialize Facebook API
  initializeFacebookAPI();

  try {
    const { fbp, fbc, userAgent, ip } = analyticsInfo;
    const eventId = order._id.toString();
    const currentTimestamp = Math.floor(Date.now() / 1000);

    const userData = new UserData()
      .setClientIpAddress(ip || '')
      .setClientUserAgent(userAgent || '');

    if (fbp) userData.setFbp(fbp);
    if (fbc) userData.setFbc(fbc);

    // User details from order
    if (order.user && typeof order.user === 'object') {
        if (order.user.email) {
            userData.setEmails([hashData(order.user.email.trim().toLowerCase())]);
        }
        if (order.user.phoneNumber && !order.address?.receiverPhoneNumber) {
             const phone = normalizePhoneNumber(order.user.phoneNumber);
             userData.setPhones([hashData(phone)]);
        }
    }

    if (order.address) {
        if (order.address.receiverPhoneNumber) {
            const phone = normalizePhoneNumber(order.address.receiverPhoneNumber);
            userData.setPhones([hashData(phone)]);
        }
        if (order.address.city) {
            userData.setCity(hashData(order.address.city.trim().toLowerCase()));
        }
        if (order.address.state) {
            userData.setState(hashData(order.address.state.trim().toLowerCase()));
        }
        if (order.address.pincode) {
            userData.setZip(hashData(order.address.pincode.trim()));
        }
        if (order.address.country) {
            userData.setCountry(hashData(order.address.country.trim().toLowerCase()));
        }
        // We don't have email in address usually, but maybe in user
    }

    const contents = order.items.map(item => {
      return new Content()
        .setId(item.product ? item.product.toString() : item._id.toString())
        .setQuantity(item.quantity)
        .setItemPrice(item.priceAtPurchase)
        .setTitle(item.name);
    });

    const customData = new CustomData()
      .setCurrency('INR')
      .setValue(order.totalAmount)
      .setContents(contents)
      .setOrderId(order._id.toString())
      .setContentType('product');

    const serverEvent = new ServerEvent()
      .setEventName('Purchase')
      .setEventTime(currentTimestamp)
      .setUserData(userData)
      .setCustomData(customData)
      .setEventId(eventId)
      .setActionSource('website');

    const eventRequest = new EventRequest(access_token, pixel_id).setEvents([serverEvent]);

    const response = await eventRequest.execute();
    console.log(`[Meta CAPI] Purchase event sent for order ${order._id}`, response);
    return response;

  } catch (error) {
    console.error('[Meta CAPI] Failed to send Purchase event:', error);
  }
};
