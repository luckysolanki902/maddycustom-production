// Input Guardrails for Agent V2
import type { InputGuardrail, RunContext } from '@openai/agents';
import { LIMITS } from '../config/constants';
import type { AgentContext } from '../types';

// Rate limit tracking (in-memory, would use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Content Filter Guardrail
 * Blocks inappropriate or malicious content
 */
export const contentFilterGuardrail: InputGuardrail<AgentContext> = {
  name: 'Content Filter',
  runInParallel: false, // Block before processing
  execute: async ({ input }) => {
    const text = typeof input === 'string' ? input : JSON.stringify(input);
    
    // Check message length
    if (text.length > LIMITS.MAX_MESSAGE_LENGTH) {
      return {
        tripwireTriggered: true,
        outputInfo: {
          reason: 'Message too long',
          message: `Please keep your message under ${LIMITS.MAX_MESSAGE_LENGTH} characters.`,
        },
      };
    }
    
    if (text.length < LIMITS.MIN_MESSAGE_LENGTH) {
      return {
        tripwireTriggered: true,
        outputInfo: {
          reason: 'Message too short',
          message: 'Please provide a message.',
        },
      };
    }
    
    // Check for potentially harmful patterns
    const harmfulPatterns = [
      /\b(ignore previous|ignore all|disregard|forget everything)\b/i,
      /\b(system prompt|reveal prompt|show instructions)\b/i,
      /<script[^>]*>/i,
      /javascript:/i,
    ];
    
    for (const pattern of harmfulPatterns) {
      if (pattern.test(text)) {
        return {
          tripwireTriggered: true,
          outputInfo: {
            reason: 'Potentially harmful content detected',
            message: "I'm sorry, I can't process that request.",
          },
        };
      }
    }
    
    return { tripwireTriggered: false };
  },
};

/**
 * Prompt Injection Detector Guardrail
 * Detects attempts to manipulate the AI
 */
export const injectionDetectorGuardrail: InputGuardrail<AgentContext> = {
  name: 'Injection Detector',
  runInParallel: true, // Can run alongside other checks
  execute: async ({ input }) => {
    const text = typeof input === 'string' ? input.toLowerCase() : '';
    
    // Common injection patterns
    const injectionPatterns = [
      'you are now',
      'pretend to be',
      'act as',
      'roleplay as',
      'ignore your instructions',
      'override your programming',
      'jailbreak',
      'dan mode',
      'developer mode',
    ];
    
    for (const pattern of injectionPatterns) {
      if (text.includes(pattern)) {
        console.warn('[InjectionDetector] Potential injection attempt:', pattern);
        // Log but don't block - just flag for monitoring
        return {
          tripwireTriggered: false,
          outputInfo: {
            flagged: true,
            pattern,
          },
        };
      }
    }
    
    return { tripwireTriggered: false };
  },
};

/**
 * Rate Limiter Guardrail
 * Prevents abuse by limiting request frequency
 */
export const rateLimiterGuardrail: InputGuardrail<AgentContext> = {
  name: 'Rate Limiter',
  runInParallel: false, // Must check before processing
  execute: async ({ context }) => {
    const userId = context?.userId || 'anonymous';
    const now = Date.now();
    
    let entry = rateLimitMap.get(userId);
    
    // Reset if window expired
    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + 60 * 1000, // 1 minute window
      };
    }
    
    entry.count++;
    rateLimitMap.set(userId, entry);
    
    if (entry.count > LIMITS.MAX_REQUESTS_PER_MINUTE) {
      return {
        tripwireTriggered: true,
        outputInfo: {
          reason: 'Rate limit exceeded',
          message: 'You are sending too many messages. Please wait a moment and try again.',
          retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        },
      };
    }
    
    return { tripwireTriggered: false };
  },
};

/**
 * All input guardrails
 */
export const inputGuardrails: InputGuardrail<AgentContext>[] = [
  contentFilterGuardrail,
  injectionDetectorGuardrail,
  rateLimiterGuardrail,
];
