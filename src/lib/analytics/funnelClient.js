'use client';

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a deterministic event ID based on event characteristics
 * This ensures idempotency - same event generates same ID
 */
function generateEventId(step, visitorId, sessionId, timestamp, payload = {}) {
  try {
    // Round timestamp to nearest second for deduplication window
    const roundedTimestamp = Math.floor(timestamp / 1000) * 1000;
    
    // Build deterministic string based on event characteristics
    const parts = [step, visitorId, sessionId, roundedTimestamp];
    
    // Add identifying data based on event type
    if (payload.product?.id) {
      parts.push('p', payload.product.id);
      if (payload.product.quantity) {
        parts.push('q', payload.product.quantity);
      }
    }
    
    if (payload.order?.orderId) {
      parts.push('o', payload.order.orderId);
    }
    
    if (payload.page?.path) {
      parts.push('pg', payload.page.path);
    }
    
    if (payload.metadata?.couponCode) {
      parts.push('c', payload.metadata.couponCode);
    }
    
    // Create hash-like string
    const eventString = parts.join(':');
    
    // Simple hash function for deterministic ID
    let hash = 0;
    for (let i = 0; i < eventString.length; i++) {
      const char = eventString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to positive hex string
    const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
    
    // Return format: step_timestamp_hash
    return `${step}_${roundedTimestamp}_${hashHex}`;
  } catch (error) {
    console.warn('[Funnel] Failed to generate deterministic eventId', error);
    // Fallback to UUID
    return uuidv4();
  }
}

/**
 * Generate event hash for additional deduplication
 */
function generateEventHash(event) {
  try {
    const hashData = {
      step: event.step,
      visitorId: event.visitorId,
      sessionId: event.sessionId,
      productId: event.product?.id,
      orderId: event.order?.orderId,
      pagePath: event.page?.path,
      cartItems: event.cart?.items,
      cartValue: event.cart?.value,
    };
    
    const hashString = JSON.stringify(hashData);
    
    let hash = 0;
    for (let i = 0; i < hashString.length; i++) {
      const char = hashString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(36);
  } catch (error) {
    console.warn('[Funnel] Failed to generate eventHash', error);
    return null;
  }
}

const STORAGE_KEYS = {
  VISITOR: 'maddy_funnel_vid',
  SESSION: 'maddy_funnel_sid',
  SESSION_EXP: 'maddy_funnel_sid_exp',
  BACKUP_QUEUE: 'maddy_funnel_backup_queue',
};

const API_ENDPOINT = '/api/analytics/track-funnel';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes inactivity window
const MAX_BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 4000;
const MAX_QUEUE_SIZE = 150; // Increased from 120
const MAX_BACKUP_QUEUE_SIZE = 50; // Max events to store in localStorage
const DEBUG_PARAM = 'debugFunnel';
const DEDUPE_TTL_MS = SESSION_TTL_MS;
const MAX_FLUSH_RETRIES = 3;

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
    this.flushRetries = 0;
    this.droppedEvents = 0;
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

    // Restore any backed up events from previous session
    this.restoreBackupQueue();

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

    window.addEventListener('beforeunload', () => {
      this.backupQueue();
      this.flush('beforeunload');
    });
    
    window.addEventListener('pagehide', () => {
      this.backupQueue();
      this.flush('pagehide');
    });

    this.refreshDebugFlag();
    this.initialized = true;
    
    if (this.debug) {
      console.info('[Funnel] Client initialized', {
        visitorId: this.visitorId,
        sessionId: this.sessionId,
      });
    }
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

  backupQueue() {
    if (!this.storage || this.queue.length === 0) return;
    
    try {
      // Only backup important events (not visit events to avoid noise)
      const importantEvents = this.queue.filter(event => 
        event.step !== 'visit' && event.step !== 'session_return'
      ).slice(0, MAX_BACKUP_QUEUE_SIZE);
      
      if (importantEvents.length > 0) {
        this.storage.setItem(
          STORAGE_KEYS.BACKUP_QUEUE,
          JSON.stringify(importantEvents)
        );
        if (this.debug) {
          console.info('[Funnel] Backed up queue', {
            count: importantEvents.length,
          });
        }
      }
    } catch (error) {
      console.warn('[Funnel] Failed to backup queue', error);
    }
  }

  restoreBackupQueue() {
    if (!this.storage) return;
    
    try {
      const backup = this.storage.getItem(STORAGE_KEYS.BACKUP_QUEUE);
      if (backup) {
        const events = JSON.parse(backup);
        if (Array.isArray(events) && events.length > 0) {
          // Update session ID for restored events
          const restoredEvents = events.map(event => ({
            ...event,
            sessionId: this.sessionId,
            metadata: {
              ...(event.metadata || {}),
              restored: true,
            },
          }));
          
          this.queue = restoredEvents;
          this.storage.removeItem(STORAGE_KEYS.BACKUP_QUEUE);
          
          if (this.debug) {
            console.info('[Funnel] Restored backup queue', {
              count: restoredEvents.length,
            });
          }
          
          // Schedule immediate flush
          this.scheduleFlush(1000);
        }
      }
    } catch (error) {
      console.warn('[Funnel] Failed to restore backup queue', error);
      // Clear corrupted backup
      try {
        this.storage.removeItem(STORAGE_KEYS.BACKUP_QUEUE);
      } catch (e) {
        // Ignore
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

    // Reduce dedupe window for critical events (5 seconds instead of 30 minutes)
    const criticalSteps = ['add_to_cart', 'apply_offer', 'initiate_checkout', 'payment_initiated', 'purchase'];
    const dedupeWindow = criticalSteps.includes(entry.step) ? 5000 : DEDUPE_TTL_MS;

    if (now - entry.timestamp <= dedupeWindow) {
      if (this.debug) {
        console.info('[Funnel] dedupe skipped event', {
          key,
          step: entry.step,
          sessionId,
          ageMs: now - entry.timestamp,
        });
      }
      return true;
    }

    this.dedupeCache.delete(key);
    return false;
  }

  markDedupe(key, sessionId, step, now = Date.now()) {
    if (!key) return;
    this.dedupeCache.set(key, { sessionId, step, timestamp: now });
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
    
    // Validate step
    if (!step || typeof step !== 'string' || step.trim().length === 0) {
      console.warn('[Funnel] Skipping event due to invalid step', { step, payload });
      return;
    }

    if (this.queue.length >= MAX_QUEUE_SIZE) {
      // Drop the oldest non-critical event to keep memory bounded
      const nonCriticalIndex = this.queue.findIndex(
        e => !['purchase', 'payment_initiated', 'initiate_checkout'].includes(e.step)
      );
      if (nonCriticalIndex !== -1) {
        this.queue.splice(nonCriticalIndex, 1);
        this.droppedEvents++;
      } else {
        this.queue.shift();
        this.droppedEvents++;
      }
      
      if (this.debug) {
        console.warn('[Funnel] Queue overflow, dropped event', {
          totalDropped: this.droppedEvents,
        });
      }
    }

    const timestamp = Date.now();
    const event = {
      step: step.trim(),
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      timestamp,
    };

    const activeUserId = payload.userId || this.userContext.userId;
    if (activeUserId) {
      event.userId = activeUserId;
    }

    // Generate deterministic eventId if not provided
    if (payload.eventId) {
      event.eventId = payload.eventId;
    } else {
      event.eventId = generateEventId(
        event.step,
        this.visitorId,
        this.sessionId,
        timestamp,
        payload
      );
    }
    
    // Generate eventHash for additional deduplication
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
    
    // Generate eventHash after all data is populated
    if (!event.eventHash) {
      event.eventHash = generateEventHash(event);
    }
    
    // Use eventId as primary dedupe key if no explicit dedupeKey provided
    if (!dedupeKey) {
      if (step === 'visit' && event.page?.path) {
        dedupeKey = `visit:${event.page.path}`;
      } else if (step === 'purchase' && event.order?.orderId) {
        dedupeKey = `purchase:${event.order.orderId}`;
      } else if (step === 'payment_initiated' && event.order?.orderId) {
        dedupeKey = `payment:${event.order.orderId}`;
      } else {
        // Use eventId as dedupe key for idempotency
        dedupeKey = event.eventId;
      }
    }

    if (this.debug) {
      try {
        console.info('[Funnel] queued event', {
          step,
          eventId: event.eventId,
          eventHash: event.eventHash,
          dedupeKey,
          page: event.page?.path,
          product: event.product?.id,
          cartItems: event.cart?.items,
          cartValue: event.cart?.value,
          orderId: event.order?.orderId,
          metadata: event.metadata,
          queueSize: this.queue.length,
        });
      } catch (error) {
        console.info('[Funnel] queued event', step);
      }
    }

    // Check dedupe before queueing
    if (dedupeKey && this.shouldSkipDueToDedupe(dedupeKey, event.sessionId, timestamp)) {
      if (this.debug) {
        console.info('[Funnel] Event skipped due to deduplication', {
          step,
          dedupeKey,
          eventId: event.eventId,
        });
      }
      return;
    }

    this.queue.push(event);
    if (dedupeKey) {
      this.markDedupe(dedupeKey, event.sessionId, step, timestamp);
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
          retry: this.flushRetries,
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
    let errorDetails = null;

    try {
      if (navigator.sendBeacon && reason !== 'manual') {
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
        
        if (response.ok) {
          success = true;
          const result = await response.json().catch(() => ({}));
          
          if (result.errors && result.errors.length > 0 && this.debug) {
            console.warn('[Funnel] Server reported errors', {
              errors: result.errors,
              accepted: result.accepted,
              duplicates: result.duplicates,
            });
          }
        } else {
          errorDetails = `HTTP ${response.status}: ${response.statusText}`;
        }
      }
    } catch (error) {
      errorDetails = error?.message || 'Network error';
      console.error('[Funnel] Flush failed', reason, error);
      success = false;
    }

    if (!success) {
      this.flushRetries++;
      
      // Requeue if we haven't exceeded max retries
      if (this.flushRetries < MAX_FLUSH_RETRIES) {
        // Requeue at the front
        this.queue = batch.concat(this.queue);
        this.sending = false;
        
        // Exponential backoff
        const retryDelay = FLUSH_INTERVAL_MS * Math.pow(2, this.flushRetries);
        
        if (this.debug) {
          console.warn('[Funnel] Retrying flush', {
            attempt: this.flushRetries,
            maxRetries: MAX_FLUSH_RETRIES,
            retryDelay,
            error: errorDetails,
          });
        }
        
        this.scheduleFlush(retryDelay);
        return;
      } else {
        // Exceeded max retries, backup to localStorage
        if (this.debug) {
          console.error('[Funnel] Max retries exceeded, backing up events', {
            count: batch.length,
            error: errorDetails,
          });
        }
        
        this.queue = batch.concat(this.queue);
        this.backupQueue();
        this.queue = [];
        this.flushRetries = 0;
      }
    } else {
      // Success - reset retry counter
      this.flushRetries = 0;
      
      if (this.debug) {
        console.info('[Funnel] flush success', {
          reason,
          count: batch.length,
          steps: batch.map((event) => event.step),
        });
      }
    }

    this.sending = false;

    if (this.queue.length > 0) {
      this.scheduleFlush();
    }
  }
}

const funnelClient = new FunnelClient();

export default funnelClient;