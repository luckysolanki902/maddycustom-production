/**
 * Meta Pixel Performance Monitor
 * 
 * Tracks performance metrics for Meta Pixel and Conversions API
 * without impacting user experience.
 * 
 * Metrics tracked:
 * - Event delivery success rate
 * - Average delivery time
 * - Failed events and reasons
 * - Queue health
 * - Coverage ratio
 */

'use client';

class MetaPixelMonitor {
  constructor() {
    this.metrics = {
      pixelEvents: {
        total: 0,
        success: 0,
        failed: 0,
        byType: {}
      },
      capiEvents: {
        total: 0,
        success: 0,
        failed: 0,
        byType: {}
      },
      performance: {
        avgDeliveryTime: 0,
        deliveryTimes: []
      },
      queue: {
        maxSize: 0,
        avgSize: 0,
        samples: []
      },
      errors: []
    };

    this.maxErrorHistory = 50;
    this.maxDeliveryTimeSamples = 100;
    
    // Expose to window for debugging
    if (typeof window !== 'undefined') {
      window.__metaPixelMonitor = this;
    }
  }

  /**
   * Record a pixel event
   * @param {string} eventName - Event name
   * @param {boolean} success - Whether it succeeded
   * @param {number} duration - Time taken in ms
   */
  recordPixelEvent(eventName, success = true, duration = 0) {
    this.metrics.pixelEvents.total++;
    
    if (success) {
      this.metrics.pixelEvents.success++;
    } else {
      this.metrics.pixelEvents.failed++;
    }

    // Track by type
    if (!this.metrics.pixelEvents.byType[eventName]) {
      this.metrics.pixelEvents.byType[eventName] = { total: 0, success: 0, failed: 0 };
    }
    this.metrics.pixelEvents.byType[eventName].total++;
    if (success) {
      this.metrics.pixelEvents.byType[eventName].success++;
    } else {
      this.metrics.pixelEvents.byType[eventName].failed++;
    }
  }

  /**
   * Record a CAPI event
   * @param {string} eventName - Event name
   * @param {boolean} success - Whether it succeeded
   * @param {number} duration - Time taken in ms
   */
  recordCapiEvent(eventName, success = true, duration = 0) {
    this.metrics.capiEvents.total++;
    
    if (success) {
      this.metrics.capiEvents.success++;
    } else {
      this.metrics.capiEvents.failed++;
    }

    // Track by type
    if (!this.metrics.capiEvents.byType[eventName]) {
      this.metrics.capiEvents.byType[eventName] = { total: 0, success: 0, failed: 0 };
    }
    this.metrics.capiEvents.byType[eventName].total++;
    if (success) {
      this.metrics.capiEvents.byType[eventName].success++;
    } else {
      this.metrics.capiEvents.byType[eventName].failed++;
    }

    // Record delivery time
    if (success && duration > 0) {
      this.metrics.performance.deliveryTimes.push(duration);
      
      // Keep only recent samples
      if (this.metrics.performance.deliveryTimes.length > this.maxDeliveryTimeSamples) {
        this.metrics.performance.deliveryTimes.shift();
      }

      // Calculate average
      const sum = this.metrics.performance.deliveryTimes.reduce((a, b) => a + b, 0);
      this.metrics.performance.avgDeliveryTime = Math.round(sum / this.metrics.performance.deliveryTimes.length);
    }
  }

  /**
   * Record an error
   * @param {string} eventName - Event name
   * @param {string} error - Error message
   * @param {string} type - 'pixel' or 'capi'
   */
  recordError(eventName, error, type = 'capi') {
    this.metrics.errors.push({
      timestamp: Date.now(),
      eventName,
      error: error.toString(),
      type
    });

    // Keep only recent errors
    if (this.metrics.errors.length > this.maxErrorHistory) {
      this.metrics.errors.shift();
    }
  }

  /**
   * Record queue size sample
   * @param {number} size - Current queue size
   */
  recordQueueSize(size) {
    this.metrics.queue.samples.push(size);
    
    // Keep only recent samples
    if (this.metrics.queue.samples.length > 100) {
      this.metrics.queue.samples.shift();
    }

    // Update max
    if (size > this.metrics.queue.maxSize) {
      this.metrics.queue.maxSize = size;
    }

    // Calculate average
    const sum = this.metrics.queue.samples.reduce((a, b) => a + b, 0);
    this.metrics.queue.avgSize = Math.round(sum / this.metrics.queue.samples.length);
  }

  /**
   * Get coverage ratio for a specific event
   * @param {string} eventName - Event name
   * @returns {number} - Coverage ratio (0-100)
   */
  getCoverageRatio(eventName) {
    const pixelCount = this.metrics.pixelEvents.byType[eventName]?.success || 0;
    const capiCount = this.metrics.capiEvents.byType[eventName]?.success || 0;

    if (pixelCount === 0) return 0;
    
    return Math.round((capiCount / pixelCount) * 100);
  }

  /**
   * Get success rate for CAPI events
   * @returns {number} - Success rate (0-100)
   */
  getCapiSuccessRate() {
    if (this.metrics.capiEvents.total === 0) return 0;
    return Math.round((this.metrics.capiEvents.success / this.metrics.capiEvents.total) * 100);
  }

  /**
   * Get summary report
   * @returns {object} - Summary report
   */
  getSummary() {
    return {
      coverage: {
        InitiateCheckout: this.getCoverageRatio('InitiateCheckout'),
        Purchase: this.getCoverageRatio('Purchase'),
        AddToCart: this.getCoverageRatio('AddToCart'),
      },
      capiSuccessRate: this.getCapiSuccessRate(),
      avgDeliveryTime: this.metrics.performance.avgDeliveryTime,
      queueHealth: {
        avgSize: this.metrics.queue.avgSize,
        maxSize: this.metrics.queue.maxSize,
      },
      recentErrors: this.metrics.errors.slice(-10)
    };
  }

  /**
   * Print summary to console (for debugging)
   */
  printSummary() {
    const summary = this.getSummary();
    
    console.group('📊 Meta Pixel Performance Summary');
    console.log('Coverage Ratios:');
    console.table(summary.coverage);
    console.log(`CAPI Success Rate: ${summary.capiSuccessRate}%`);
    console.log(`Avg Delivery Time: ${summary.avgDeliveryTime}ms`);
    console.log('Queue Health:', summary.queueHealth);
    if (summary.recentErrors.length > 0) {
      console.warn('Recent Errors:', summary.recentErrors);
    }
    console.groupEnd();
  }

  /**
   * Reset metrics (for testing)
   */
  reset() {
    this.metrics = {
      pixelEvents: {
        total: 0,
        success: 0,
        failed: 0,
        byType: {}
      },
      capiEvents: {
        total: 0,
        success: 0,
        failed: 0,
        byType: {}
      },
      performance: {
        avgDeliveryTime: 0,
        deliveryTimes: []
      },
      queue: {
        maxSize: 0,
        avgSize: 0,
        samples: []
      },
      errors: []
    };
    console.log('📊 Metrics reset');
  }
}

// Singleton instance
let monitor;

if (typeof window !== 'undefined') {
  if (!window.__metaPixelMonitorInstance) {
    window.__metaPixelMonitorInstance = new MetaPixelMonitor();
  }
  monitor = window.__metaPixelMonitorInstance;
}

export default monitor;
