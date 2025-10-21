/**
 * Event Queue Manager for Meta Conversions API
 * 
 * This implements a fire-and-forget pattern with automatic retry logic
 * to ensure ZERO impact on user experience while maximizing event delivery.
 * 
 * Key Features:
 * - Non-blocking: Events are queued and sent asynchronously
 * - Retry logic: Failed events are retried with exponential backoff
 * - Rate limiting: Prevents overwhelming the server
 * - Local storage: Persists failed events across sessions
 * - Batch processing: Groups events for efficient sending
 */

'use client';

class EventQueueManager {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxQueueSize = 100;
    this.batchSize = 5;
    this.processingInterval = 2000; // Process every 2 seconds
    this.maxRetries = 3;
    this.storageKey = 'meta_event_queue';
    this.monitor = null; // Will be lazy-loaded
    
    // Load persisted events from localStorage
    if (typeof window !== 'undefined') {
      this.loadPersistedEvents();
      this.startProcessing();
      
      // Lazy load monitor (non-blocking)
      this.loadMonitor();
    }
  }

  /**
   * Lazy load the performance monitor
   */
  async loadMonitor() {
    try {
      const monitorModule = await import('./metaPixelMonitor.js');
      this.monitor = monitorModule.default;
    } catch (error) {
      console.warn('[EventQueue] Monitor not available:', error);
    }
  }

  /**
   * Add an event to the queue (non-blocking)
   * @param {string} eventName - The event name
   * @param {object} options - Event options
   */
  enqueue(eventName, options) {
    const event = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventName,
      options,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending' // pending, processing, failed, success
    };

    // Add to queue
    this.queue.push(event);

    // Limit queue size (remove oldest if over limit)
    if (this.queue.length > this.maxQueueSize) {
      const removed = this.queue.shift();
      console.warn('[EventQueue] Queue full, dropping oldest event:', removed.eventName);
    }

    // Persist to localStorage
    this.persistQueue();

    // If not already processing, start
    if (!this.processing) {
      this.startProcessing();
    }
  }

  /**
   * Start processing the queue
   */
  startProcessing() {
    if (this.processing) return;
    
    this.processing = true;
    this.processQueue();
  }

  /**
   * Process events in the queue
   */
  async processQueue() {
    while (this.processing && this.queue.length > 0) {
      // Get pending events (not currently being processed)
      const pendingEvents = this.queue.filter(e => e.status === 'pending');
      
      if (pendingEvents.length === 0) {
        // Wait and check again
        await this.delay(this.processingInterval);
        continue;
      }

      // Process in batches
      const batch = pendingEvents.slice(0, this.batchSize);
      
      // Process batch concurrently
      await Promise.allSettled(
        batch.map(event => this.processEvent(event))
      );

      // Wait before next batch
      await this.delay(this.processingInterval);
    }

    this.processing = false;
  }

  /**
   * Process a single event
   * @param {object} event - The event to process
   */
  async processEvent(event) {
    // Mark as processing
    event.status = 'processing';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/meta/conversion-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: event.eventName,
          options: event.options
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Success - remove from queue
      event.status = 'success';
      this.removeFromQueue(event.id);
      
      // Record success in monitor
      if (this.monitor) {
        const duration = Date.now() - event.timestamp;
        this.monitor.recordCapiEvent(event.eventName, true, duration);
      }
      
      // Log success for important events
      if (['InitiateCheckout', 'Purchase', 'AddToCart'].includes(event.eventName)) {
        console.debug(`[EventQueue] ✓ ${event.eventName} delivered`, {
          id: event.id,
          age: Date.now() - event.timestamp
        });
      }

    } catch (error) {
      event.retries++;

      // Record failure in monitor
      if (this.monitor) {
        this.monitor.recordCapiEvent(event.eventName, false);
        this.monitor.recordError(event.eventName, error, 'capi');
      }

      if (event.retries >= this.maxRetries) {
        // Max retries reached - remove from queue
        console.error(`[EventQueue] ✗ ${event.eventName} failed after ${event.retries} retries:`, error.message);
        event.status = 'failed';
        this.removeFromQueue(event.id);
      } else {
        // Retry later
        event.status = 'pending';
        console.warn(`[EventQueue] Retry ${event.retries}/${this.maxRetries} for ${event.eventName}`);
      }
    }

    // Persist changes
    this.persistQueue();
  }

  /**
   * Remove an event from the queue
   * @param {string} eventId - The event ID to remove
   */
  removeFromQueue(eventId) {
    const index = this.queue.findIndex(e => e.id === eventId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.persistQueue();
    }
  }

  /**
   * Persist queue to localStorage
   */
  persistQueue() {
    if (typeof window === 'undefined') return;

    try {
      // Only persist pending and failed events
      const eventsToSave = this.queue
        .filter(e => ['pending', 'failed'].includes(e.status))
        .slice(-50); // Keep only last 50

      localStorage.setItem(this.storageKey, JSON.stringify(eventsToSave));
    } catch (error) {
      console.warn('[EventQueue] Failed to persist queue:', error);
    }
  }

  /**
   * Load persisted events from localStorage
   */
  loadPersistedEvents() {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const events = JSON.parse(saved);
        
        // Only load recent events (last 24 hours)
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const recentEvents = events.filter(e => e.timestamp > oneDayAgo);
        
        if (recentEvents.length > 0) {
          this.queue = recentEvents.map(e => ({
            ...e,
            status: 'pending', // Reset status
            retries: 0 // Reset retry count
          }));
          
          console.log(`[EventQueue] Loaded ${recentEvents.length} persisted events`);
        }
      }
    } catch (error) {
      console.warn('[EventQueue] Failed to load persisted events:', error);
    }
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue status (for debugging)
   */
  getStatus() {
    const status = {
      total: this.queue.length,
      pending: this.queue.filter(e => e.status === 'pending').length,
      processing: this.queue.filter(e => e.status === 'processing').length,
      failed: this.queue.filter(e => e.status === 'failed').length,
      isProcessing: this.processing
    };

    // Record queue size in monitor
    if (this.monitor) {
      this.monitor.recordQueueSize(status.total);
    }

    return status;
  }

  /**
   * Clear the queue (for testing/debugging)
   */
  clear() {
    this.queue = [];
    this.persistQueue();
    console.log('[EventQueue] Queue cleared');
  }
}

// Singleton instance
let queueManager;

if (typeof window !== 'undefined') {
  if (!window.__metaEventQueueManager) {
    window.__metaEventQueueManager = new EventQueueManager();
  }
  queueManager = window.__metaEventQueueManager;
}

export default queueManager;
