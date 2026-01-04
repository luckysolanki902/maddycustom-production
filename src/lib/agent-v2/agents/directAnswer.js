// Direct Answer Agent - Handles greetings, simple queries, chitchat
import { Agent } from '@openai/agents';
import { PROMPTS } from '../config/prompts.js';
import { MODEL_CONFIGS } from '../config/models.js';
import { GREETING_TOKENS } from '../config/constants.js';

// Pre-defined responses for common greetings (no LLM needed)
const GREETING_RESPONSES = {
  default: [
    "Hey! 👋 I'm Maddy, your shopping assistant. Looking for something cool for your ride?",
    "Hi there! I can help you find wraps, fragrances, accessories, or track your orders. What are you looking for?",
    "Hello! 🚗 Ready to customize your vehicle? Tell me what you're looking for!",
  ],
  thanks: [
    "You're welcome! Let me know if you need anything else. 😊",
    "Happy to help! Feel free to ask if you have more questions.",
    "Anytime! I'm here if you need anything.",
  ],
  bye: [
    "Bye! Come back soon! 👋",
    "Take care! Happy customizing! 🚗",
    "See you later! Feel free to reach out anytime.",
  ],
};

/**
 * Get a quick response for simple messages without calling LLM
 * @param {string} message
 * @returns {string|null}
 */
export function getQuickResponse(message) {
  const trimmed = message.trim().toLowerCase();
  
  // Check for greetings
  const normalized = trimmed.replace(/[^a-z\s]/g, '').trim();
  if (GREETING_TOKENS.has(normalized) || /^(hi+|hey+|h?ello|yo)\s*$/i.test(trimmed)) {
    const responses = GREETING_RESPONSES.default;
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // Check for thanks
  if (/\b(thank|thanks|thx|ty)\b/i.test(trimmed)) {
    const responses = GREETING_RESPONSES.thanks;
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // Check for bye
  if (/\b(bye|goodbye|see you|later|cya)\b/i.test(trimmed)) {
    const responses = GREETING_RESPONSES.bye;
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  return null;
}

/**
 * Create the Direct Answer Agent
 * @returns {Agent}
 */
export function createDirectAnswerAgent() {
  return new Agent({
    name: 'DirectAnswerAgent',
    instructions: PROMPTS.DIRECT_ANSWER_AGENT,
    model: MODEL_CONFIGS.directAnswer.name,
    modelSettings: {
      temperature: MODEL_CONFIGS.directAnswer.temperature,
      maxTokens: MODEL_CONFIGS.directAnswer.maxTokens,
    },
    // No tools - this agent just responds directly
    tools: [],
  });
}

/**
 * Run the Direct Answer Agent
 * @param {string} message
 * @param {object} context
 * @returns {Promise<object>}
 */
export async function runDirectAnswerAgent(message, context) {
  // Try quick response first
  const quickResponse = getQuickResponse(message);
  if (quickResponse) {
    return { text: quickResponse };
  }
  
  // Fall back to LLM for more complex chitchat
  const { run } = await import('@openai/agents');
  const agent = createDirectAnswerAgent();
  
  const result = await run(agent, message, {
    context,
  });
  
  const output = result.finalOutput;
  
  return {
    text: typeof output === 'string' ? output : JSON.stringify(output),
  };
}
