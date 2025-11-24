import {
  FacebookAdsApi,
  ServerEvent,
  UserData,
  CustomData,
  EventRequest,
  Content,
} from 'facebook-nodejs-business-sdk';
import crypto from 'crypto';

const access_token = process.env.FB_PIXEL_ACCESS_TOKEN;
const pixel_id = '887502090050413'; // Hardcoded in original file, keeping it same

if (access_token) {
  FacebookAdsApi.init(access_token);
}

const hashData = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  let normalized = phone.replace(/[^\d+]/g, '');
  if (normalized.startsWith('+')) {
    const parts = normalized.split('');
    let countryCode = '+';
    let i = 1;
    while (i < parts.length && i <= 4) {
      countryCode += parts[i];
      i++;
    }
    let number = parts.slice(i).join('').replace(/^0+/, '');
    normalized = countryCode + number;
  } else {
    normalized = normalized.replace(/^0+/, '');
  }
  return normalized;
};

export const sendPurchaseEvent = async (order, analyticsInfo = {}) => {
  if (!access_token) {
    console.error('FB_PIXEL_ACCESS_TOKEN is not defined');
    return;
  }

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
