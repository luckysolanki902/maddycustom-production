'use client';

import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEYS = {
  VISITOR: 'maddy_funnel_vid',
  SESSION: 'maddy_funnel_sid',
  SESSION_EXP: 'maddy_funnel_sid_exp',
};

const API_ENDPOINT = '/api/analytics/track-funnel';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes inactivity window
const MAX_BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 4000;
const MAX_QUEUE_SIZE = 120;
const DEBUG_PARAM = 'debugFunnel';
const DEDUPE_TTL_MS = SESSION_TTL_MS;

function pruneEmpty(value) {
  if (value === null || value === undefined) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    const cleanedArray = value
      .map((item) => pruneEmpty(item))
      .filter((item) => item !== undefined);
    return cleanedArray.length > 0 ? cleanedArray : undefined;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    const cleaned = {};
    for (const [key, val] of entries) {
      const cleanedValue = pruneEmpty(val);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  return value;
}

function safeLocalStorage() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch (error) {
    console.warn('[Funnel] localStorage unavailable', error);
    return null;
  }
}

function safeSessionStorage() {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage ?? null;
  } catch (error) {
    console.warn('[Funnel] sessionStorage unavailable', error);
    return null;
  }
}

class FunnelClient {
  constructor() {
    this.initialized = false;
    this.visitorId = null;
    this.sessionId = null;
    this.queue = [];
    this.flushTimer = null;
    this.sending = false;
    this.sessionMeta = {};
    this.pageContext = {};
    this.lastActivity = 0;
    this.userContext = {};
    this.debug = false;
    this.dedupeCache = new Map();
  }

