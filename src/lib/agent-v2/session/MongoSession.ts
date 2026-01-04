// MongoDB Session Implementation for Agent V2
import type { AgentInputItem, Session } from '@openai/agents-core';
import { randomUUID } from 'crypto';
import type { SessionMetadata, PaginationState } from '../types';
import { LIMITS } from '../config/constants';

// We'll use dynamic import for MongoDB to work in Next.js
let AssistantSessionV2Model: any = null;

async function getSessionModel() {
  if (!AssistantSessionV2Model) {
    const connectToDb = (await import('@/lib/middleware/connectToDb')).default;
    await connectToDb();
    
    // Dynamic import of model
    try {
      AssistantSessionV2Model = (await import('@/models/AssistantSessionV2')).default;
    } catch {
      // Model doesn't exist yet, create inline schema
      const mongoose = (await import('mongoose')).default;
      
      const sessionSchema = new mongoose.Schema({
        sessionId: { type: String, required: true, unique: true, index: true },
        userId: { type: String, required: true, index: true },
        threadId: { type: String, index: true },
        items: [{
          type: { type: String, enum: ['message', 'tool_call', 'tool_result'] },
          role: { type: String, enum: ['user', 'assistant', 'system'] },
          content: mongoose.Schema.Types.Mixed,
          timestamp: Date,
          tokenCount: Number,
        }],
        metadata: {
          totalMessages: { type: Number, default: 0 },
          totalTokensUsed: { type: Number, default: 0 },
          lastClassification: String,
          conversationSummary: String,
          lastActiveAt: Date,
        },
        pagination: {
          currentPage: { type: Number, default: 1 },
          totalItems: Number,
          hasMore: Boolean,
          lastQuery: mongoose.Schema.Types.Mixed,
        },
      }, { timestamps: true });
      
      AssistantSessionV2Model = mongoose.models.AssistantSessionV2 || 
        mongoose.model('AssistantSessionV2', sessionSchema);
    }
  }
  return AssistantSessionV2Model;
}

/**
 * Clone an AgentInputItem to avoid mutations
 */
function cloneAgentItem(item: AgentInputItem): AgentInputItem {
  return JSON.parse(JSON.stringify(item));
}

/**
 * MongoDB-backed Session implementation for the Agents SDK
 */
export class MongoSession implements Session {
  private sessionId: string;
  private userId: string;
  private items: AgentInputItem[] = [];
  private metadata: SessionMetadata;
  private paginationState?: PaginationState;
  private loaded = false;
  
  constructor(options: {
    sessionId?: string;
    userId: string;
    threadId?: string;
  }) {
    this.sessionId = options.sessionId || randomUUID();
    this.userId = options.userId;
    this.metadata = {
      userId: options.userId,
      sessionId: this.sessionId,
      threadId: options.threadId,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      totalMessages: 0,
      totalTokensUsed: 0,
    };
  }
  
  /**
   * Load session from database if exists
   */
  private async load(): Promise<void> {
    if (this.loaded) return;
    
    try {
      const Model = await getSessionModel();
      const doc = await Model.findOne({ sessionId: this.sessionId }).lean();
      
      if (doc) {
        this.items = (doc.items || []).map((item: any) => ({
          type: item.type || 'message',
          role: item.role,
          content: item.content,
        }));
        this.metadata = {
          ...this.metadata,
          totalMessages: doc.metadata?.totalMessages || 0,
          totalTokensUsed: doc.metadata?.totalTokensUsed || 0,
          lastClassification: doc.metadata?.lastClassification,
          conversationSummary: doc.metadata?.conversationSummary,
          lastActiveAt: doc.metadata?.lastActiveAt || doc.updatedAt,
          createdAt: doc.createdAt,
        };
        this.paginationState = doc.pagination;
      }
    } catch (error) {
      console.error('[MongoSession] Load error:', error);
    }
    
    this.loaded = true;
  }
  
  /**
   * Save session to database
   */
  private async save(): Promise<void> {
    try {
      const Model = await getSessionModel();
      
      await Model.findOneAndUpdate(
        { sessionId: this.sessionId },
        {
          $set: {
            userId: this.userId,
            threadId: this.metadata.threadId,
            items: this.items.map(item => ({
              type: item.type || 'message',
              role: (item as any).role,
              content: (item as any).content,
              timestamp: new Date(),
            })),
            metadata: {
              totalMessages: this.metadata.totalMessages,
              totalTokensUsed: this.metadata.totalTokensUsed,
              lastClassification: this.metadata.lastClassification,
              conversationSummary: this.metadata.conversationSummary,
              lastActiveAt: new Date(),
            },
            pagination: this.paginationState,
          },
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error('[MongoSession] Save error:', error);
    }
  }
  
  // Session interface implementation
  
  async getSessionId(): Promise<string> {
    return this.sessionId;
  }
  
  async getItems(limit?: number): Promise<AgentInputItem[]> {
    await this.load();
    
    if (limit === undefined || limit <= 0) {
      return this.items.map(cloneAgentItem);
    }
    
    // Return last N items
    const start = Math.max(this.items.length - limit, 0);
    return this.items.slice(start).map(cloneAgentItem);
  }
  
  async addItems(items: AgentInputItem[]): Promise<void> {
    await this.load();
    
    if (items.length === 0) return;
    
    this.items = [...this.items, ...items.map(cloneAgentItem)];
    this.metadata.totalMessages += items.length;
    this.metadata.lastActiveAt = new Date();
    
    // Apply context window limit
    if (this.items.length > LIMITS.MAX_CONTEXT_ITEMS * 2) {
      // Keep only recent items, but save summary
      this.items = this.items.slice(-LIMITS.MAX_CONTEXT_ITEMS);
    }
    
    await this.save();
  }
  
  async popItem(): Promise<AgentInputItem | undefined> {
    await this.load();
    
    if (this.items.length === 0) return undefined;
    
    const item = this.items[this.items.length - 1];
    this.items = this.items.slice(0, -1);
    
    await this.save();
    
    return cloneAgentItem(item);
  }
  
  async clearSession(): Promise<void> {
    this.items = [];
    this.metadata.totalMessages = 0;
    this.metadata.conversationSummary = undefined;
    this.paginationState = undefined;
    
    await this.save();
  }
  
  // Custom extensions
  
  async getMetadata(): Promise<SessionMetadata> {
    await this.load();
    return { ...this.metadata };
  }
  
  async updateMetadata(updates: Partial<SessionMetadata>): Promise<void> {
    await this.load();
    this.metadata = { ...this.metadata, ...updates };
    await this.save();
  }
  
  async getPaginationState(): Promise<PaginationState | undefined> {
    await this.load();
    return this.paginationState ? { ...this.paginationState } : undefined;
  }
  
  async setPaginationState(state: PaginationState): Promise<void> {
    await this.load();
    this.paginationState = { ...state };
    await this.save();
  }
  
  async clearPaginationState(): Promise<void> {
    await this.load();
    this.paginationState = undefined;
    await this.save();
  }
}

/**
 * Create or retrieve a session
 */
export async function getOrCreateSession(options: {
  sessionId?: string;
  userId: string;
  threadId?: string;
}): Promise<MongoSession> {
  const session = new MongoSession(options);
  return session;
}
