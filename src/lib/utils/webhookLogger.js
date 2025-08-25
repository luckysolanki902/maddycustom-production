// lib/utils/webhookLogger.js
// Enhanced logging utility for webhook debugging

class WebhookLogger {
  constructor(orderId = null) {
    this.orderId = orderId;
    this.logs = [];
    this.startTime = Date.now();
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      orderId: this.orderId,
      data,
      relativeTime: Date.now() - this.startTime
    };

    this.logs.push(logEntry);
    
    // Also output to console with proper formatting
    const prefix = `[WEBHOOK${this.orderId ? `:${this.orderId}` : ''}]`;
    const formattedMessage = `${prefix} ${message}`;
    
    switch (level) {
      case 'error':
        console.error(formattedMessage, data);
        break;
      case 'warn':
        console.warn(formattedMessage, data);
        break;
      case 'info':
        console.info(formattedMessage, data);
        break;
      case 'debug':
        console.log(formattedMessage, data);
        break;
      default:
        console.log(formattedMessage, data);
    }
  }

  error(message, data) {
    this.log('error', message, data);
  }

  warn(message, data) {
    this.log('warn', message, data);
  }

  info(message, data) {
    this.log('info', message, data);
  }

  debug(message, data) {
    this.log('debug', message, data);
  }

  // Get a summary of all issues encountered
  getSummary() {
    const errors = this.logs.filter(log => log.level === 'error');
    const warnings = this.logs.filter(log => log.level === 'warn');
    const totalTime = Date.now() - this.startTime;

    return {
      orderId: this.orderId,
      totalProcessingTime: totalTime,
      totalLogs: this.logs.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors: errors.map(e => ({ message: e.message, data: e.data })),
      warnings: warnings.map(w => ({ message: w.message, data: w.data })),
      hasIssues: errors.length > 0 || warnings.length > 0
    };
  }

  // Export logs for debugging
  exportLogs() {
    return {
      orderId: this.orderId,
      startTime: this.startTime,
      logs: this.logs,
      summary: this.getSummary()
    };
  }
}

// Inventory operation tracker
class InventoryTracker {
  constructor() {
    this.operations = [];
  }

  recordOperation(type, inventoryId, quantity, result) {
    this.operations.push({
      type, // 'restore' or 'clearReserved'
      inventoryId,
      quantity,
      result,
      timestamp: new Date().toISOString()
    });
  }

  getFailures() {
    return this.operations.filter(op => !op.result.success);
  }

  getSuccesses() {
    return this.operations.filter(op => op.result.success);
  }

  getSummary() {
    const successes = this.getSuccesses();
    const failures = this.getFailures();
    
    return {
      total: this.operations.length,
      successful: successes.length,
      failed: failures.length,
      successRate: this.operations.length > 0 ? (successes.length / this.operations.length * 100).toFixed(2) + '%' : '0%',
      operations: this.operations
    };
  }
}

module.exports = {
  WebhookLogger,
  InventoryTracker
};
