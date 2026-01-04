# OpenAI Agent Builder V2 - Implementation Plan

## Overview

This document outlines the architecture and implementation plan for migrating our assistant to OpenAI's new Agent SDK. The new system will feature intelligent routing, state management, vector store integration, and robust context handling.

---

## Current System Analysis

### Existing Components
| Component | Location | Purpose |
|-----------|----------|---------|
| Chat Route | `src/app/api/assistant/chat/route.js` | 1451-line monolith handling all chat logic |
| Product Search | `src/lib/assistant/productSearch.js` | Product search with filters, pagination |
| Order Status | `src/lib/assistant/orderStatus.js` | Order tracking functionality |
| Thread Model | `src/models/AssistantThread.js` | Thread persistence |
| Chat Logs | `src/models/AssistantChatLog.js` | Conversation logging |

### Pain Points
1. **Monolithic route** - Single file handling classification, tool calls, and responses
2. **Manual tool orchestration** - Complex function-calling logic scattered throughout
3. **No proper session management** - Thread-based but lacks proper context windowing
4. **Classification inline** - Intent detection mixed with execution logic
5. **No guardrails** - Missing input/output validation

---

## New Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              User Message                                │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         INPUT GUARDRAILS                                 │
│  • Content filtering                                                     │
│  • Rate limiting check                                                   │
│  • Message length validation                                             │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CLASSIFIER AGENT (gpt-4.1-mini)                    │
│                                                                          │
│  Categories:                                                             │
│  ┌────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐   │
│  │ DATA_QUERY │  │ VECTOR_STORE│  │DIRECT_ANSWER│  │ HUMAN_HANDOFF  │   │
│  │  Products  │  │  Company    │  │  Greetings  │  │   Escalation   │   │
│  │  Orders    │  │  FAQs       │  │  Chitchat   │  │   Complaints   │   │
│  │  Inventory │  │  Policies   │  │             │  │                │   │
│  └────────────┘  └─────────────┘  └─────────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┬─────────────────┐
                    ▼                ▼                ▼                 ▼
         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
         │  DATA AGENT  │  │ VECTOR AGENT │  │ DIRECT AGENT │  │HANDOFF AGENT │
         │              │  │              │  │              │  │              │
         │ Tools:       │  │ Tools:       │  │              │  │              │
         │ • search_    │  │ • file_      │  │ (No tools)   │  │ WhatsApp     │
         │   products   │  │   search     │  │              │  │ redirect     │
         │ • get_order  │  │              │  │              │  │              │
         │ • browse_    │  │ Vector Store │  │              │  │              │
         │   categories │  │ ID: VS_XXX   │  │              │  │              │
         └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
                    │                │                │                 │
                    └────────────────┴────────────────┴─────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        OUTPUT GUARDRAILS                                 │
│  • Response length validation                                            │
│  • PII filtering                                                         │
│  • Brand safety check                                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        STATE PERSISTENCE                                 │
│  • MongoDB Session Store                                                 │
│  • Context windowing (last N messages)                                   │
│  • Token budget management                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Components Breakdown

### 1. Classifier Agent

**Purpose**: Route incoming messages to the appropriate handler

**Configuration**:
```typescript
const ClassifierOutput = z.object({
  category: z.enum([
    'DATA_QUERY',      // Products, orders, inventory - needs DB tools
    'VECTOR_STORE',    // FAQs, policies, company info - needs file search
    'DIRECT_ANSWER',   // Greetings, chitchat - no tools needed
    'HUMAN_HANDOFF'    // Escalation, complaints - redirect to WhatsApp
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  extractedIntent: z.object({
    primaryEntity: z.string().optional(),
    action: z.string().optional(),
    constraints: z.record(z.any()).optional()
  }).optional()
});
```

**Model**: `gpt-4.1-mini` (fast + cost-effective for classification)

### 2. Data Query Agent

**Purpose**: Handle product searches, order tracking, category browsing