  init(additionalMeta = {}) {
    if (this.initialized || typeof window === 'undefined') return;

    this.storage = safeLocalStorage();
    this.sessionStorage = safeSessionStorage();
    this.visitorId = this.restoreVisitorId();
    this.sessionId = this.restoreSessionId();
    this.ensureSession();
    if (!this.visitorId) {
      this.visitorId = uuidv4();
    }
    if (!this.sessionId) {
      this.sessionId = uuidv4();
    }

    this.sessionMeta = {
      ...this.buildDeviceSnapshot(),
      referrer: document.referrer || undefined,
      landingPage: {
        path: window.location.pathname,
        title: document.title,
      },
      ...additionalMeta,
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush('visibility');
      }
    });

    window.addEventListener('beforeunload', () => this.flush('beforeunload'));
    window.addEventListener('pagehide', () => this.flush('pagehide'));

    this.refreshDebugFlag();
    this.initialized = true;
  }

  buildDeviceSnapshot() {
    try {
      const { navigator, screen } = window;
      return {
        device: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          screen: screen
            ? {
                width: screen.width,
                height: screen.height,
              }
            : undefined,
        },
      };
    } catch (error) {
      return {};
    }
  }

  restoreVisitorId() {
    const existing = this.storage?.getItem(STORAGE_KEYS.VISITOR);
    if (existing) return existing;
    const id = uuidv4();
    try {
      this.storage?.setItem(STORAGE_KEYS.VISITOR, id);
    } catch (error) {
      console.warn('[Funnel] Failed to persist visitorId', error);
    }
    return id;
  }

  restoreSessionId() {
    const sid = this.storage?.getItem(STORAGE_KEYS.SESSION);
    const expRaw = this.storage?.getItem(STORAGE_KEYS.SESSION_EXP);
    if (!sid || !expRaw) return null;
    const expiresAt = Number(expRaw);
    if (Number.isFinite(expiresAt) && Date.now() < expiresAt) {
      this.lastActivity = Date.now();
      return sid;
    }
    return null;
  }

  ensureSession() {
    const now = Date.now();
    const previousSession = this.sessionId;
    if (!this.sessionId || now - this.lastActivity > SESSION_TTL_MS) {
      this.sessionId = uuidv4();
    }
    this.lastActivity = now;
    const expiresAt = String(now + SESSION_TTL_MS);
    try {
      this.storage?.setItem(STORAGE_KEYS.SESSION, this.sessionId);
      this.storage?.setItem(STORAGE_KEYS.SESSION_EXP, expiresAt);
    } catch (error) {
      console.warn('[Funnel] Failed to persist session', error);
    }

    if (previousSession && previousSession !== this.sessionId) {
      this.dedupeCache.clear();
    }
  }

  computeDebugFlag() {
    const isDev = process.env.NODE_ENV !== 'production';
    if (typeof window === 'undefined') {
      return isDev;
    }
    try {
      const params = new URLSearchParams(window.location.search);
      return isDev || params.has(DEBUG_PARAM);
    } catch (error) {
      console.warn('[Funnel] Debug flag evaluation failed', error);
      return isDev;
    }
  }

  refreshDebugFlag() {
    this.debug = this.computeDebugFlag();
  }

  pruneDedupeCache(now = Date.now()) {
    for (const [key, entry] of this.dedupeCache.entries()) {
      if (!entry || now - entry.timestamp > DEDUPE_TTL_MS) {
        this.dedupeCache.delete(key);
      }
    }
  }

  shouldSkipDueToDedupe(key, sessionId, now = Date.now()) {
    if (!key) return false;
    const entry = this.dedupeCache.get(key);
    if (!entry) return false;

    if (entry.sessionId !== sessionId) {
      if (now - entry.timestamp > DEDUPE_TTL_MS) {
        this.dedupeCache.delete(key);
      }
      return false;
    }

    if (now - entry.timestamp <= DEDUPE_TTL_MS) {
      if (this.debug) {
        console.info('[Funnel] dedupe skipped event', {
          key,
          sessionId,
          ageMs: now - entry.timestamp,
        });
      }
      return true;
    }

    this.dedupeCache.delete(key);
    return false;
  }

  markDedupe(key, sessionId, now = Date.now()) {
    if (!key) return;
    this.dedupeCache.set(key, { sessionId, timestamp: now });
    if (this.dedupeCache.size > 200) {
      this.pruneDedupeCache(now);
    }
  }

  updateSession(patch = {}) {
    if (patch && typeof patch === 'object') {
      this.sessionMeta = {
        ...this.sessionMeta,
        ...patch,
        utm: patch.utm || this.sessionMeta.utm,
        utmHistory: patch.utmHistory || this.sessionMeta.utmHistory,
        device: patch.device || this.sessionMeta.device,
        geo: patch.geo || this.sessionMeta.geo,
        landingPage: patch.landingPage || this.sessionMeta.landingPage,
        flags: {
          ...this.sessionMeta.flags,
          ...(patch.flags || {}),
        },
      };
    }
  }

  setPageContext(context = {}) {
    this.pageContext = {
      ...this.pageContext,
      ...context,
      page: {
        ...(this.pageContext.page || {}),
        ...(context.page || {}),
      },
      metadata: {
        ...(this.pageContext.metadata || {}),
        ...(context.metadata || {}),
      },
    };
  }

  identifyUser(user = {}) {
    if (typeof window === 'undefined') return;
    if (!this.initialized) {
      this.init();
    }

    const cleaned = {};
    if (user.userId && typeof user.userId === 'string') {
      cleaned.userId = user.userId;
    }
    if (user.phoneNumber && typeof user.phoneNumber === 'string') {
      cleaned.phoneNumber = user.phoneNumber.trim();
    }
    if (user.email && typeof user.email === 'string') {
      cleaned.email = user.email.trim();
    }
    if (user.name && typeof user.name === 'string') {
      cleaned.name = user.name.trim();
    }

    this.userContext = {
      ...this.userContext,
      ...cleaned,
    };

    if (cleaned.userId) {
      this.updateSession({ userId: cleaned.userId });
    }
  }

  getIdentifiers() {
    if (typeof window === 'undefined') {
      return { visitorId: null, sessionId: null };
    }
    if (!this.initialized) {
      this.init();
    }
    this.ensureSession();
    return {
      visitorId: this.visitorId,
      sessionId: this.sessionId,
    };
  }

  onRouteChange(pathname) {
    if (!pathname || typeof window === 'undefined') return;
    const page = {
      path: pathname,
      title: document.title,
    };
    this.setPageContext({ page });
  }

  track(step, payload = {}) {
    if (typeof window === 'undefined') return;
    if (!this.initialized) {
      this.init();
    }

    this.refreshDebugFlag();

    this.ensureSession();
    if (!this.visitorId) {
      this.visitorId = uuidv4();
    }
    if (!this.sessionId) {
      this.sessionId = uuidv4();
    }
    if (!this.visitorId || !this.sessionId) {
      console.warn('[Funnel] Skipping event due to missing identifiers', { step, payload });
      return;
    }

    if (this.queue.length >= MAX_QUEUE_SIZE) {
      // Drop the oldest event to keep memory bounded
      this.queue.shift();
    }

    const timestamp = Date.now();
    const event = {
      step,
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      timestamp,
    };

    const activeUserId = payload.userId || this.userContext.userId;
    if (activeUserId) {
      event.userId = activeUserId;
    }

    if (payload.eventId) {
      event.eventId = payload.eventId;
    }
    if (payload.eventHash) {
      event.eventHash = payload.eventHash;
    }

    const page = pruneEmpty(payload.page || this.pageContext.page);
    if (page) event.page = page;

    const product = pruneEmpty(payload.product);
    if (product) event.product = product;

    const cart = pruneEmpty(payload.cart);
    if (cart) event.cart = cart;

    const order = pruneEmpty(payload.order);
    if (order) event.order = order;

    const utm = pruneEmpty(payload.utm || this.sessionMeta.utm);
    if (utm) event.utm = utm;

    let metadata = {
      ...(this.pageContext.metadata || {}),
      ...(payload.metadata || {}),
    };

    let dedupeKey = payload.dedupeKey;
    if (!dedupeKey && metadata && Object.prototype.hasOwnProperty.call(metadata, 'dedupeKey')) {
      dedupeKey = metadata.dedupeKey;
      metadata = { ...metadata };
      delete metadata.dedupeKey;
    }

    if (Object.keys(this.userContext).length > 0) {
      metadata.user = {
        ...(metadata.user || {}),
        ...this.userContext,
      };
    }
    const cleanedMetadata = pruneEmpty(metadata);
    if (cleanedMetadata) {
      event.metadata = cleanedMetadata;
    }

    const session = pruneEmpty({
      ...this.sessionMeta,
      ...(payload.session || {}),
    });
    if (session) {
      event.session = session;
    }

    if (this.debug) {
      try {
        console.info('[Funnel] queued event', {
          step,
          page: event.page?.path,
          product: event.product?.id,
          cartItems: event.cart?.items,
          cartValue: event.cart?.value,
          orderId: event.order?.orderId,
          metadata: event.metadata,
        });
      } catch (error) {
        console.info('[Funnel] queued event', step);
      }
    }

    if (!dedupeKey && step === 'visit') {
      dedupeKey = `visit:${event.page?.path || 'unknown'}`;
    }

    if (dedupeKey && this.shouldSkipDueToDedupe(dedupeKey, event.sessionId, timestamp)) {
      return;
    }

    this.queue.push(event);
    if (dedupeKey) {
      this.markDedupe(dedupeKey, event.sessionId, timestamp);
    }
    if (this.queue.length >= MAX_BATCH_SIZE) {
      this.flush('batch');
    } else {
      this.scheduleFlush();
    }
  }

  scheduleFlush(delay = FLUSH_INTERVAL_MS) {
    if (this.flushTimer) return;
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      this.flush('timer');
    }, delay);
  }

  async flush(reason = 'manual') {
    if (this.sending || this.queue.length === 0) return;
    this.sending = true;

    const rawBatch = this.queue.splice(0, MAX_BATCH_SIZE);
    const batch = rawBatch.filter((event) => {
      const hasIds = typeof event?.visitorId === 'string' && event.visitorId.length > 0 && typeof event?.sessionId === 'string' && event.sessionId.length > 0;
      const hasStep = typeof event?.step === 'string' && event.step.length > 0;
      if (!hasIds || !hasStep) {
        console.warn('[Funnel] Dropping invalid event before flush', { event, reason });
        return false;
      }
      return true;
    });

    if (batch.length === 0) {
      this.sending = false;
      if (rawBatch.length > 0) {
        this.scheduleFlush();
      }
      return;
    }

    if (this.debug) {
      try {
        console.info('[Funnel] flushing events', {
          reason,
          count: batch.length,
          steps: batch.map((event) => event.step),
        });
      } catch (error) {
        console.info('[Funnel] flush debug failed', error);
      }
    } else if (process.env.NODE_ENV !== 'production') {
      try {
        console.debug('[Funnel] Flushing events', {
          reason,
          count: batch.length,
          sample: batch[0],
        });
      } catch (error) {
        console.debug('[Funnel] Flush debug failed', error);
      }
    }

    const payload = JSON.stringify({ events: batch });
    let success = false;

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        success = navigator.sendBeacon(API_ENDPOINT, blob);
      }

      if (!success) {
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: payload,
          keepalive: true,
        });
        success = response.ok;
      }
    } catch (error) {
      console.error('[Funnel] Flush failed', reason, error);
      success = false;
    }

    if (!success) {
      // Requeue the events at the front so they are retried later
      this.queue = batch.concat(this.queue);
      this.sending = false;
      this.scheduleFlush(FLUSH_INTERVAL_MS * 2);
      return;
    }

    if (this.debug) {
      console.info('[Funnel] flush success', {
        reason,
        count: batch.length,
        steps: batch.map((event) => event.step),
      });
    }

    this.sending = false;

    if (this.queue.length > 0) {
      this.scheduleFlush();
    }
  }
}

const funnelClient = new FunnelClient();

export default funnelClient;