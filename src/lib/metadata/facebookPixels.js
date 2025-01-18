'use client';
import { v4 as uuidv4 } from 'uuid';
import { getFbp, getFbc } from '@/lib/utils/cookies'; // Import utility functions to get cookies

/**
 * Fetches the client's IP address using the ipify API.
 * @returns {Promise<string>} - The client's IP address or an empty string if an error occurs.
 */
const getClientIp = async () => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error fetching client IP:', error);
    return '';
  }
};

/**
 * Sends event data to the server-side Conversion API endpoint.
 * @param {string} eventName - The name of the event (e.g., 'Purchase', 'AddToCart').
 * @param {object} options - Additional event parameters.
 */
const sendToServer = async (eventName, options) => {
  try {
    const res = await fetch('/api/meta/conversion-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName, options }),
    });
    if (!res.ok) throw new Error(`Server responded with status ${res.status}`);
    await res.json();
  } catch (error) {
    console.error('Error sending event to server:', error);
  }
};

/**
 * Tracks a specific event by sending data to Facebook Pixel and the server-side Conversion API.
 * @param {string} name - The name of the event to track.
 * @param {object} formData - Optional form data (e.g., email, phoneNumber).
 * @param {object} otherOptions - Additional options and parameters for the event.
 */
const trackEvent = async (name, formData = {}, otherOptions = {}) => {
  try {
    const eventId = otherOptions.eventID || uuidv4(); // Allow passing eventID
    const eventTime = Math.floor(Date.now() / 1000);
    const client_ip_address = await getClientIp();
    const client_user_agent = navigator.userAgent;

    // Retrieve fbp and fbc from cookies
    const fbp = getFbp();
    const fbc = getFbc();

    const eventParams = {
      eventID: eventId,
      event_time: eventTime,
      event_name: name,
      action_source: 'website',
      event_source_url: window.location.href,
      client_ip_address,
      client_user_agent,
      fbp, // Include fbp
      fbc, // Include fbc
      ...otherOptions,
    };

    // Include user identifiers if provided
    if (formData.email) {
      eventParams.emails = [formData.email];
    }

    if (formData.phoneNumber) {
      eventParams.phones = [formData.phoneNumber];
    }

    // Send event to Facebook Pixel
    if (window.fbq) {
      window.fbq('track', name, eventParams);
    } else {
      // console.warn('Facebook Pixel is not initialized.');
    }

    // Send event to server-side Conversion API
    await sendToServer(name, eventParams);
  } catch (error) {
    console.error('Error tracking event:', error);
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
      }],
      content_name: product.name, // Use product name
      content_category: product.category, // Use product category object
      content_type: 'product',
    });
  } catch (error) {
    console.error('Error in addToCart function:', error);
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
      })),
    });
  } catch (error) {
    console.error('Error in purchase function:', error);
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
      contents: [{
        id: product.id || product._id,
        item_price: product.price || 0,
      }],
    });
  } catch (error) {
    console.error('Error in viewContent function:', error);
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
      })),
      content_name: checkoutData.contentName, // Should reflect specific product names
      content_category: checkoutData.contentCategory, // Should reflect specific product categories
      content_type: 'product',
      num_items: checkoutData.numItems,
    });
  } catch (error) {
    console.error('Error in initiateCheckout function:', error);
  }
};
