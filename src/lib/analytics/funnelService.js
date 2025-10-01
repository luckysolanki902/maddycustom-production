import mongoose from 'mongoose';
import { z } from 'zod';
import FunnelSession from '@/models/analytics/FunnelSession';
import FunnelEvent from '@/models/analytics/FunnelEvent';
import { PAGE_CATEGORY_VALUES } from './pageClassifier';

const STEP_MAP = {
  visit: 'visit',
  pageview: 'visit',
  view: 'visit',
  view_product: 'view_product',
  viewproduct: 'view_product',
  product_view: 'view_product',
  add_to_cart: 'add_to_cart',
  addtocart: 'add_to_cart',
  cart_add: 'add_to_cart',
  apply_offer: 'apply_offer',
  offer_applied: 'apply_offer',
  coupon_applied: 'apply_offer',
  apply_coupon: 'apply_offer',
  view_cart_drawer: 'view_cart_drawer',
  cart_drawer_open: 'view_cart_drawer',
  open_cart: 'view_cart_drawer',
  open_order_form: 'open_order_form',
  order_form_open: 'open_order_form',
  orderformopen: 'open_order_form',
  address_tab_open: 'address_tab_open',
  addresstabopen: 'address_tab_open',
  initiate_checkout: 'initiate_checkout',
  checkout_start: 'initiate_checkout',
  checkoutstart: 'initiate_checkout',
  contact_info: 'contact_info',
  contactinfoprovided: 'contact_info',
  contactinfostep: 'contact_info',
  payment_initiated: 'payment_initiated',
  paymentinitiated: 'payment_initiated',
  purchase: 'purchase',
  order_complete: 'purchase',
  session_return: 'session_return',
  revisit: 'session_return',
};

const STEP_ENUM = [
  'visit',
  'view_product',
  'add_to_cart',
  'apply_offer',
  'view_cart_drawer',
  'open_order_form',
  'address_tab_open',
  'initiate_checkout',
  'contact_info',
  'payment_initiated',
  'purchase',
  'session_return',
];

const NumberSchema = z
  .number()
  .finite()
  .optional();

const PageSchema = z
  .object({
    path: z.string().trim().optional(),
    name: z.string().trim().optional(),
  pageCategory: z.enum(PAGE_CATEGORY_VALUES).optional(),
    category: z.string().trim().optional(),
    slug: z.string().trim().optional(),
    title: z.string().trim().optional(),
    referringPath: z.string().trim().optional(),
  })
  .partial()
  .optional();

const ProductSchema = z
  .object({
    id: z.string().trim().optional(),
    name: z.string().trim().optional(),
    price: NumberSchema,
    quantity: NumberSchema,
    variantId: z.string().trim().optional(),
    brand: z.string().trim().optional(),
    category: z.string().trim().optional(),
  })
  .partial()
  .optional();

const CartSchema = z
  .object({
    items: NumberSchema,
    value: NumberSchema,
    currency: z.string().trim().optional(),
  })
  .partial()
  .optional();

const OrderSchema = z
  .object({
    orderId: z.string().trim().optional(),
    value: NumberSchema,
    coupon: z.string().trim().optional(),
    currency: z.string().trim().optional(),
  })
  .partial()
  .optional();

const UTMschema = z
  .object({
    source: z.string().trim().optional(),
    medium: z.string().trim().optional(),
    campaign: z.string().trim().optional(),
    term: z.string().trim().optional(),
    content: z.string().trim().optional(),
    fbc: z.string().trim().optional(),
    pathname: z.string().trim().optional(),
    queryParams: z.record(z.any()).optional(),
  })
  .partial()
  .optional();

const DeviceSchema = z
  .object({
    userAgent: z.string().trim().optional(),
    platform: z.string().trim().optional(),
    language: z.string().trim().optional(),
    screen: z
      .object({ width: NumberSchema, height: NumberSchema })
      .partial()
      .optional(),
  })
  .partial()
  .optional();

const GeoSchema = z
  .object({
    city: z.string().trim().optional(),
    region: z.string().trim().optional(),
    country: z.string().trim().optional(),
    timezone: z.string().trim().optional(),
  })
  .partial()
  .optional();

