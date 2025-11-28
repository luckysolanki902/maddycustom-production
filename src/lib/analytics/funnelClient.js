'use client';

import { v4 as uuidv4 } from 'uuid';
import classifyPage from './pageClassifier';

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

const CRITICAL_STEPS = new Set([
  'visit',
  'add_to_cart',
  'remove_from_cart',
  'apply_offer',
  'view_cart_drawer',
  'open_order_form',
  'address_tab_open',
  'contact_info', 
  'reach_payment_tab',
  'payment_initiated',
  'purchase',
  'session_return',
]);

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
    return null;
  }
}

function safeSessionStorage() {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage ?? null;
  } catch (error) {
    return null;
  }
}

function isApiPath(path) {
  if (!path || typeof path !== 'string') return false;
  const trimmed = path.trim();
  if (!trimmed) return false;
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return /^\/api(?:\/|$)/.test(normalized);
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
    this.pendingVisitTimer = null;
    this.pendingVisitPath = null;
    this.pendingVisitMetadata = null;
    this.lastTrackedPath = null;
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

    const landingPath = window.location.pathname || '/';
    const landingIsApi = isApiPath(landingPath);
    const landingClassification = landingIsApi ? null : classifyPage(landingPath);

    this.sessionMeta = {
      ...this.buildDeviceSnapshot(),
      referrer: document.referrer || undefined,
      landingPage: landingIsApi
        ? undefined
        : {
            path: landingPath,
            title: document.title,
            name: landingClassification.pageName,
            pageCategory: landingClassification.pageCategory,
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
      // Failed to persist visitorId
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

  resetPageContext() {
    this.pageContext = {};
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
      // Failed to persist session
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
      }
    } catch (error) {
      // Failed to backup queue
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
          
          // Schedule immediate flush
          this.scheduleFlush(1000);
        }
      }
    } catch (error) {
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
    if (!context || typeof context !== 'object') {
      return;
    }

    if (!this.pageContext || typeof this.pageContext !== 'object') {
      this.pageContext = {};
    }

    if (context.page) {
      this.pageContext.page = {
        ...(this.pageContext.page || {}),
        ...context.page,
      };
    }

    if (context.metadata) {
      this.pageContext.metadata = {
        ...(this.pageContext.metadata || {}),
        ...context.metadata,
      };
    }

    if (context.product) {
      this.pageContext.product = {
        ...(this.pageContext.product || {}),
        ...context.product,
      };
    }

    if (context.cart) {
      this.pageContext.cart = {
        ...(this.pageContext.cart || {}),
        ...context.cart,
      };
    }

    if (context.order) {
      this.pageContext.order = {
        ...(this.pageContext.order || {}),
        ...context.order,
      };
    }

    if (context.session) {
      this.pageContext.session = {
        ...(this.pageContext.session || {}),
        ...context.session,
      };
    }

    const managedKeys = new Set(['page', 'metadata', 'product', 'cart', 'order', 'session']);
    Object.keys(context).forEach((key) => {
      if (!managedKeys.has(key)) {
        this.pageContext[key] = context[key];
      }
    });
  }

  identifyUser(user = {}) {
    if (typeof window === 'undefined') return;
    if (!this.initialized) {
      this.init();
    }

    const updatedContext = { ...this.userContext };

    if (typeof user.userId === 'string' && user.userId.trim().length > 0) {
      updatedContext.userId = user.userId.trim();
    }
    if (typeof user.phoneNumber === 'string' && user.phoneNumber.trim().length > 0) {
      updatedContext.phoneNumber = user.phoneNumber.trim();
    }
    if (typeof user.email === 'string' && user.email.trim().length > 0) {
      updatedContext.email = user.email.trim();
    }
    if (typeof user.name === 'string' && user.name.trim().length > 0) {
      updatedContext.name = user.name.trim();
    }

    if (typeof user.localUserId === 'string' && user.localUserId.trim().length > 0) {
      updatedContext.localUserId = user.localUserId.trim();
    } else if (user.localUserId === null) {
      delete updatedContext.localUserId;
    }

    this.userContext = updatedContext;

    if (updatedContext.userId) {
      this.updateSession({ userId: updatedContext.userId });
    }

    if (updatedContext.localUserId && !updatedContext.userId) {
      const contactMeta = {
        ...(this.sessionMeta?.metadata?.contact || {}),
        localUserId: updatedContext.localUserId,
      };
      this.sessionMeta = {
        ...this.sessionMeta,
        metadata: {
          ...(this.sessionMeta?.metadata || {}),
          contact: contactMeta,
        },
      };
    } else if (!updatedContext.localUserId && this.sessionMeta?.metadata?.contact?.localUserId) {
      const { metadata = {} } = this.sessionMeta;
      const contact = { ...(metadata.contact || {}) };
      delete contact.localUserId;
      const nextMetadata = { ...metadata };
      if (Object.keys(contact).length === 0) {
        delete nextMetadata.contact;
      } else {
        nextMetadata.contact = contact;
      }
      this.sessionMeta = {
        ...this.sessionMeta,
        metadata: nextMetadata,
      };
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

  onRouteChange(pathname, options = {}) {
    if (!pathname || typeof window === 'undefined') return;

    const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
    if (isApiPath(normalizedPath)) {
      this.cancelPendingVisit(normalizedPath);
      return;
    }
    const classification = classifyPage(normalizedPath);
    const page = {
      path: normalizedPath,
      title: document.title,
      name: classification.pageName,
      pageCategory: classification.pageCategory,
      slug: normalizedPath === '/' ? '' : normalizedPath.replace(/^\//u, ''),
    };

    const metadata = {
      pageCategory: classification.pageCategory,
      pageName: classification.pageName,
      ...(options.metadata || {}),
    };

    this.resetPageContext();
    this.setPageContext({ page });
    this.setPageContext({ metadata });

    this.scheduleVisitTrack({
      path: normalizedPath,
      metadata,
      source: options.source,
      delay: options.delay,
    });
  }

  scheduleVisitTrack({ path, metadata = {}, source = 'auto', delay = 220 } = {}) {
    if (typeof window === 'undefined') return;

    if (isApiPath(path)) {
      this.cancelPendingVisit(path);
      return;
    }

    if (this.pendingVisitTimer) {
      clearTimeout(this.pendingVisitTimer);
      this.pendingVisitTimer = null;
    }

    this.pendingVisitPath = path;
    this.pendingVisitMetadata = { ...metadata };

    const effectiveDelay = typeof delay === 'number' && Number.isFinite(delay) ? delay : 220;

    this.pendingVisitTimer = window.setTimeout(() => {
      this.pendingVisitTimer = null;
      const baseMetadata = {
        visitSource: source,
        ...(this.pendingVisitMetadata || {}),
      };
      this.pendingVisitPath = null;
      this.pendingVisitMetadata = null;
      this.track('visit', {
        metadata: baseMetadata,
      });
    }, effectiveDelay);
  }

  cancelPendingVisit(path) {
    if (this.pendingVisitTimer && (!path || path === this.pendingVisitPath)) {
      clearTimeout(this.pendingVisitTimer);
      this.pendingVisitTimer = null;
      this.pendingVisitPath = null;
      this.pendingVisitMetadata = null;
    }
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
      return;
    }
    
    // Validate step
    if (!step || typeof step !== 'string' || step.trim().length === 0) {
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
    }

    const timestamp = Date.now();
    const normalizedStep = step.trim();

    if (normalizedStep === 'visit') {
      const candidatePaths = [
        payload.page?.path,
        this.pageContext?.page?.path,
        this.pendingVisitPath,
      ].filter(Boolean);

      const apiPath = candidatePaths.find((candidate) => isApiPath(candidate));
      if (apiPath) {
        this.cancelPendingVisit(apiPath);
        return;
      }
    }

    const event = {
      step: normalizedStep,
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

    const pageContext = this.pageContext || {};

    const page = pruneEmpty(payload.page || pageContext.page);
    if (page) event.page = page;

    const product = pruneEmpty(payload.product || pageContext.product);
    if (product) event.product = product;

    const cart = pruneEmpty(payload.cart || pageContext.cart);
    if (cart) event.cart = cart;

    const order = pruneEmpty(payload.order || pageContext.order);
    if (order) event.order = order;

    const utm = pruneEmpty(payload.utm || this.sessionMeta.utm);
    if (utm) event.utm = utm;

    let metadata = {
      ...(pageContext.metadata || {}),
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
      if (normalizedStep === 'visit' && event.page?.path) {
        dedupeKey = `visit:${event.page.path}`;
      } else if (normalizedStep === 'purchase' && event.order?.orderId) {
        dedupeKey = `purchase:${event.order.orderId}`;
      } else if (normalizedStep === 'payment_initiated' && event.order?.orderId) {
        dedupeKey = `payment:${event.order.orderId}`;
      } else {
        // Use eventId as dedupe key for idempotency
        dedupeKey = event.eventId;
      }
    }

    // Check dedupe before queueing
    if (dedupeKey && this.shouldSkipDueToDedupe(dedupeKey, event.sessionId, timestamp)) {
      return;
    }

    if (event.step === 'visit') {
      this.cancelPendingVisit(event.page?.path || this.pendingVisitPath);
    }

    this.queue.push(event);
    if (dedupeKey) {
      this.markDedupe(dedupeKey, event.sessionId, normalizedStep, timestamp);
    }

    if (event.step === 'visit') {
      this.lastTrackedPath = event.page?.path || page?.path || this.pendingVisitPath || null;
    }

    const isCriticalStep = CRITICAL_STEPS.has(normalizedStep);

    if (this.queue.length >= MAX_BATCH_SIZE) {
      this.flush('batch');
    } else if (isCriticalStep) {
      this.flushForStep(normalizedStep);
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

  flushForStep(step) {
    if (!CRITICAL_STEPS.has(step) || this.queue.length === 0) {
      return;
    }

    const reason = `critical:${step}`;
    const delay = step === 'visit' ? 250 : 120;

    if (this.sending) {
      this.forceFlushSoon(reason, delay);
      return;
    }

    if (step === 'visit') {
      this.forceFlushSoon(reason, delay);
      return;
    }

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.flush(reason);
  }

  forceFlushSoon(reason = 'critical', delay = 120) {
    if (typeof window === 'undefined') return;
    if (this.queue.length === 0) return;

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      this.flush(reason);
    }, Math.max(0, delay));
  }

  async flush(reason = 'manual') {
    if (this.sending || this.queue.length === 0) return;
    this.sending = true;

    const rawBatch = this.queue.splice(0, MAX_BATCH_SIZE);
    const batch = rawBatch.filter((event) => {
      const hasIds = typeof event?.visitorId === 'string' && event.visitorId.length > 0 && typeof event?.sessionId === 'string' && event.sessionId.length > 0;
      const hasStep = typeof event?.step === 'string' && event.step.length > 0;
      if (!hasIds || !hasStep) {
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
          

        } else {
          errorDetails = `HTTP ${response.status}: ${response.statusText}`;
        }
      }
    } catch (error) {
      errorDetails = error?.message || 'Network error';
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
        
        this.scheduleFlush(retryDelay);
        return;
      } else {
        // Exceeded max retries, backup to localStorage
        this.queue = batch.concat(this.queue);
        this.backupQueue();
        this.queue = [];
        this.flushRetries = 0;
      }
    } else {
      // Success - reset retry counter
      this.flushRetries = 0;
    }

    this.sending = false;

    if (this.queue.length > 0) {
      this.scheduleFlush();
    }
  }
}

const funnelClient = new FunnelClient();

export default funnelClient;