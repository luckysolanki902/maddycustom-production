// Main Agent Orchestrator - Routes messages through the agent pipeline
import { classifyMessage, type ClassifierOutput } from './agents/classifier';
import { runDataQueryAgent } from './agents/dataQuery';
import { runVectorStoreAgent } from './agents/vectorStore';
import { runDirectAnswerAgent, getQuickResponse } from './agents/directAnswer';
import { runHumanHandoffAgent } from './agents/humanHandoff';
import { getOrCreateSession, MongoSession } from './session/MongoSession';
import { CLASSIFICATION_CATEGORIES, LIMITS } from './config/constants';
import type { AgentContext, ChatRequest, ChatResponse, AgentInputItem } from './types';

interface OrchestratorOptions {
  debug?: boolean;
}

/**
 * Main orchestrator that handles the full chat pipeline
 */
export async function orchestrateChat(
  request: ChatRequest,
  options: OrchestratorOptions = {}
): Promise<ChatResponse> {
  const startTime = Date.now();
  const agentPath: string[] = [];
  
  // Initialize session
  const session = await getOrCreateSession({
    sessionId: request.sessionId,
    userId: request.userId,
  });
  
  const sessionId = await session.getSessionId();
  const metadata = await session.getMetadata();
  
  // Build context
  const context: AgentContext = {
    userId: request.userId,
    sessionId,
    pageContext: request.metadata?.pageContext,
    cartItems: request.metadata?.cartItems,
    metadata,
  };
  
  // Load pagination state if exists
  const existingPagination = await session.getPaginationState();
  if (existingPagination) {
    context.paginationState = existingPagination;
  }
  
  try {
    // Step 1: Quick response check (no LLM needed)
    const quickResponse = getQuickResponse(request.message);
    if (quickResponse) {
      agentPath.push('quick_response');
      
      // Save to session
      await session.addItems([
        createUserItem(request.message),
        createAssistantItem(quickResponse),
      ]);
      
      return {
        success: true,
        sessionId,
        message: {
          text: quickResponse,
          type: 'text',
        },
        classification: {
          category: CLASSIFICATION_CATEGORIES.DIRECT_ANSWER,
          confidence: 1.0,
        },
        debug: options.debug ? {
          tokensUsed: 0,
          latencyMs: Date.now() - startTime,
          agentPath,
        } : undefined,
      };
    }
    
    // Step 2: Classify the message
    agentPath.push('classifier');
    const classification = await classifyMessage(request.message, {
      previousClassification: metadata.lastClassification as any,
      conversationLength: metadata.totalMessages,
    });
    
    // Update session metadata
    await session.updateMetadata({
      lastClassification: classification.category,
    });
    
    // Step 3: Route to appropriate agent
    let result: { text: string; products?: any[]; orderStatus?: any; handoff?: any; hasMore?: boolean };
    
    switch (classification.category) {
      case CLASSIFICATION_CATEGORIES.DATA_QUERY:
        agentPath.push('data_query_agent');
        result = await runDataQueryAgent(request.message, context);
        break;
        
      case CLASSIFICATION_CATEGORIES.VECTOR_STORE:
        agentPath.push('vector_store_agent');
        result = await runVectorStoreAgent(request.message, context);
        break;
        
      case CLASSIFICATION_CATEGORIES.HUMAN_HANDOFF:
        agentPath.push('human_handoff_agent');
        result = await runHumanHandoffAgent(
          request.message, 
          context, 
          classification.reasoning
        );
        break;
        
      case CLASSIFICATION_CATEGORIES.DIRECT_ANSWER:
      default:
        agentPath.push('direct_answer_agent');
        result = await runDirectAnswerAgent(request.message, context);
        break;
    }
    
    // Step 4: Save conversation to session
    await session.addItems([
      createUserItem(request.message),
      createAssistantItem(result.text),
    ]);
    
    // Update pagination state if changed
    if (context.paginationState) {
      await session.setPaginationState(context.paginationState);
    }
    
    // Step 5: Build response
    const messageType = result.products?.length 
      ? 'product_list' 
      : result.orderStatus 
        ? 'order_status'
        : result.handoff 
          ? 'handoff'
          : 'text';
    
    return {
      success: true,
      sessionId,
      message: {
        text: result.text,
        type: messageType,
        products: result.products,
        orderStatus: result.orderStatus,
        handoff: result.handoff,
      },
      pagination: context.paginationState ? {
        hasMore: context.paginationState.hasMore,
        currentPage: context.paginationState.currentPage,
        totalResults: context.paginationState.totalResults,
      } : undefined,
      classification: {
        category: classification.category,
        confidence: classification.confidence,
      },
      debug: options.debug ? {
        tokensUsed: 0, // TODO: Track actual token usage
        latencyMs: Date.now() - startTime,
        agentPath,
      } : undefined,
    };
    
  } catch (error) {
    console.error('[orchestrateChat] Error:', error);
    
    // Return error response
    return {
      success: false,
      sessionId,
      message: {
        text: "I'm sorry, I encountered an error. Please try again or contact our support at https://wa.me/918112673988",
        type: 'text',
      },
      classification: {
        category: CLASSIFICATION_CATEGORIES.DIRECT_ANSWER,
        confidence: 0,
      },
      debug: options.debug ? {
        tokensUsed: 0,
        latencyMs: Date.now() - startTime,
        agentPath,
      } : undefined,
    };
  }
}

/**
 * Create a user message item
 */
function createUserItem(text: string): AgentInputItem {
  return {
    type: 'message',
    role: 'user',
    content: [{ type: 'input_text', text }],
  } as AgentInputItem;
}

/**
 * Create an assistant message item
 */
function createAssistantItem(text: string): AgentInputItem {
  return {
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text }],
  } as AgentInputItem;
}

// Export everything
export { classifyMessage } from './agents/classifier';
export { runDataQueryAgent } from './agents/dataQuery';
export { runVectorStoreAgent } from './agents/vectorStore';
export { runDirectAnswerAgent } from './agents/directAnswer';
export { runHumanHandoffAgent } from './agents/humanHandoff';
export { getOrCreateSession, MongoSession } from './session/MongoSession';
export * from './config/constants';
export * from './types';