const FlagsSchema = z
  .object({
    isReturning: z.boolean().optional(),
    isFromAd: z.boolean().optional(),
  })
  .partial()
  .optional();

const SessionMetaSchema = z
  .object({
    utm: UTMschema,
    referrer: z.string().trim().optional(),
    landingPage: PageSchema,
    device: DeviceSchema,
    geo: GeoSchema,
    flags: FlagsSchema,
  })
  .partial()
  .optional();

const EventSchema = z.object({
  visitorId: z.string().min(1),
  sessionId: z.string().min(1),
  userId: z.string().min(1).optional(),
  step: z.string().min(1),
  timestamp: z.union([z.string(), z.number(), z.date()]).optional(),
  eventId: z.string().trim().max(128).optional(),
  eventHash: z.string().trim().max(256).optional(),
  page: PageSchema,
  product: ProductSchema,
  cart: CartSchema,
  order: OrderSchema,
  utm: UTMschema,
  metadata: z.record(z.any()).optional(),
  session: SessionMetaSchema,
});

const EventsPayloadSchema = z.object({
  events: z.array(EventSchema).min(1).max(50),
});

function normalizeStep(step) {
  if (!step) return 'visit';
  const normalized = step.toString().toLowerCase().replace(/[^a-z]/g, '_');
  return STEP_MAP[normalized] || STEP_MAP[normalized.replace(/_+/g, '_')] || STEP_MAP[step] || 'visit';
}

function coerceDate(value) {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const numeric = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isNaN(numeric)) {
    const dateFromNumber = new Date(numeric);
    if (!Number.isNaN(dateFromNumber.getTime())) return dateFromNumber;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function cleanObject(obj) {
  if (!obj || typeof obj !== 'object') return undefined;
  const cleaned = Array.isArray(obj) ? [] : {};
  const entries = Object.entries(obj);

  entries.forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) return;
      cleaned[key] = trimmed;
      return;
    }
    if (typeof value === 'object') {
      const nested = cleanObject(value);
      if (nested !== undefined && (Array.isArray(nested) ? nested.length > 0 : Object.keys(nested).length > 0)) {
        cleaned[key] = nested;
      }
      return;
    }
    cleaned[key] = value;
  });

  if (Array.isArray(cleaned)) {
    return cleaned.length > 0 ? cleaned : undefined;
  }

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function toObjectId(id) {
  if (!id) return undefined;
  try {
    return new mongoose.Types.ObjectId(id);
  } catch (error) {
    return undefined;
  }
}

function normalizeString(value) {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  return str.length > 0 ? str : undefined;
}

async function upsertSession(event, timestamp) {
  const filter = { visitorId: event.visitorId, sessionId: event.sessionId };

  const setOnInsert = {
    visitorId: event.visitorId,
    sessionId: event.sessionId,
    firstActivityAt: timestamp,
  };

  if (event.session?.utm || event.utm) {
    setOnInsert.utm = cleanObject(event.session?.utm ?? event.utm);
  }
  if (event.session?.referrer) {
    setOnInsert.referrer = event.session.referrer;
  }
  const deviceSnapshot = event.session?.device ? cleanObject(event.session.device) : undefined;
  const geoSnapshot = event.session?.geo ? cleanObject(event.session.geo) : undefined;

  const update = {
    $setOnInsert: setOnInsert,
    $set: { lastActivityAt: timestamp },
  };

  if (event.session?.utm?.override === true) {
    update.$set.utm = cleanObject(event.session.utm);
  }
  if (event.utm && !update.$set.utm && !setOnInsert.utm) {
    update.$set.utm = cleanObject(event.utm);
  }
  if (deviceSnapshot) {
    update.$set.device = deviceSnapshot;
  }
  if (geoSnapshot) {
    update.$set.geo = geoSnapshot;
  }
  if (event.session?.landingPage) {
    const landingPage = cleanObject(event.session.landingPage);
    if (landingPage) {
      update.$set.landingPage = landingPage;
    }
  }
  if (event.session?.flags) {
    update.$set['flags.isReturning'] = event.session.flags.isReturning === true;
    if (typeof event.session.flags.isFromAd === 'boolean') {
      update.$set['flags.isFromAd'] = event.session.flags.isFromAd;
    }
  }
  if (event.referrer) {
    update.$set.referrer = event.referrer;
  }

  if (event.userId) {
    const userId = toObjectId(event.userId);
    if (userId) {
      update.$set.userId = userId;
    }
  }

  if (event.step === 'session_return') {
    update.$inc = { revisits: 1 };
  }

  const sessionDoc = await FunnelSession.findOneAndUpdate(filter, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });

  return sessionDoc;
}

