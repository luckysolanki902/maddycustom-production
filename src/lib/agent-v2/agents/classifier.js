// Classifier Agent - Routes ALL messages through LLM classification
// NO regex shortcuts - everything goes through the classifier agent
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
 * Classify a message - ALL messages go through LLM, no regex shortcuts
 * @param {string} message
 * @param {object} context
 * @returns {Promise<object>}
 */
export async function classifyMessage(message, context = {}) {
  const { run } = await import('@openai/agents');
  const agent = createClassifierAgent();
  
  // Build context-aware input for classifier
  let contextualMessage = message;
  
  // Add conversation context if available
  if (context?.previousClassification) {
    contextualMessage = `[Previous intent: ${context.previousClassification}]\nUser message: ${message}`;
  }
  
  const result = await run(agent, contextualMessage);
  
  // Parse and validate output
  const parsed = ClassifierOutputSchema.safeParse(result.finalOutput);
  if (!parsed.success) {
    console.warn('[Classifier] Failed to parse output, using fallback');
    // Default to direct answer if parsing fails
    return {
      category: CLASSIFICATION_CATEGORIES.DIRECT_ANSWER,
      confidence: 0.5,
      reasoning: 'Classification parsing failed, defaulting to direct answer',
    };
  }
  
  return parsed.data;
}
