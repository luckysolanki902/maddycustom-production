// Utility functions for Agent V2

/**
 * Estimate token count for a string (rough approximation)
 * Based on ~4 characters per token for English text
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within token budget
 * @param {string} text
 * @param {number} maxTokens
 * @returns {string}
 */
export function truncateToTokens(text, maxTokens) {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) return text;
  
  // Rough character limit based on token budget
  const charLimit = maxTokens * 4;
  return text.slice(0, charLimit - 3) + '...';
}

/**
 * Format price in Indian Rupees
 * @param {number} price
 * @returns {string}
 */
export function formatPrice(price) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Sanitize user input
 * @param {string} input
 * @returns {string}
 */
export function sanitizeInput(input) {
  if (!input) return '';
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, 1000); // Max length
}

/**
 * Extract phone number from text
 * @param {string} text
 * @returns {string|null}
 */
export function extractPhone(text) {
  if (!text) return null;
  
  // Remove all non-digits
  const digits = text.replace(/\D/g, '');
  
  // Indian phone number patterns
  if (digits.length === 10) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  
  return null;
}

/**
 * Extract order ID from text (MongoDB ObjectId format)
 * @param {string} text
 * @returns {string|null}
 */
export function extractOrderId(text) {
  if (!text) return null;
  
  // Look for MongoDB ObjectId pattern (24 hex characters)
  const match = text.match(/\b[a-f0-9]{24}\b/i);
  return match ? match[0] : null;
}

/**
 * Parse price from natural language
 * @param {string} text
 * @returns {number|null}
 */
export function parsePrice(text) {
  if (!text) return null;
  
  const normalizedText = text.toLowerCase();
  
  // Handle "k" suffix (1k = 1000)
  const kMatch = normalizedText.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1]) * 1000);
  }
  
  // Handle currency symbols and commas
  const cleaned = normalizedText
    .replace(/[₹rs.,\s]/gi, '')
    .replace(/rupees?/gi, '');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Generate a simple hash for deduplication
 * @param {string} str
 * @returns {string}
 */
export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Debounce function for rate limiting
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Retry with exponential backoff
 * @param {Function} fn
 * @param {number} maxRetries
 * @param {number} baseDelay
 * @returns {Promise}
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
