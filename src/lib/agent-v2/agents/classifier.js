// Classifier Agent - Routes messages to appropriate handler
import { Agent } from '@openai/agents';
import { z } from 'zod';
import { PROMPTS } from '../config/prompts.js';
import { MODEL_CONFIGS } from '../config/models.js';
import { CLASSIFICATION_CATEGORIES } from '../config/constants.js';

// Output schema for classifier
export const ClassifierOutputSchema = z.object({
  category: z.enum([
    CLASSIFICATION_CATEGORIES.DATA_QUERY,
    CLASSIFICATION_CATEGORIES.VECTOR_STORE,
    CLASSIFICATION_CATEGORIES.DIRECT_ANSWER,
    CLASSIFICATION_CATEGORIES.HUMAN_HANDOFF,
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  extractedIntent: z.object({
    primaryEntity: z.string().optional(),
    action: z.string().optional(),
    constraints: z.record(z.any()).optional(),
  }).optional(),
});

// Fast-path detection for common patterns
const GREETING_PATTERN = /^(hi+|hey+|h?ello|yo|namaste|hola|sup)\s*[!?.]*$/i;
const ORDER_PATTERN = /\b(order|track|tracking|delivery|shipment|shipped|status)\b/i;
const PRODUCT_PATTERN = /\b(show|find|search|buy|want|need|looking for|recommend|suggest|wrap|fragrance|sticker|accessory|helmet|bike|car)\b/i;
const HANDOFF_PATTERN = /\b(complaint|angry|frustrated|human|speak to|talk to|manager|urgent|emergency|lawyer|legal)\b/i;
const FAQ_PATTERN = /\b(how|what is|policy|return|refund|warranty|install|care|maintain|about|company)\b/i;

/**
 * Quick classification without LLM for obvious patterns
 * @param {string} message
 * @returns {object|null}
 */
export function quickClassify(message) {
  const trimmed = message.trim().toLowerCase();
  
  // Greetings - fast path
  if (GREETING_PATTERN.test(trimmed) || trimmed.length <= 5) {
    return {
      category: CLASSIFICATION_CATEGORIES.DIRECT_ANSWER,
      confidence: 0.95,
      reasoning: 'Simple greeting detected',
      extractedIntent: { action: 'greeting' },
    };
  }
  
  // Handoff triggers - check first for safety
  if (HANDOFF_PATTERN.test(trimmed)) {
    return {
      category: CLASSIFICATION_CATEGORIES.HUMAN_HANDOFF,
      confidence: 0.9,
      reasoning: 'Escalation keywords detected',
      extractedIntent: { action: 'escalate' },
    };
  }
  
  // Order tracking - clear intent
  if (ORDER_PATTERN.test(trimmed) && !PRODUCT_PATTERN.test(trimmed)) {
    return {
      category: CLASSIFICATION_CATEGORIES.DATA_QUERY,
      confidence: 0.9,
      reasoning: 'Order tracking intent detected',
      extractedIntent: { action: 'track_order' },
    };
  }
  
  // Product search - clear intent
  if (PRODUCT_PATTERN.test(trimmed)) {
    return {
      category: CLASSIFICATION_CATEGORIES.DATA_QUERY,
      confidence: 0.85,
      reasoning: 'Product search intent detected',
      extractedIntent: { action: 'search_products' },
    };
  }
  
  // FAQ patterns
  if (FAQ_PATTERN.test(trimmed) && !PRODUCT_PATTERN.test(trimmed)) {
    return {
      category: CLASSIFICATION_CATEGORIES.VECTOR_STORE,
      confidence: 0.8,
      reasoning: 'FAQ/policy question detected',
      extractedIntent: { action: 'search_knowledge' },
    };
  }
  
  // No quick match - need LLM
  return null;
}

/**
 * Create the Classifier Agent
 * @returns {Agent}
 */
export function createClassifierAgent() {
  return new Agent({
    name: 'Classifier',
    instructions: PROMPTS.CLASSIFIER,
    model: MODEL_CONFIGS.classifier.name,
    modelSettings: {
      temperature: MODEL_CONFIGS.classifier.temperature,
    },
    outputType: ClassifierOutputSchema,
  });
}

/**
 * Classify a message with optional quick-path
 * @param {string} message
 * @param {object} context
 * @returns {Promise<object>}
 */
export async function classifyMessage(message, context = {}) {
  // Try quick classification first
  const quickResult = quickClassify(message);
  if (quickResult && quickResult.confidence >= 0.85) {
    return quickResult;
  }
  
  // Context-aware adjustments
  if (context?.previousClassification === CLASSIFICATION_CATEGORIES.DATA_QUERY) {
    // "Show more" pattern in product context
    if (/^(show\s*)?more|next|continue/i.test(message.trim())) {
      return {
        category: CLASSIFICATION_CATEGORIES.DATA_QUERY,
        confidence: 0.95,
        reasoning: 'Pagination continuation in product context',
        extractedIntent: { action: 'paginate' },
      };
    }
  }
  
  // Fall back to LLM classification
  const { run } = await import('@openai/agents');
  const agent = createClassifierAgent();
  
  const result = await run(agent, message);
  
  // Parse and validate output
  const parsed = ClassifierOutputSchema.safeParse(result.finalOutput);
  if (!parsed.success) {
    // Default to direct answer if parsing fails
    return {
      category: CLASSIFICATION_CATEGORIES.DIRECT_ANSWER,
      confidence: 0.5,
      reasoning: 'Classification parsing failed, defaulting to direct answer',
    };
  }
  
  return parsed.data;
}