async function persistEvent(event, sessionDoc, timestamp) {
  const payload = {
    session: sessionDoc._id,
    visitorId: event.visitorId,
    sessionId: event.sessionId,
    step: event.step,
    timestamp,
    metadata: cleanObject(event.metadata) ?? {},
  };

  const userId = toObjectId(event.userId);
  if (userId) {
    payload.userId = userId;
  }
  if (event.eventId) {
    payload.eventId = event.eventId;
  }
  if (event.eventHash) {
    payload.eventHash = event.eventHash;
  }

  const page = cleanObject(event.page);
  if (page) payload.page = page;

  const product = cleanObject(event.product);
  if (product) payload.product = product;

  const cart = cleanObject(event.cart);
  if (cart) payload.cart = cart;

  const order = cleanObject(event.order);
  if (order) payload.order = order;

  const utm = cleanObject(event.utm ?? event.session?.utm);
  if (utm) payload.utm = utm;

  try {
    // Check for existing event with same eventId (stronger idempotency check)
    if (payload.eventId) {
      const existingEvent = await FunnelEvent.findOne({
        sessionId: payload.sessionId,
        step: payload.step,
        eventId: payload.eventId,
      }).select('_id').lean();
      
      if (existingEvent) {
        if (process.env.NODE_ENV !== 'production') {
          console.info('[Funnel] Duplicate detected by eventId lookup', {
            eventId: payload.eventId,
            step: payload.step,
            sessionId: payload.sessionId,
          });
        }
        return { ok: false, code: 'duplicate', reason: 'Duplicate eventId detected' };
      }
    }
    
    // Additional check for critical events by content hash
    if (payload.eventHash && ['purchase', 'payment_initiated'].includes(payload.step)) {
      const existingByHash = await FunnelEvent.findOne({
        sessionId: payload.sessionId,
        step: payload.step,
        eventHash: payload.eventHash,
      }).select('_id').lean();
      
      if (existingByHash) {
        if (process.env.NODE_ENV !== 'production') {
          console.info('[Funnel] Duplicate detected by eventHash lookup', {
            eventHash: payload.eventHash,
            step: payload.step,
            sessionId: payload.sessionId,
          });
        }
        return { ok: false, code: 'duplicate', reason: 'Duplicate eventHash detected' };
      }
    }
    
    const doc = new FunnelEvent(payload);
    await doc.save();
    return { ok: true };
  } catch (error) {
    if (error?.code === 11000) {
      // Duplicate event caught by unique index
      if (process.env.NODE_ENV !== 'production') {
        console.info('[Funnel] Duplicate caught by unique index', {
          eventId: payload.eventId,
          step: payload.step,
          error: error.message,
        });
      }
      return { ok: false, code: 'duplicate', reason: 'Duplicate event skipped by index' };
    }
    throw error;
  }
}

