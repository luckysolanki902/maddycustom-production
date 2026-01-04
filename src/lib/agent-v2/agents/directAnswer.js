// Direct Answer Agent - Handles greetings, simple queries, chitchat
// ALL responses come from the LLM agent, no pre-made responses
import { Agent } from '@openai/agents';
import { PROMPTS } from '../config/prompts.js';
import { MODEL_CONFIGS } from '../config/models.js';

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
 * Run the Direct Answer Agent - always uses LLM, no shortcuts
 * @param {string} message
 * @param {object} context
 * @returns {Promise<object>}
 */
export async function runDirectAnswerAgent(message, context) {
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
