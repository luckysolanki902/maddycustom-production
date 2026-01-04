// Main Agent Orchestrator - Routes messages through the agent pipeline
// NO regex shortcuts - everything goes through the classifier LLM
import { classifyMessage } from './agents/classifier.js';
import { runDataQueryAgent } from './agents/dataQuery.js';
import { runVectorStoreAgent } from './agents/vectorStore.js';
import { runDirectAnswerAgent } from './agents/directAnswer.js';
import { runHumanHandoffAgent } from './agents/humanHandoff.js';
import { getOrCreateSession, MongoSession } from './session/MongoSession.js';
import { CLASSIFICATION_CATEGORIES, LIMITS } from './config/constants.js';

/**
 * Main orchestrator that handles the full chat pipeline
 * ALL messages go through the classifier - no shortcuts
 * @param {object} request - Chat request with userId, message, sessionId, metadata
 * @param {object} options - Options like debug mode
 * @returns {Promise<object>} Chat response
 */
export async function orchestrateChat(request, options = {}) {
  const startTime = Date.now();
  const agentPath = [];
  
  // Initialize session
  const session = await getOrCreateSession({
    sessionId: request.sessionId,
    userId: request.userId,
  });
  
  const sessionId = await session.getSessionId();
  const metadata = await session.getMetadata();
  
  // Build context
  const context = {
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
    // Step 1: Classify the message through LLM (no quick shortcuts)
    agentPath.push('classifier');
    const classification = await classifyMessage(request.message, {
      previousClassification: metadata.lastClassification,
      conversationLength: metadata.totalMessages,
    });
    
    // Update session metadata
    await session.updateMetadata({
      lastClassification: classification.category,
    });
    
    // Step 2: Route to appropriate agent based on classification
    let result;
    
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
    
    // Step 3: Save conversation to session
    await session.addItems([
      createUserItem(request.message),
      createAssistantItem(result.text),
    ]);
    
    // Update pagination state if changed
    if (context.paginationState) {
      await session.setPaginationState(context.paginationState);
    }
    
    // Step 4: Build response
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
 * @param {string} text
 * @returns {object}
 */
function createUserItem(text) {
  return {
    type: 'message',
    role: 'user',
    content: [{ type: 'input_text', text }],
  };
}

/**
 * Create an assistant message item
 * @param {string} text
 * @returns {object}
 */
function createAssistantItem(text) {
  return {
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text }],
  };
}

// Export everything
export { classifyMessage } from './agents/classifier.js';
export { runDataQueryAgent } from './agents/dataQuery.js';
export { runVectorStoreAgent } from './agents/vectorStore.js';
export { runDirectAnswerAgent } from './agents/directAnswer.js';
export { runHumanHandoffAgent } from './agents/humanHandoff.js';
export { getOrCreateSession, MongoSession } from './session/MongoSession.js';
export * from './config/constants.js';