**Tools**:
| Tool | Description | Parameters |
|------|-------------|------------|
| `search_products` | Search product catalog | query, keywords, categoryTitle, minPrice, maxPrice, sortBy, page, limit |
| `get_order_status` | Track order by ID or phone | orderId, phone |
| `browse_categories` | List available categories | parentCategory |
| `get_shipping_estimate` | Estimate delivery time | pincode, items |

**Model**: `gpt-4.1` (better tool usage)

### 3. Vector Store Agent

**Purpose**: Answer FAQs, policies, company information using file search

**Configuration**:
- Uses OpenAI `file_search` hosted tool
- Vector Store ID: `VS_MADDY_KNOWLEDGE` (to be created)

**Knowledge Base Contents**:
- Company FAQs
- Return/refund policies
- Product care instructions
- Installation guides
- Warranty information
- Shipping policies

**Model**: `gpt-4.1-mini` (retrieval-augmented, less reasoning needed)

### 4. Direct Answer Agent

**Purpose**: Handle greetings, chitchat, simple queries

**Configuration**:
- No tools
- Short, friendly responses
- Brand voice enforcement

**Model**: `gpt-4.1-nano` (fastest, cheapest)

### 5. Human Handoff Agent

**Purpose**: Gracefully redirect to human support

**Configuration**:
- Returns formatted WhatsApp link
- Logs escalation reason
- Preserves conversation context for handoff

---

## State Management

### Session Interface

```typescript
interface MaddySession extends Session {
  // Required by SDK
  getSessionId(): Promise<string>;
  getItems(limit?: number): Promise<AgentInputItem[]>;
  addItems(items: AgentInputItem[]): Promise<void>;
  popItem(): Promise<AgentInputItem | undefined>;
  clearSession(): Promise<void>;
  
  // Custom extensions
  getMetadata(): Promise<SessionMetadata>;
  updateMetadata(updates: Partial<SessionMetadata>): Promise<void>;
}

interface SessionMetadata {
  userId: string;
  threadId: string;
  createdAt: Date;
  lastActiveAt: Date;
  totalMessages: number;
  totalTokensUsed: number;
  lastClassification: string;
  conversationSummary?: string;
}
```

### MongoDB Schema

```javascript
// AssistantSessionV2.js
const sessionSchema = new Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  threadId: { type: String, index: true }, // Legacy compatibility
  
  // Conversation items (AgentInputItem[])
  items: [{
    type: { type: String, enum: ['message', 'tool_call', 'tool_result'] },
    role: { type: String, enum: ['user', 'assistant', 'system'] },
    content: Schema.Types.Mixed,
    timestamp: Date,
    tokenCount: Number
  }],
  
  // Metadata
  metadata: {
    totalMessages: { type: Number, default: 0 },
    totalTokensUsed: { type: Number, default: 0 },
    lastClassification: String,
    conversationSummary: String,
    lastActiveAt: Date
  },
  
  // Pagination state
  pagination: {
    currentPage: { type: Number, default: 1 },
    totalItems: Number,
    hasMore: Boolean,
    lastQuery: Schema.Types.Mixed
  }
}, { timestamps: true });
```

