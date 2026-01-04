// Vector Store Agent - Handles FAQs, policies, company info using file search
import { Agent, fileSearchTool } from '@openai/agents';
import { PROMPTS } from '../config/prompts.js';
import { MODEL_CONFIGS } from '../config/models.js';
import { VECTOR_STORE_ID } from '../config/constants.js';

/**
 * Create the Vector Store Agent
 * Uses OpenAI's hosted file_search tool with our knowledge base
 * @returns {Agent}
 */
export function createVectorStoreAgent() {
  // Only add file search tool if vector store ID is configured
  const tools = VECTOR_STORE_ID ? [fileSearchTool(VECTOR_STORE_ID)] : [];
  
  return new Agent({
    name: 'VectorStoreAgent',
    instructions: PROMPTS.VECTOR_STORE_AGENT,
    model: MODEL_CONFIGS.vectorStore.name,
    modelSettings: {
      temperature: MODEL_CONFIGS.vectorStore.temperature,
    },
    tools,
  });
}

/**
 * Run the Vector Store Agent
 * @param {string} message
 * @param {object} context
 * @returns {Promise<object>}
 */
export async function runVectorStoreAgent(message, context) {
  const { run } = await import('@openai/agents');
  const agent = createVectorStoreAgent();
  
  // If no vector store configured, return a helpful message
  if (!VECTOR_STORE_ID) {
    return {
      text: "I'm sorry, I don't have access to the knowledge base right now. For policy questions, please contact our support at https://wa.me/918112673988",
    };
  }
  
  const result = await run(agent, message, {
    context,
  });
  
  const output = result.finalOutput;
  
  return {
    text: typeof output === 'string' ? output : JSON.stringify(output),
    sources: [], // TODO: Extract sources from file search results
  };
}
