// Types for Agent V2 system

import type { AgentInputItem } from '@openai/agents-core';

export interface PaginationState {
  query: string;
  categoryTitle?: string;
  filters: {
    minPrice?: number;
    maxPrice?: number;
    keywords?: string[];
  };
  currentPage: number;
  pageSize: number;
  totalResults: number;
  hasMore: boolean;
}

export interface SessionMetadata {
  userId: string;
  sessionId: string;
  threadId?: string; // Legacy compatibility
  createdAt: Date;
  lastActiveAt: Date;
  totalMessages: number;
  totalTokensUsed: number;
  lastClassification?: string;
  conversationSummary?: string;
}

export interface AgentContext {
  // User info
  userId: string;
  sessionId: string;
  
  // Page context
  pageContext?: string;
  cartItems?: string[];
  
  // State
  paginationState?: PaginationState;
  lastProductResults?: any[];
  lastOrderStatus?: any;
  
  // Metadata
  metadata?: SessionMetadata;
  
  // Custom data
  [key: string]: any;
}

export interface ChatRequest {
  userId: string;
  message: string;
  sessionId?: string;
  metadata?: {
    pageContext?: string;
    cartItems?: string[];
    [key: string]: any;
  };
}

export interface ChatResponse {
  success: boolean;
  sessionId: string;
  message: {
    text: string;
    type: 'text' | 'product_list' | 'order_status' | 'handoff';
    products?: ProductSummary[];
    orderStatus?: OrderStatusSummary;
    handoff?: {
      link: string;
      phone: string;
      reason: string;
    };
  };
  pagination?: {
    hasMore: boolean;
    currentPage: number;
    totalResults: number;
  };
  classification: {
    category: string;
    confidence: number;
  };
  debug?: {
    tokensUsed: number;
    latencyMs: number;
    agentPath: string[];
  };
}

export interface ProductSummary {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  category?: string;
  image?: string;
  slug?: string;
  inStock: boolean;
}

export interface OrderStatusSummary {
  orderId: string;
  status: string;
  expectedDelivery?: string;
  trackUrl?: string;
  steps?: Array<{
    status: string;
    date: string;
    location?: string;
  }>;
}

export interface SessionItem {
  type: 'message' | 'tool_call' | 'tool_result';
  role: 'user' | 'assistant' | 'system';
  content: any;
  timestamp: Date;
  tokenCount?: number;
}

// Re-export AgentInputItem for convenience
export type { AgentInputItem };