### Context Windowing Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Context Window (4096 tokens)                  │
├─────────────────────────────────────────────────────────────────┤
│  SYSTEM PROMPT (~500 tokens)                                     │
├─────────────────────────────────────────────────────────────────┤
│  CONVERSATION SUMMARY (if > 10 messages) (~200 tokens)          │
├─────────────────────────────────────────────────────────────────┤
│  RECENT MESSAGES (last 5-10 turns) (~2000 tokens)               │
├─────────────────────────────────────────────────────────────────┤
│  CURRENT MESSAGE + CONTEXT (~1000 tokens)                        │
├─────────────────────────────────────────────────────────────────┤
│  BUFFER for response (~400 tokens)                               │
└─────────────────────────────────────────────────────────────────┘
```

**Windowing Rules**:
1. Always include last 5 user-assistant pairs
2. If conversation > 10 messages, generate summary
3. Tool results are truncated after 2 turns
4. Max 10 conversation items in context

---

## Pagination Handling

### Product Search Pagination

```typescript
interface PaginationState {
  query: string;
  categoryTitle?: string;
  filters: {
    minPrice?: number;
    maxPrice?: number;
    keywords?: string[];
  };
  currentPage: number;
  pageSize: number; // Default: 6, Max: 10
  totalResults: number;
  hasMore: boolean;
}
```

**Behavior**:
- Default page size: 6 products
- Max page size: 10 products
- "Show more" continues from last position
- "New search" resets pagination
- Pagination state stored in session

### Pagination Flow

```
User: "Show me bike wraps"
  → search_products(query: "bike wraps", page: 1, limit: 6)
  → Returns 6 products, hasMore: true
  → Store pagination state

User: "Show more"
  → Detect continuation intent
  → search_products(query: "bike wraps", page: 2, limit: 6)
  → Returns next 6 products

User: "Show me something in red"
  → New search detected (different filters)
  → Reset pagination
  → search_products(keywords: ["red"], page: 1, limit: 6)
```

---

## Guardrails

### Input Guardrails

```typescript
const inputGuardrails: InputGuardrail[] = [
  {
    name: 'content_filter',
    runInParallel: false, // Block before processing
    execute: async ({ input }) => {
      // Check for inappropriate content
      // Check message length (max 1000 chars)
      // Rate limit check
      return { tripwireTriggered: false };
    }
  },
  {
    name: 'injection_detector',
    runInParallel: true, // Run alongside
    execute: async ({ input }) => {
      // Detect prompt injection attempts
      return { tripwireTriggered: false };
    }
  }
];
```

### Output Guardrails

```typescript
const outputGuardrails: OutputGuardrail[] = [
  {
    name: 'response_validator',
    execute: async ({ output }) => {
      // Ensure response is not empty
      // Check for hallucinated URLs
      // Verify product IDs exist
      return { tripwireTriggered: false };
    }
  },
  {
    name: 'pii_filter',
    execute: async ({ output }) => {
      // Remove any accidentally exposed PII
      return { tripwireTriggered: false };
    }
  }
];
```

---

## File Structure

```
src/
├── lib/
│   └── agent-v2/
│       ├── index.ts                    # Main exports
│       ├── agents/
│       │   ├── classifier.ts           # Classifier agent
│       │   ├── dataQuery.ts            # Data query agent
│       │   ├── vectorStore.ts          # Vector store agent
│       │   ├── directAnswer.ts         # Direct answer agent
│       │   └── humanHandoff.ts         # Handoff agent
│       ├── tools/
│       │   ├── searchProducts.ts       # Product search tool
│       │   ├── getOrderStatus.ts       # Order tracking tool
│       │   ├── browseCategories.ts     # Category browsing tool
│       │   └── getShippingEstimate.ts  # Shipping estimate tool
│       ├── session/
│       │   ├── MongoSession.ts         # MongoDB session implementation
│       │   ├── sessionManager.ts       # Session lifecycle management
│       │   └── contextWindow.ts        # Context windowing logic
│       ├── guardrails/
│       │   ├── input/
│       │   │   ├── contentFilter.ts
│       │   │   ├── injectionDetector.ts
│       │   │   └── rateLimiter.ts
│       │   └── output/
│       │       ├── responseValidator.ts
│       │       └── piiFilter.ts
│       ├── config/
│       │   ├── prompts.ts              # All system prompts
│       │   ├── models.ts               # Model configurations
│       │   └── constants.ts            # Constants and limits
│       └── utils/
│           ├── tokenCounter.ts         # Token counting
│           ├── logger.ts               # Structured logging
│           └── metrics.ts              # Performance metrics
├── app/
│   └── api/
│       └── assistant/
│           └── v2/
│               └── chat/
│                   └── route.ts        # New API route
└── models/
    └── AssistantSessionV2.js           # New session model
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Install `@openai/agents` and `zod@3`
- [ ] Create folder structure
- [ ] Implement MongoDB Session adapter
- [ ] Create basic classifier agent
- [ ] Set up new API route `/api/assistant/v2/chat`

