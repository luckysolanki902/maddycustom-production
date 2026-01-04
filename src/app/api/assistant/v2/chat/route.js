// Agent V2 Chat API Route
import { NextResponse } from 'next/server';
import { orchestrateChat } from '@/lib/agent-v2/index.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/assistant/v2/chat
 * 
 * New agent-based chat endpoint using OpenAI Agents SDK
 */
export async function POST(request) {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }
    
    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'message is required and must be a string' },
        { status: 400 }
      );
    }
    
    // Trim and validate message length
    const message = body.message.trim();
    if (message.length === 0) {
      return NextResponse.json(
        { success: false, error: 'message cannot be empty' },
        { status: 400 }
      );
    }
    
    if (message.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'message exceeds maximum length of 1000 characters' },
        { status: 400 }
      );
    }
    
    // Build chat request
    const chatRequest = {
      userId: body.userId,
      message,
      sessionId: body.sessionId,
      metadata: body.metadata,
    };
    
    // Check for debug mode
    const debug = request.headers.get('x-debug') === 'true';
    
    // Check for dry-run mode (for testing)
    const dryRun = request.headers.get('x-dry-run') === 'true';
    
    if (dryRun) {
      // Return mock response for testing
      return NextResponse.json({
        success: true,
        sessionId: chatRequest.sessionId || 'dry-run-session',
        message: {
          text: `[DRY RUN] Would process: "${message}"`,
          type: 'text',
        },
        classification: {
          category: 'DATA_QUERY',
          confidence: 0.9,
        },
        debug: {
          tokensUsed: 0,
          latencyMs: Date.now() - startTime,
          agentPath: ['dry_run'],
        },
      });
    }
    
    // Process through orchestrator
    const response = await orchestrateChat(chatRequest, { debug });
    
    // Return response
    return NextResponse.json(response, {
      status: response.success ? 200 : 500,
      headers: {
        'X-Response-Time': `${Date.now() - startTime}ms`,
      },
    });
    
  } catch (error) {
    console.error('[/api/assistant/v2/chat] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: {
          text: "I'm sorry, something went wrong. Please try again.",
          type: 'text',
        },
      },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${Date.now() - startTime}ms`,
        },
      }
    );
  }
}

/**
 * GET /api/assistant/v2/chat
 * 
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: 'v2',
    features: [
      'classifier',
      'data_query',
      'vector_store',
      'direct_answer',
      'human_handoff',
      'session_management',
      'pagination',
    ],
  });
}
