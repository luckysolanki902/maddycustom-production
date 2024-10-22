// @/lib/faceboookPixels.js
import { v4 as uuidv4 } from 'uuid';

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

export const event = async (name, formData = {}, otherOptions = {}) => {
  const eventId = uuidv4();
  const eventTime = Math.floor(Date.now() / 1000);
  const client_ip_address = await getClientIp();
  const client_user_agent = navigator.userAgent;

  const eventParams = {
    eventID: eventId,
    event_time: eventTime,
    event_name: name,
    action_source: 'website',
    event_source_url: window.location.href,
    client_ip_address,
    client_user_agent,
    ...otherOptions, // price, orderId, search_string, content_category ,
  };

  if (formData.customerName) {
    const [first_name, surname] = formData.customerName.split(' ');
    eventParams.first_name = first_name;
    eventParams.surname = surname;
  }

  if (formData.customerMobile) eventParams.phone = formData.customerMobile;
  if (formData.customerCity) eventParams.town = formData.customerCity;
  if (formData.selectedState) eventParams.state = formData.selectedState;
  if (formData.customerPincode) eventParams.pincode = formData.customerPincode;
  if (formData.stickerId) eventParams.productId = formData.stickerId;
  if (otherOptions.productName) eventParams.productName = otherOptions.productName;

  if (name === 'CompleteRegistration' && otherOptions.value) {
    eventParams.currency = otherOptions.currency || 'INR';
    eventParams.orderId = otherOptions.orderId;
    eventParams.quantity = otherOptions.quantity || 1;
  }
  try {
    window.fbq('track', name, eventParams); // Send event to FB Pixel
    await sendToServer(name, eventParams);  // Send to server for Conversions API
    console.log('Event sent successfully:', name);
  } catch (error) {
    console.error('Error sending event to Facebook:', error.message);
    console.error('Event Params:', eventParams);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }}


  const sendToServer = async (eventName, options) => {
    try {
      await fetch('/api/meta/conversion-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventName, options }),
      });
      console.log('Event sent to server:', eventName);
    } catch (error) {
      console.error('Error sending event to server:', error);
    }
  };

  export const pageview = async () => {
    await event('PageView');
  };

  export const completeRegistration = async (formData, price, orderId) => {
    await event('CompleteRegistration', formData, {
      value: price,
      currency: 'INR',
      orderId,
      quantity: 1,
    });
  };

  export const addToCart = async (formData, price) => {
    await event('AddToCart', formData, {
      value: price,
      currency: 'INR',
      quantity: 1,
    });
  };

  export const purchase = async (formData, price, orderId, search_string, productName, content_category) => {
    await event('Purchase', formData, {
      value: price,
      currency: 'INR',
      orderId,
      quantity: 1,
      search_string,
      productName,
      content_category,
    });
  };

  export const contactFbq = async (formData = {}) => {
    await event('Contact', formData);
  };

  export const viewContent = async (formData = {}, otherOptions = {}) => {
    await event('ViewContent', formData, otherOptions);
  };