### Phase 2: Tools Migration (Week 2)
- [ ] Migrate `searchProducts` to Agent SDK tool format
- [ ] Migrate `getOrderStatus` to Agent SDK tool format
- [ ] Implement `browseCategories` tool
- [ ] Create Data Query agent with tools

### Phase 3: Vector Store (Week 3)
- [ ] Create OpenAI Vector Store with knowledge files
- [ ] Upload FAQs, policies, guides
- [ ] Implement Vector Store agent
- [ ] Test retrieval accuracy

### Phase 4: Guardrails & Session (Week 4)
- [ ] Implement input guardrails
- [ ] Implement output guardrails
- [ ] Add context windowing
- [ ] Implement pagination state management

### Phase 5: Integration & Testing (Week 5)
- [ ] Wire all agents together with handoffs
- [ ] Add comprehensive logging
- [ ] Performance testing
- [ ] A/B testing setup (v1 vs v2)

### Phase 6: Rollout (Week 6)
- [ ] Shadow mode (run both, compare)
- [ ] Gradual rollout (10% → 50% → 100%)
- [ ] Deprecate v1 route
- [ ] Documentation

---

## API Contract

### Request

```typescript
POST /api/assistant/v2/chat

interface ChatRequest {
  userId: string;
  message: string;
  sessionId?: string;      // Optional, creates new if not provided
  metadata?: {
    pageContext?: string;  // Current page user is on
    cartItems?: string[];  // Items in cart
    [key: string]: any;
  };
}
```

### Response

```typescript
interface ChatResponse {
  success: boolean;
  sessionId: string;
  message: {
    text: string;
    type: 'text' | 'product_list' | 'order_status' | 'handoff';
    products?: Product[];
    orderStatus?: OrderStatus;
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
```

---

## Environment Variables

```bash
# Existing
OPENAI_API_KEY=sk-...

# New
OPENAI_AGENT_MODEL_CLASSIFIER=gpt-4.1-mini
OPENAI_AGENT_MODEL_DATA=gpt-4.1
OPENAI_AGENT_MODEL_VECTOR=gpt-4.1-mini
OPENAI_AGENT_MODEL_DIRECT=gpt-4.1-nano
OPENAI_VECTOR_STORE_ID=vs_...
AGENT_V2_ENABLED=true
AGENT_V2_ROLLOUT_PERCENT=100
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Avg response time | ~3s | <2s |
| Classification accuracy | ~80% | >95% |
| Tool call success rate | ~90% | >98% |
| Context retention (5 turns) | ~70% | >95% |
| Token cost per conversation | ~$0.05 | ~$0.03 |
| Human handoff rate | 15% | <5% |

---

## Rollback Plan

1. **Feature flag**: `AGENT_V2_ENABLED=false` instantly reverts
2. **A/B routing**: Can route specific users to v1
3. **Database compatibility**: v2 sessions don't affect v1 threads
4. **API versioning**: v1 route remains unchanged

---

## Next Steps

1. **Review this plan** - Get team approval
2. **Create Vector Store** - Upload knowledge base files
3. **Start Phase 1** - Foundation setup
4. **Set up monitoring** - Add dashboards for new metrics

---

## References

- [OpenAI Agents SDK Documentation](https://platform.openai.com/docs/agents)
- [Current Implementation](../src/app/api/assistant/chat/route.js)
- [Product Search](../src/lib/assistant/productSearch.js)
- [Order Status](../src/lib/assistant/orderStatus.js)