export async function saveFunnelEvents(rawEvents = []) {
  const outcome = {
    accepted: 0,
    duplicates: 0,
    errors: [],
  };

  if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
    return outcome;
  }

  for (const rawEvent of rawEvents) {
    try {
      const parsed = EventSchema.parse(rawEvent);
      const step = normalizeStep(parsed.step);
      if (!STEP_ENUM.includes(step)) {
        outcome.errors.push({
          event: rawEvent,
          reason: `Unsupported step: ${parsed.step}`,
        });
        continue;
      }

      const timestamp = coerceDate(parsed.timestamp);
      const enrichedEvent = {
        ...parsed,
        step,
      };

      const sessionDoc = await upsertSession(enrichedEvent, timestamp);
      
      if (!sessionDoc || !sessionDoc._id) {
        outcome.errors.push({
          event: rawEvent,
          reason: 'Failed to create or retrieve session',
        });
        console.error('[Funnel] Session upsert failed', {
          visitorId: enrichedEvent.visitorId,
          sessionId: enrichedEvent.sessionId,
        });
        continue;
      }
      
      const result = await persistEvent(enrichedEvent, sessionDoc, timestamp);

      if (result.ok) {
        outcome.accepted += 1;
        if (process.env.NODE_ENV !== 'production') {
          console.info('[Funnel] Stored event', {
            step,
            visitorId: parsed.visitorId,
            sessionId: parsed.sessionId,
            timestamp: timestamp.toISOString(),
          });
        }
      } else if (result.code === 'duplicate') {
        outcome.duplicates += 1;
        if (process.env.NODE_ENV !== 'production') {
          console.info('[Funnel] Duplicate event skipped', {
            step,
            visitorId: parsed.visitorId,
            sessionId: parsed.sessionId,
            eventId: parsed.eventId,
          });
        }
      } else {
        outcome.errors.push({
          event: rawEvent,
          reason: result.reason || 'Unknown persistence error',
        });
        console.error('[Funnel] Event persistence failed', {
          step,
          code: result.code,
          reason: result.reason,
        });
      }
    } catch (error) {
      console.error('[Funnel] Failed to persist event', error);
      outcome.errors.push({
        event: rawEvent,
        reason: error?.message || 'Unhandled error',
      });
    }
  }

  return outcome;
}

export function validateEventsPayload(payload) {
  return EventsPayloadSchema.safeParse(payload);
}

export async function attachUserToFunnel({
  visitorId,
  sessionId,
  userId,
  phoneNumber,
  email,
  name,
} = {}) {
  const normalizedVisitorId = normalizeString(visitorId);
  if (!normalizedVisitorId) {
    return { matchedSessions: 0, updatedSessions: 0, matchedEvents: 0, updatedEvents: 0 };
  }

  const normalizedSessionId = normalizeString(sessionId);
  const normalizedPhone = normalizeString(phoneNumber);
  const normalizedEmail = normalizeString(email);
  const normalizedName = normalizeString(name);
  const userObjectId = toObjectId(userId);

  const sessionFilter = { visitorId: normalizedVisitorId };
  if (normalizedSessionId) {
    sessionFilter.sessionId = normalizedSessionId;
  }

  const sessionSet = {};
  if (userObjectId) {
    sessionSet.userId = userObjectId;
  }
  if (normalizedPhone) {
    sessionSet['metadata.contact.phoneNumber'] = normalizedPhone;
  }
  if (normalizedEmail) {
    sessionSet['metadata.contact.email'] = normalizedEmail;
  }
  if (normalizedName) {
    sessionSet['metadata.contact.name'] = normalizedName;
  }
  if (Object.keys(sessionSet).length > 0) {
    sessionSet['metadata.lastLinkedAt'] = new Date();
  }

  let sessionResult = { matchedCount: 0, modifiedCount: 0 };
  if (Object.keys(sessionSet).length > 0) {
    sessionResult = await FunnelSession.updateMany(sessionFilter, { $set: sessionSet });
  }

  const eventFilter = { visitorId: normalizedVisitorId };
  if (normalizedSessionId) {
    eventFilter.sessionId = normalizedSessionId;
  }

  const eventSet = {};
  if (userObjectId) {
    eventSet.userId = userObjectId;
  }
  if (normalizedPhone) {
    eventSet['metadata.contact.phoneNumber'] = normalizedPhone;
  }
  if (normalizedEmail) {
    eventSet['metadata.contact.email'] = normalizedEmail;
  }
  if (normalizedName) {
    eventSet['metadata.contact.name'] = normalizedName;
  }

  let eventResult = { matchedCount: 0, modifiedCount: 0 };
  if (Object.keys(eventSet).length > 0) {
    eventResult = await FunnelEvent.updateMany(eventFilter, { $set: eventSet });
  }

  return {
    matchedSessions: sessionResult.matchedCount || 0,
    updatedSessions: sessionResult.modifiedCount || 0,
    matchedEvents: eventResult.matchedCount || 0,
    updatedEvents: eventResult.modifiedCount || 0,
  };
}
