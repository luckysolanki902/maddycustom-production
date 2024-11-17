import { v4 as uuidv4 } from 'uuid';
import { FacebookAdsApi, ServerEvent, UserData, CustomData, EventRequest, Content } from 'facebook-nodejs-business-sdk';
import { NextResponse } from 'next/server';

const access_token = process.env.FB_PIXEL_ACCESS_TOKEN;
const pixel_id = '887502090050413';

FacebookAdsApi.init(access_token);

const createContents = (product) => {
  return new Content()
    .setId(product.id || product._id)
    .setQuantity(product.quantity || 1)
    .setItemPrice(product.item_price || 0);
};

export async function POST(request) {
  try {
    const { eventName, options = {} } = await request.json();
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const validEvents = ['Purchase', 'AddToCart', 'ViewContent'];
    if (!validEvents.includes(eventName)) {
      return NextResponse.json({ message: 'Invalid event type.' }, { status: 200 });
    }

    const userData = new UserData()
      .setEmails(options.emails || [])
      .setPhones(options.phones || [])
      .setClientIpAddress(options.client_ip_address || '')
      .setClientUserAgent(options.client_user_agent || '');

    const contents = options.contents ? options.contents.map(createContents) : [];

    const customData = new CustomData()
      .setCurrency(options.currency || 'INR')
      .setValue(options.value || 0)
      .setOrderId(eventName === 'Purchase' ? options.orderId : null)
      .setContents(contents);

    const serverEvent = new ServerEvent()
      .setEventName(eventName)
      .setEventTime(currentTimestamp)
      .setUserData(userData)
      .setCustomData(customData)
      .setEventSourceUrl(options.event_source_url || '')
      .setEventId(options.eventID || uuidv4())
      .setActionSource('website');

    const eventRequest = new EventRequest(access_token, pixel_id).setEvents([serverEvent]);

    const response = await eventRequest.execute();
    return NextResponse.json({ message: 'Event sent successfully', response }, { status: 200 });
  } catch (err) {
    console.error('Error sending event to Facebook:', err);
    return NextResponse.json({ error: 'Failed to send event' }, { status: 500 });
  }
}
