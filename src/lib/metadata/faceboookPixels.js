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

const trackEvent = async (name, formData = {}, otherOptions = {}) => {
  try {
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
      ...otherOptions,
    };

    if (window.fbq) {
      window.fbq('track', name, eventParams);
    } else {
      console.warn('Facebook Pixel is not initialized.');
    }

    await sendToServer(name, eventParams);

  } catch (error) {
    console.error('Error tracking event:', error);
  }
};

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
      content_name: `${product.name} ${product.category?.name?.endsWith('s')
        ? product.category?.name.slice(0, -1)
        : product.category?.name}`,
      content_category: product.category,
      content_type: 'product',
    });
  } catch (error) {
    console.error('Error in addToCart function:', error);
  }
};

export const purchase = async (order) => {
  try {
    await trackEvent('Purchase', {}, {
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

export const viewContent = async (product) => {
  try {
    await trackEvent('ViewContent', {}, {
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
