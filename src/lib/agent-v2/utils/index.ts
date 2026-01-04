// Utility functions for Agent V2

/**
 * Estimate token count for a string (rough approximation)
 * Based on ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within token budget
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) return text;
  
  // Rough character limit based on token budget
  const charLimit = maxTokens * 4;
  return text.slice(0, charLimit - 3) + '...';
}

/**
 * Format price in Indian Rupees
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, 1000); // Max length
}

/**
 * Extract phone number from text
 */
export function extractPhone(text: string): string | null {
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
 */
export function extractOrderId(text: string): string | null {
  if (!text) return null;
  
  // Look for MongoDB ObjectId pattern (24 hex characters)
  const match = text.match(/\b[a-f0-9]{24}\b/i);
  return match ? match[0] : null;
}

/**
 * Parse price from natural language
 */
export function parsePrice(text: string): number | null {
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
 */
export function simpleHash(str: string): string {
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
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
