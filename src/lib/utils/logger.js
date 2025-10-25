/**
 * Structured logging utility for Vercel deployment
 * 
 * SERVER-SIDE: Logs directly to console (visible in Vercel dashboard)
 * CLIENT-SIDE: Batches logs and sends to /api/logs/client (then visible in Vercel)
 * 
 * Usage:
 *   logger.info('User logged in', { userId: '123' });
 *   logger.error('Payment failed', { orderId: '456', error });
 *   logger.payment('Payment initiated', { orderId, amount });
 */

const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  PAYMENT: 'payment', // Custom level for payment tracking
  WEBHOOK: 'webhook', // Custom level for webhook events
};

class Logger {
  constructor(context = '') {
    this.context = context;
    this.isProduction = process.env.NODE_ENV === 'production';
    this.isServer = typeof window === 'undefined';
    
    // Client-side batching
    this.logQueue = [];
    this.batchSize = 10; // Send after 10 logs
    this.batchTimeout = 5000; // Or after 5 seconds
    this.batchTimer = null;
    
    // Only set up batching on client-side
    if (!this.isServer) {
      this.setupClientSideBatching();
    }
  }

  /**
   * Setup client-side log batching and sending
   */
  setupClientSideBatching() {
    // Send logs before page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushLogs(true); // Synchronous flush on unload
      });
    }
  }

  /**
   * Format log message with timestamp and context
   */
  formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const contextPrefix = this.context ? `[${this.context}]` : '';
    
    return {
      timestamp,
      level,
      context: this.context,
      message: `${contextPrefix} ${message}`,
      data,
      environment: this.isProduction ? 'production' : 'development',
      runtime: this.isServer ? 'server' : 'client',
    };
  }

  /**
   * Send log - server logs directly, client logs batch and send to API
   */
  log(level, message, data = {}) {
    const formatted = this.formatMessage(level, message, data);

    if (this.isServer) {
      // SERVER-SIDE: Log directly to console (visible in Vercel)
      this.logToConsole(level, formatted);
    } else {
      // CLIENT-SIDE: Add to queue and batch send to API
      this.logQueue.push(formatted);
      
      // Console log in development only for debugging
      if (!this.isProduction) {
        this.logToConsole(level, formatted);
      }
      
      // Check if we should flush
      if (this.logQueue.length >= this.batchSize) {
        this.flushLogs();
      } else {
        // Reset batch timer
        this.resetBatchTimer();
      }
    }

    return formatted;
  }

  /**
   * Log to console with appropriate method
   */
  logToConsole(level, formatted) {
    const message = formatted.message;
    const data = formatted.data;

    switch (level) {
      case LOG_LEVELS.ERROR:
        console.error(message, data);
        break;
      case LOG_LEVELS.WARN:
        console.warn(message, data);
        break;
      case LOG_LEVELS.DEBUG:
        console.debug(message, data);
        break;
      default:
        console.info(message, data);
    }
  }

  /**
   * Reset batch timer for client-side logging
   */
  resetBatchTimer() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    this.batchTimer = setTimeout(() => {
      this.flushLogs();
    }, this.batchTimeout);
  }

  /**
   * Flush queued logs to server
   */
  async flushLogs(sync = false) {
    if (this.isServer || this.logQueue.length === 0) {
      return;
    }

    const logsToSend = [...this.logQueue];
    this.logQueue = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      if (sync) {
        // Synchronous send using sendBeacon for page unload
        const blob = new Blob([JSON.stringify(logsToSend)], { type: 'application/json' });
        navigator.sendBeacon('/api/logs/client', blob);
      } else {
        // Asynchronous send
        await fetch('/api/logs/client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logsToSend),
          // Don't wait for response to avoid blocking
          keepalive: true
        }).catch(err => {
          // Silently fail - don't want logging to break the app
          if (!this.isProduction) {
            console.warn('Failed to send logs to server:', err);
          }
        });
      }
    } catch (error) {
      // Silently fail - logging should never break the app
      if (!this.isProduction) {
        console.warn('Failed to flush logs:', error);
      }
    }
  }

  /**
   * Debug level - only in development
   */
  debug(message, data) {
    return this.log(LOG_LEVELS.DEBUG, message, data);
  }

  /**
   * Info level - general information
   */
  info(message, data) {
    return this.log(LOG_LEVELS.INFO, message, data);
  }

  /**
   * Warning level - something unexpected but not critical
   */
  warn(message, data) {
    return this.log(LOG_LEVELS.WARN, message, data);
  }

  /**
   * Error level - something failed
   */
  error(message, data) {
    return this.log(LOG_LEVELS.ERROR, message, data);
  }

  /**
   * Payment tracking - specific for payment events
   */
  payment(message, data) {
    return this.log(LOG_LEVELS.PAYMENT, message, data);
  }

  /**
   * Webhook tracking - specific for webhook events
   */
  webhook(message, data) {
    return this.log(LOG_LEVELS.WEBHOOK, message, data);
  }

  /**
   * Create a child logger with additional context
   */
  child(childContext) {
    const newContext = this.context
      ? `${this.context}:${childContext}`
      : childContext;
    return new Logger(newContext);
  }

  /**
   * Manually flush logs (useful before navigation)
   */
  async flush() {
    await this.flushLogs();
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for creating custom loggers
export { Logger };

/**
 * Create a logger with specific context
 * @param {string} context - Context name (e.g., 'Payment', 'Order', 'Webhook')
 * @returns {Logger} Logger instance
 */
export const createLogger = (context) => {
  return new Logger(context);
};

/**
 * Quick access to payment logger
 */
export const paymentLogger = createLogger('Payment');

/**
 * Quick access to order logger
 */
export const orderLogger = createLogger('Order');

/**
 * Quick access to webhook logger
 */
export const webhookLogger = createLogger('Webhook');
