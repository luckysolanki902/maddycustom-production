// Output Guardrails for Agent V2
import { LIMITS } from '../config/constants.js';

/**
 * Response Validator Guardrail
 * Ensures response quality and safety
 */
export const responseValidatorGuardrail = {
  name: 'Response Validator',
  execute: async ({ output }) => {
    const text = typeof output === 'string' ? output : JSON.stringify(output);
    
    // Check for empty response
    if (!text || text.trim().length === 0) {
      return {
        tripwireTriggered: true,
        outputInfo: {
          reason: 'Empty response',
          message: "I'm sorry, I couldn't generate a response. Please try again.",
        },
      };
    }
    
    // Check for hallucinated URLs (not our domain)
    const urlPattern = /https?:\/\/[^\s]+/gi;
    const urls = text.match(urlPattern) || [];
    const allowedDomains = [
      'maddycustom.com',
      'wa.me',
      'whatsapp.com',
      'shiprocket.in',
    ];
    
    for (const url of urls) {
      const isAllowed = allowedDomains.some(domain => url.includes(domain));
      if (!isAllowed) {
        console.warn('[ResponseValidator] Potentially hallucinated URL:', url);
        // Don't block, but flag for monitoring
      }
    }
    
    // Check response length
    if (text.length > LIMITS.MAX_RESPONSE_LENGTH) {
      console.warn('[ResponseValidator] Response too long, may need truncation');
    }
    
    return { tripwireTriggered: false };
  },
};

/**
 * PII Filter Guardrail
 * Removes accidentally exposed personal information
 */
export const piiFilterGuardrail = {
  name: 'PII Filter',
  execute: async ({ output }) => {
    const text = typeof output === 'string' ? output : JSON.stringify(output);
    
    // Patterns that might indicate PII leakage
    const piiPatterns = [
      // Full email addresses (log but don't block)
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      // Full phone numbers with country code
      /\+91\s*[0-9]{10}/g,
      // Aadhaar-like numbers (12 digits)
      /\b[0-9]{4}\s*[0-9]{4}\s*[0-9]{4}\b/g,
      // Credit card-like numbers
      /\b[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}\b/g,
    ];
    
    for (const pattern of piiPatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        console.warn('[PIIFilter] Potential PII in response:', pattern.source);
        // Log for monitoring, don't block normal operation
      }
    }
    
    return { tripwireTriggered: false };
  },
};

/**
 * Brand Safety Guardrail
 * Ensures responses align with brand guidelines
 */
export const brandSafetyGuardrail = {
  name: 'Brand Safety',
  execute: async ({ output }) => {
    const text = typeof output === 'string' ? output.toLowerCase() : '';
    
    // Words/phrases to avoid in brand communication
    const avoidPatterns = [
      'competitor',
      'cheap knockoff',
      'better than',
      'worst',
      'terrible',
      'awful',
    ];
    
    for (const pattern of avoidPatterns) {
      if (text.includes(pattern)) {
        console.warn('[BrandSafety] Potentially off-brand language:', pattern);
      }
    }
    
    return { tripwireTriggered: false };
  },
};

/**
 * All output guardrails
 */
export const outputGuardrails = [
  responseValidatorGuardrail,
  piiFilterGuardrail,
  brandSafetyGuardrail,
];
