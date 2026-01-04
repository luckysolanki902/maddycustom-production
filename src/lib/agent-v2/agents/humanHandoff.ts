// Human Handoff Agent - Gracefully redirects to human support
import { Agent } from '@openai/agents';
import { PROMPTS } from '../config/prompts';
import { MODEL_CONFIGS } from '../config/models';
import { HUMAN_HANDOFF } from '../config/constants';
import type { AgentContext } from '../types';

/**
 * Generate a handoff response
 */
function generateHandoffResponse(reason?: string): string {
  const baseMessage = `I understand this is important to you, and I want to make sure you get the best help possible.

Please reach out to our support team directly:
📱 **WhatsApp**: ${HUMAN_HANDOFF.WHATSAPP_LINK}
📞 **Phone**: ${HUMAN_HANDOFF.PHONE}

Our team is available to assist you personally and will resolve your concern as quickly as possible.`;

  return baseMessage;
}

/**
 * Create the Human Handoff Agent
 */
export function createHumanHandoffAgent() {
  return new Agent<AgentContext>({
    name: 'HumanHandoffAgent',
    instructions: PROMPTS.HUMAN_HANDOFF_AGENT,
    model: MODEL_CONFIGS.handoff.name,
    modelSettings: {
      temperature: MODEL_CONFIGS.handoff.temperature,
      maxTokens: MODEL_CONFIGS.handoff.maxTokens,
    },
    // No tools - just formats the handoff message
    tools: [],
  });
}

/**
 * Run the Human Handoff Agent
 */
export async function runHumanHandoffAgent(
  message: string,
  context: AgentContext,
  reason?: string
): Promise<{ text: string; handoff: { link: string; phone: string; reason: string } }> {
  // For handoff, we can use a template response most of the time
  // Only use LLM for complex emotional situations
  
  const isEmotional = /\b(angry|frustrated|disappointed|upset|furious)\b/i.test(message);
  
  let responseText: string;
  
  if (isEmotional) {
    // Use LLM for empathetic response
    const { run } = await import('@openai/agents');
    const agent = createHumanHandoffAgent();
    
    const result = await run(agent, message, {
      context,
    });
    
    responseText = typeof result.finalOutput === 'string' 
      ? result.finalOutput 
      : generateHandoffResponse(reason);
  } else {
    responseText = generateHandoffResponse(reason);
  }
  
  return {
    text: responseText,
    handoff: {
      link: HUMAN_HANDOFF.WHATSAPP_LINK,
      phone: HUMAN_HANDOFF.PHONE,
      reason: reason || 'User requested human support',
    },
  };
}
