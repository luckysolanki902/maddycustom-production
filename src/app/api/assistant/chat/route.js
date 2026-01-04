import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import connectToDb from '@/lib/middleware/connectToDb';
import AssistantThread from '@/models/AssistantThread';
import UserMessage from '@/models/UserMessage';
import { searchProducts, categoryFirstSuggestions } from '@/lib/assistant/productSearch';
import { getOrderStatus } from '@/lib/assistant/orderStatus';
import { store } from '@/store';
import { performance } from 'node:perf_hooks';
import { fetchDisplayAssets } from '@/lib/utils/fetchutils';
import AssistantChatLog from '@/models/AssistantChatLog';
import { randomUUID } from 'node:crypto';

// Tag marker for internal knowledge messages we do NOT expose to UI
const INTERNAL_KNOWLEDGE_TAG = '__INTERNAL_KNOWLEDGE__';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const HUMAN_HANDOFF_LINK = 'https://wa.me/918112673988';
const HUMAN_HANDOFF_PHONE = '8112673988';
// Lightweight server-side cache that survives warm serverless invocations on Vercel
// Use global to persist between calls; each entry { data, ts, ttl }
function getCache() {
  if (!global.__TEMP_CACHE) global.__TEMP_CACHE = Object.create(null);
  return global.__TEMP_CACHE;
}
function getCached(key) {
  const cache = getCache();
  const it = cache[key];
  if (!it) return null;
  if (typeof it.ttl === 'number' && Date.now() - it.ts > it.ttl) {
    delete cache[key];
    return null;
  }
  return it.data;
}
function setCached(key, data, ttlMs) {
  const cache = getCache();
  cache[key] = { data, ts: Date.now(), ttl: typeof ttlMs === 'number' ? ttlMs : 0 };
}

const GPT_REPLY_CHAR_LIMIT = 200;
const HISTORY_CHAR_LIMIT = 2000; // Higher limit for conversation history (needs to include full product lists)

const truncateText = (value, limit = GPT_REPLY_CHAR_LIMIT) => {
  if (value === undefined || value === null) return '';
  const str = String(value);
  return str.length > limit ? str.slice(0, limit) : str;
};

const pruneToolArgs = (tool, args = {}) => {
  if (!args || typeof args !== 'object') return undefined;
  const cleaned = {};
  if (args.query) cleaned.query = truncateText(args.query, 120);
  if (args.categoryTitle) cleaned.categoryTitle = truncateText(args.categoryTitle, 80);
  if (Array.isArray(args.keywords) && args.keywords.length) {
    cleaned.keywords = args.keywords.slice(0, 5).map(k => truncateText(k, 40));
  }
  if (args.maxPrice !== undefined) cleaned.maxPrice = Number(args.maxPrice);
  if (args.minPrice !== undefined) cleaned.minPrice = Number(args.minPrice);
  if (args.sortBy) cleaned.sortBy = args.sortBy;
  if (args.page !== undefined) cleaned.page = Number(args.page);
  if (args.limit !== undefined) cleaned.limit = Number(args.limit);
  if (tool === 'get_order_status' && args.orderId) {
    cleaned.orderId = truncateText(args.orderId, 40);
  }
  if (tool === 'get_order_status' && args.phone) {
    cleaned.phone = truncateText(args.phone, 20);
  }
  if (tool === 'search_products' && typeof args.diversifyCategories === 'boolean') {
    cleaned.diversifyCategories = args.diversifyCategories;
  }
  return Object.keys(cleaned).length ? cleaned : undefined;
};

const summarizeToolResult = (tool, result = {}) => {
  if (!result || typeof result !== 'object') return undefined;
  if (tool === 'search_products') {
    return {
      count: Array.isArray(result.products) ? result.products.length : 0,
      hasMore: !!result.hasMore,
      query: result?.queryEcho?.query || null,
      category: result?.queryEcho?.categoryTitle || null
    };
  }
  if (tool === 'get_order_status') {
    return {
      orderId: result?.orderId || null,
      status: result?.status || null,
      eta: result?.expectedDelivery || null,
      trackUrl: result?.trackUrl || null,
      lookup: result?.lookup || null
    };
  }
  if (tool === 'browse_categories') {
    return {
      title: result?.title || null,
      count: Array.isArray(result?.items) ? result.items.length : 0
    };
  }
  return undefined;
};

// All message handling (including greetings) goes through GPT - no regex shortcuts

const makeUserEntry = (text) => ({
  role: 'user',
  kind: 'text',
  messageType: 'text',
  text: truncateText(text, 500),
  timestamp: new Date()
});

const makeAssistantEntry = (text, extras = {}) => ({
  role: 'assistant',
  kind: extras.kind || 'text',
  messageType: extras.messageType || 'text',
  text: truncateText(text, HISTORY_CHAR_LIMIT), // Use higher limit for history storage
  structuredData: extras.structuredData || null,
  handoff: extras.handoff || undefined,
  meta: extras.meta,
  timestamp: new Date()
});

const makeToolEntry = (toolName, args, summary) => ({
  role: 'tool',
  kind: 'tool',
  toolName,
  toolArgs: args,
  toolSummary: summary,
  timestamp: new Date()
});

const makeClassificationEntry = (classification) => ({
  role: 'assistant',
  kind: 'classification',
  classification,
  timestamp: new Date()
});

const roundMs = (value) => Number(value.toFixed(2));

const CLASSIFICATION_DEFAULTS = {
  search_products: {
    type: 'browse',
    needsResolutionCheck: false,
    category: 'browse',
    subcategory: 'product_search'
  },
  browse_categories: {
    type: 'browse',
    needsResolutionCheck: false,
    category: 'browse',
    subcategory: 'category_browse'
  },
  get_order_status: {
    type: 'query',
    needsResolutionCheck: true,
    category: 'order_status',
    subcategory: 'tracking'
  }
};

const normalizeClassification = (value) => {
  if (!value || typeof value !== 'object') return null;
  const type = typeof value.type === 'string' ? value.type.trim().toLowerCase() : '';
  if (!['browse', 'query', 'general'].includes(type)) return null;
  const category = typeof value.category === 'string' ? value.category.trim() : '';
  if (!category) return null;
  const normalized = {
    type,
    category,
    needsResolutionCheck: typeof value.needsResolutionCheck === 'boolean' ? value.needsResolutionCheck : false
  };
  if (typeof value.subcategory === 'string' && value.subcategory.trim()) {
    normalized.subcategory = value.subcategory.trim();
  }
  return normalized;
};

const classificationForTool = (tool) => {
  const preset = CLASSIFICATION_DEFAULTS[tool];
  if (!preset) return null;
  return { ...preset };
};

// All search argument building handled by GPT planner - no manual heuristics

const createTimeline = () => {
  const start = performance.now();
  const marks = [{ stage: 'request_received', elapsedMs: 0 }];
  const mark = (stage, extra = {}) => {
    const now = performance.now();
    const entry = { stage, elapsedMs: roundMs(now - start), ...extra };
    marks.push(entry);
    return entry;
  };
  const summary = () => ({
    totalMs: roundMs(performance.now() - start),
    timeline: marks
  });
  return { mark, summary };
};

const logTimings = ({ userId, threadId, plannerMode }, summary) => {
  if (!summary) return;
  try {
    console.log('[assistant-timings]', JSON.stringify({ userId, threadId, plannerMode, ...summary }));
  } catch (err) {
    console.error('Failed to log assistant timings', err);
  }
};

async function recordChatLog({ userId, threadId, entries }) {
  if (!userId || !threadId || !Array.isArray(entries) || entries.length === 0) return;
  const Model =
    (AssistantChatLog && typeof AssistantChatLog.findOneAndUpdate === 'function')
      ? AssistantChatLog
      : (AssistantChatLog?.default && typeof AssistantChatLog.default.findOneAndUpdate === 'function')
        ? AssistantChatLog.default
        : null;
  if (!Model) {
    console.warn('AssistantChatLog model unavailable; skipping log persistence');
    return;
  }
  try {
    await Model.findOneAndUpdate(
      { userId, threadId },
      {
        $setOnInsert: { userId, threadId, sessionId: threadId },
        $push: { messages: { $each: entries } }
      },
      { upsert: true, new: false }
    );
  } catch (err) {
    console.error('Failed to record chat log', err);
  }
}

const formatINR = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
};

const summarizeProducts = ({ input = {}, output = {} }) => {
  // Return empty - let GPT generate contextual summaries based on the search
  return '';
};

const summarizeCategories = ({ output = {} }) => {
  // Return empty - let GPT generate contextual summaries
  return '';
};

const summarizeOrderStatus = ({ output = {} }) => {
  if (!output) return '';
  // If payment pending or failed, error is already set
  if (output.paymentPending) {
    return 'No confirmed order found. The payment may not have been completed. Please share your order ID, phone number, or email used to place the order so I can check.';
  }
  if (output.paymentFailed) {
    return 'Payment for this order failed. Please try placing the order again or contact support.';
  }
  // If no order found
  if (output.ok === false) {
    return 'I could not find an order with those details. Please share your order ID, phone number, or email used to place the order.';
  }
  const status = output.status || 'Processing';
  const eta = output.expectedDelivery ? ` ETA: ${output.expectedDelivery}.` : '';
  const track = output.trackUrl ? ` Track it here: ${output.trackUrl}` : '';
  return `Your order status: ${status}.${eta}${track} Let me know if you need anything else.`;
};

// Small helper: compose a concise, user-facing reply for tool outputs without an extra model hop
function composeToolReply({ kind, input, output }) {
  if (kind === 'search_products') {
    return summarizeProducts({ input, output });
  }
  if (kind === 'browse_categories') {
    return summarizeCategories({ output });
  }
  if (kind === 'get_order_status') {
    return summarizeOrderStatus({ output });
  }
  return '';
}

// Classify the user's last message to decide if we should show a resolution check
async function classifyUserMessage({ text, tool }) {
  try {
    if (!text && !tool) return null;
    // Heuristics for known tools
    if (tool === 'browse_categories' || tool === 'search_products') {
      return { type: 'browse', needsResolutionCheck: false, category: 'browse', subcategory: '' };
    }
    if (tool === 'get_order_status') {
      return { type: 'query', needsResolutionCheck: true, category: 'order_status', subcategory: 'tracking' };
    }
    const system = 'Classify the user message into browse vs query and suggest a category/subcategory. Return compact JSON only.';
    const prompt = `Message: ${text || ''}
Return JSON with keys: type ('browse'|'query'), needsResolutionCheck (boolean), category (one of: order_status, shipping_time, product_quality, sizing_help, returns_policy, payment_issue, general, browse, customer_support), subcategory (string, optional).
- If the user asks for a human agent, WhatsApp support, real person, or any handoff to a teammate, set needsResolutionCheck to false, category to customer_support, and subcategory to human_handoff.
- Keep needsResolutionCheck false for chit-chat or acknowledgements.`;
    const resp = await client.chat.completions.create({
      model: 'gpt-4.1-nano',
      max_completion_tokens: 500,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ]
    });
    const raw = resp.choices?.[0]?.message?.content || '{}';
    try { return JSON.parse(raw); } catch { return null; }
  } catch {
    return null;
  }
}

// Rule-based planner (for tests/offline): produce a plan without calling OpenAI
function ruleBasedPlan(msg) {
  const raw = msg || '';
  const text = raw.toLowerCase();
  const plan = { action: 'direct_answer', reason: 'default', classification: null };
  if (!text.trim()) return plan;

  // Lightweight: only order tracking signal in rule mode, everything else to LLM in prod
  const hexId = (text.match(/\b[a-f0-9]{24}\b/i) || [])[0];
  const mentionsOrder = /\border\b|\btrack\b|\btracking\b/.test(text);
  const phoneMatch = (text.match(/\b\+?\d{10,13}\b/) || [])[0];
  const phoneDigits = phoneMatch ? phoneMatch.replace(/\D/g, '') : '';
  if (mentionsOrder && hexId) {
    return {
      action: 'call_tool',
      tool: 'get_order_status',
      args: { orderId: hexId },
      reason: 'Order tracking by id',
      classification: classificationForTool('get_order_status')
    };
  }
  if (mentionsOrder && phoneDigits && phoneDigits.length >= 10 && !hexId) {
    return {
      action: 'call_tool',
      tool: 'get_order_status',
      args: { phone: phoneDigits.slice(-10) },
      reason: 'Order tracking by phone',
      classification: classificationForTool('get_order_status')
    };
  }
  // Everything else: generic browse to categories (safe default) in rule mode
  return {
    action: 'call_tool',
    tool: 'browse_categories',
    args: {},
    reason: 'Rule mode default to categories; LLM handles in production',
    classification: classificationForTool('browse_categories')
  };
}

async function fetchCategoriesInfoCached() {
  const CACHE_KEY = 'categories-info';
  const cached = getCached(CACHE_KEY);
  if (cached) {
    return cached;
  }
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/assistant/categories-info`, { cache: 'no-store' });
  if (!res.ok) throw new Error('categories-info fetch failed');
  const data = await res.json();
  // Cache for 24h to align with requirement
  setCached(CACHE_KEY, data, 24 * 60 * 60 * 1000);
  return data;
}

const INSTRUCTIONS_TTL_MS = 30 * 60 * 1000;

const buildInstructionString = (helpingData) => `You are the official support assistant for MaddyCustom. Use the following domain knowledge about products, wraps, installation, shipping, durability, fragrance variants, JDM keychains, ordering & tracking.

CRITICAL: NEVER fabricate or make up prices, product names, or availability. If asked about specific products or prices, say you need to look them up (the system will use search tools). Only state prices that were provided by the actual product search results shown in the conversation.

Be concise, friendly, respectful and avoid markdown formatting. When the user asks for a human agent, real person, WhatsApp support, or similar handoff, do NOT drop a link immediately. Instead say: "I can redirect you to our human team on WhatsApp (${HUMAN_HANDOFF_PHONE}). Would you like me to open it?" and wait for a clear Yes before sharing ${HUMAN_HANDOFF_LINK}. Domain Knowledge:\n\n${helpingData}`;

const FALLBACK_INSTRUCTIONS = `You are the official support assistant for MaddyCustom. Use your knowledge about products, wraps, installation, shipping, durability, fragrance variants, JDM keychains, ordering & tracking.

CRITICAL: NEVER fabricate or make up prices, product names, or availability. If asked about specific products or prices, say you need to look them up. Only state prices from actual product search results.

Be concise, friendly, respectful and avoid markdown formatting. When the user asks for a human agent, real person, WhatsApp support, or similar handoff, do NOT drop a link immediately. Instead say: "I can redirect you to our human team on WhatsApp (${HUMAN_HANDOFF_PHONE}). Would you like me to open it?" and wait for a clear Yes before sharing ${HUMAN_HANDOFF_LINK}.`;

async function getAssistantInstructions() {
  const now = Date.now();
  const cached = global.__ASSISTANT_INSTRUCTIONS_CACHE;
  if (cached && now - cached.ts < INSTRUCTIONS_TTL_MS) {
    return cached.value;
  }
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/assistant/helping-data`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('helping-data fetch failed');
    const { helpingData } = await res.json();
    const instructions = buildInstructionString(helpingData || '');
    global.__ASSISTANT_INSTRUCTIONS_CACHE = { value: instructions, ts: now };
    return instructions;
  } catch (error) {
    console.error('Failed to fetch helping data:', error);
    global.__ASSISTANT_INSTRUCTIONS_CACHE = { value: FALLBACK_INSTRUCTIONS, ts: now };
    return FALLBACK_INSTRUCTIONS;
  }
}

async function ensureAssistantSession(userId) {
  let doc = await AssistantThread.findOne({ userId });
  let newSession = false;
  if (!doc) {
    doc = new AssistantThread({ userId, threadId: randomUUID() });
    await doc.save();
    newSession = true;
  } else if (!doc.threadId) {
    doc.threadId = randomUUID();
    await doc.save();
    newSession = true;
  }
  return {
    doc,
    threadId: doc.threadId,
    previousResponseId: doc.responseId || null,
    newSession,
  };
}

export async function GET(request) {
  try {
    const url = request.nextUrl;
    const userId = url.searchParams.get("userId");
    await connectToDb();
    if (!userId) {
      return NextResponse.json({ messages: [], threadId: null });
    }

    const session = await AssistantThread.findOne({ userId }).lean();
    const threadId = session?.threadId || null;
    if (!threadId) {
      return NextResponse.json({ messages: [], threadId: null });
    }

    const log = await AssistantChatLog.findOne({ userId, threadId }).lean();
    const ordered = (log?.messages || []).slice().sort((a, b) => {
      const at = new Date(a.timestamp || 0).getTime();
      const bt = new Date(b.timestamp || 0).getTime();
      return at - bt;
    });
    
    // Restore both text messages and structured messages (product_gallery, category_grid, order_status)
    const messages = ordered
      .filter(entry => (entry.role === 'user' || entry.role === 'assistant'))
      .map(entry => {
        const baseMsg = {
          id: `${entry.role}-${new Date(entry.timestamp || Date.now()).getTime()}`,
          role: entry.role,
          created_at: new Date(entry.timestamp || Date.now()).toISOString(),
        };
        
        // Check for structured message types
        if (entry.messageType && entry.messageType !== 'text' && entry.structuredData) {
          const data = entry.structuredData;
          if (entry.messageType === 'product_gallery') {
            return {
              ...baseMsg,
              type: 'product_gallery',
              products: data.products || [],
              queryEcho: data.queryEcho || null,
              hasMore: data.hasMore || false,
              summary: data.summary || entry.text || null,
            };
          }
          if (entry.messageType === 'category_grid') {
            return {
              ...baseMsg,
              type: 'category_grid',
              title: data.title || 'Shop by Category',
              items: data.items || [],
              hint: data.hint || null,
              summary: data.summary || entry.text || null,
            };
          }
          if (entry.messageType === 'order_status') {
            return {
              ...baseMsg,
              type: 'order_status',
              orderId: data.orderId,
              status: data.status,
              eta: data.eta || data.expectedDelivery,
              trackUrl: data.trackUrl,
              steps: data.steps || [],
              orderedAt: data.orderedAt,
              contactName: data.contactName,
              contactPhone: data.contactPhone,
              deliveryAddress: data.deliveryAddress,
              payment: data.payment,
              items: data.items || [],
              isMultiOrder: data.isMultiOrder,
              linkedOrders: data.linkedOrders || [],
              paymentFailed: data.paymentFailed,
              paymentPending: data.paymentPending,
            };
          }
        }
        
        // Default text message
        if (!entry.text) return null;
        return { ...baseMsg, text: entry.text || '' };
      })
      .filter(Boolean);

    return NextResponse.json({ messages, threadId });
  } catch (err) {
    console.error("Failed to fetch chat history", err);
    return NextResponse.json({ error: "Failed to fetch chat history" }, { status: 500 });
  }
}


export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured.' }, { status: 500 });
    }

    const timeline = createTimeline();
    const body = await request.json().catch(() => ({}));
    timeline.mark('body_parsed');
    const { action, message, userId, toolInvocation, pageContext } = body || {};

    await connectToDb();
    timeline.mark('db_connected');

    // Reset: remove mapping for userId
    if (action === 'reset') {
      if (!userId) {
        timeline.mark('validation_failed', { reason: 'missing_userId_for_reset' });
        timeline.mark('response_ready');
        const timings = timeline.summary();
        logTimings({ userId: null, threadId: null, plannerMode: 'reset' }, timings);
        return NextResponse.json({ error: 'userId required for reset', timings }, { status: 400 });
      }
      try {
        await AssistantThread.deleteOne({ userId });
        timeline.mark('reset_completed');
        timeline.mark('response_ready');
        const timings = timeline.summary();
        logTimings({ userId, threadId: null, plannerMode: 'reset' }, timings);
        return NextResponse.json({ ok: true, timings });
      } catch (err) {
        console.error('Failed to reset mapping', err);
        timeline.mark('reset_failed');
        timeline.mark('response_ready');
        const timings = timeline.summary();
        logTimings({ userId, threadId: null, plannerMode: 'reset' }, timings);
        return NextResponse.json({ error: 'Failed to reset mapping', timings }, { status: 500 });
      }
    }

    if (!userId) {
      timeline.mark('validation_failed', { reason: 'missing_userId' });
      timeline.mark('response_ready');
      const timings = timeline.summary();
      logTimings({ userId: null, threadId: null, plannerMode: 'validation' }, timings);
      return NextResponse.json({ error: 'userId required in POST body', timings }, { status: 400 });
    }

    // Allow tool calls without a free-form message
    if (!message && !(action && action.startsWith('tool:'))) {
      timeline.mark('validation_failed', { reason: 'missing_message' });
      timeline.mark('response_ready');
      const timings = timeline.summary();
      logTimings({ userId, threadId: null, plannerMode: 'validation' }, timings);
      return NextResponse.json({ error: 'message required', timings }, { status: 400 });
    }

    // Build a plannerMessage for unified LLM-first flow
    let plannerMessage = message || '';
    if (action && action.startsWith('tool:')) {
      // Synthesize a natural prompt from explicit tool call WITHOUT adding heuristics
      if (action === 'tool:search_products') {
        const q = toolInvocation?.query;
        plannerMessage = (typeof q === 'string' && q.trim()) ? q.trim() : 'search products';
      } else if (action === 'tool:get_order_status') {
        const id = toolInvocation?.orderId || '';
        const phoneDigits = toolInvocation?.phone ? String(toolInvocation.phone).replace(/\D/g, '') : '';
        if (id) {
          plannerMessage = `track order ${id}`;
        } else if (phoneDigits) {
          plannerMessage = `track order linked to phone ${phoneDigits}`;
        } else {
          plannerMessage = 'track my order';
        }
      }
    }
    timeline.mark('input_normalized');

    // Ensure local session exists for conversation continuity
    const { doc: sessionDoc, threadId, previousResponseId, newSession } = await ensureAssistantSession(userId);
    timeline.mark('session_ready', { newSession });

    // Load conversation history for context (last 20 messages)
    let conversationHistory = [];
    try {
      const chatLog = await AssistantChatLog.findOne({ userId, threadId }).lean();
      if (chatLog?.messages?.length) {
        const recent = chatLog.messages
          .filter(m => (m.role === 'user' || m.role === 'assistant') && m.text)
          .slice(-20)
          .map(m => ({ role: m.role, content: m.text }));
        conversationHistory = recent;
      }
    } catch (e) {
      console.error('Failed to load conversation history', e);
    }
    console.log('[DEBUG] Conversation history loaded:', conversationHistory.map(m => ({ role: m.role, preview: m.content?.substring(0, 100) })));
    timeline.mark('history_loaded', { messageCount: conversationHistory.length });

    // Deprecated explicit tool endpoints removed; the synthesized plannerMessage above ensures single-path flow

    // Single-path flow: do not short-circuit; planner handles order status too

    // 1) Ask GPT (planner) whether to call a function or answer directly
    const plannerMode = request.headers.get('x-planner-mode') || 'llm'; // 'llm' | 'rule'
    const dryRun = request.headers.get('x-dry-run') === 'true'; // when true return only plan
    const plannerInput = (plannerMessage && typeof plannerMessage === 'string' && plannerMessage.trim()) ? plannerMessage.trim() : '';
    const messageForThread = plannerInput || 'Help';

    const baseEntries = [];
    const userLogText = (typeof message === 'string' && message.trim()) ? message.trim() : plannerInput;
    if (userLogText) {
      baseEntries.push(makeUserEntry(userLogText));
    }
    if (typeof message === 'string' && message.trim()) {
      UserMessage.create({ userId, message: message.trim() }).catch(err => console.error('Failed to save user message', err));
    }

    // Provide categories overview to the planner for robust category selection
    let categoriesSummary = 'CATEGORIES:\n';
    try {
      const catInfo = await fetchCategoriesInfoCached();
      const lines = (catInfo.categories || []).slice(0, 80).map(c => `- ${c.title}${c.subCategory ? ' [' + c.subCategory + ']' : ''}${c.classificationTags?.length ? ' #' + c.classificationTags.join(',') : ''}`);
      categoriesSummary += lines.join('\n');
    } catch {
      categoriesSummary += '- wraps (bike, car, pillar, roof, tank)\n- fragrances\n- accessories (keychain, stickers)';
    }

    const functionDocs = `
**CRITICAL: You MUST output ONLY a valid JSON object. No plain text. No markdown. No explanations outside JSON.**

Tools:
- search_products: { query?, maxPrice?, minPrice?, categoryTitle?, classificationTags?[], excludeTags?[], diversifyCategories?, limit?(max 10), keywords?[], sortBy?('orders'|'price_asc'|'price_desc'), selectBest?:number }
- get_order_status: { orderId? | phone? | email? }
- browse_categories: {} (show all category cards)

Classification Tags (use in classificationTags/excludeTags arrays):
- "car-interiors" - car interior products (pillar wraps, seat covers, etc.)
- "car-exteriors" - car exterior products (bonnet wraps, roof wraps, etc.)
- "bike-personalisation" - bike personalization (tank wraps, bike stickers)
- "bike-accessories" - bike accessories

CRITICAL RULES:
1. For NEW product requests → call search_products immediately
2. For FOLLOW-UP questions about previous results (e.g., "what did you show", "list them", "name them", "which ones", "how many") → use direct_answer and respond from conversation context
3. NEVER say "I will search" - just call the tool directly or answer
4. browse_categories ONLY for: "show all categories", "what do you sell"
5. CAR vs BIKE EXCLUSION:
   - If user mentions "car" → use classificationTags:["car-interiors","car-exteriors"] AND excludeTags:["bike-personalisation","bike-accessories"]
   - If user mentions "bike" → use classificationTags:["bike-personalisation","bike-accessories"] AND excludeTags:["car-interiors","car-exteriors"]
   - If user doesn't specify vehicle type → don't add excludeTags
6. Colors (red, blue, yellow, etc.) → search_products with keywords:["color"]
7. Budget/price → search_products with maxPrice/minPrice
8. NEVER fabricate prices or product info
9. USE categoryTitle for product type searches - this is the PRIMARY filter for product categories
   - When user asks for a specific product type (cushions, wraps, fresheners, etc.), use categoryTitle
   - categoryTitle takes priority over keyword extraction
10. If user says "not X" or "no X", do NOT include X in the search - just search for what they DO want
11. ONLY use product names and prices that are EXPLICITLY listed in the conversation history. NEVER invent or guess product names.

Key examples:
- "hi" → {"action":"direct_answer","reason":"greeting","directReply":"Hi! How can I help you today?"}
- "what products did you show" → {"action":"direct_answer","reason":"follow-up about previous results","directReply":"Based on the products I just showed you..."}
- "list them" or "name them" → {"action":"direct_answer","reason":"follow-up","directReply":"Here are the products from the last search..."}
- "give names and prices" or "table of products" → {"action":"direct_answer","reason":"follow-up","directReply":"Here are the products with prices:\n• Product Name 1 - ₹499\n• Product Name 2 - ₹599"}
- "my car is red and budget is 1000" → {"action":"call_tool","tool":"search_products","args":{"keywords":["red"],"maxPrice":1000,"classificationTags":["car-interiors","car-exteriors"],"excludeTags":["bike-personalisation","bike-accessories"],"diversifyCategories":true,"limit":10}}
- "something for my bike" → {"action":"call_tool","tool":"search_products","args":{"classificationTags":["bike-personalisation","bike-accessories"],"excludeTags":["car-interiors","car-exteriors"],"diversifyCategories":true,"limit":10}}
- "red products" → {"action":"call_tool","tool":"search_products","args":{"keywords":["red"],"diversifyCategories":true,"limit":6}}
- "pillar wraps under 600" → {"action":"call_tool","tool":"search_products","args":{"categoryTitle":"pillar wrap","maxPrice":600,"limit":6}}
- "cushions" → {"action":"call_tool","tool":"search_products","args":{"categoryTitle":"cushion","limit":6}}
- "cushions and not wraps" → {"action":"call_tool","tool":"search_products","args":{"categoryTitle":"cushion","limit":6}}
- "seat cushions" → {"action":"call_tool","tool":"search_products","args":{"categoryTitle":"seat cushion","limit":6}}
- "bonnet wraps" → {"action":"call_tool","tool":"search_products","args":{"categoryTitle":"bonnet wrap","limit":6}}
- "neck rest" → {"action":"call_tool","tool":"search_products","args":{"categoryTitle":"neck rest","limit":6}}
- "car fresheners" → {"action":"call_tool","tool":"search_products","args":{"categoryTitle":"freshener","limit":6}}
- "track my order" → {"action":"direct_answer","reason":"need order details","directReply":"Please share your order ID or phone number."}
- "track order 64abc" → {"action":"call_tool","tool":"get_order_status","args":{"orderId":"64abc"}}

Schema: {"action":"call_tool"|"direct_answer","tool"?:string,"args"?:object,"reason":string,"directReply"?:string}

REMINDER: Output ONLY the JSON object. directReply value must be a plain text string. NEVER output anything outside the JSON.
`;
    // Let GPT planner handle all routing decisions
    let plan = null;
    console.log('\n========== CHAT REQUEST ==========');
    console.log('[STEP 1] Input received:', { userId, message, action, pageContext });
    
    if (action === 'tool:search_products' || action === 'tool:get_order_status' || action === 'tool:browse_categories') {
      const map = { 'tool:search_products': 'search_products', 'tool:get_order_status': 'get_order_status', 'tool:browse_categories': 'browse_categories' };
      const toolName = map[action];
      plan = {
        action: 'call_tool',
        tool: toolName,
        args: toolInvocation || {},
        reason: 'client-requested tool',
        classification: classificationForTool(toolName)
      };
      console.log('[STEP 2] Client-requested tool (pagination/direct):', { tool: toolName, args: toolInvocation });
    }
    if (!plan) {
      let rawPlan = '{}';
      if (plannerMode === 'rule') {
        const p = ruleBasedPlan(plannerMessage || '');
        rawPlan = JSON.stringify(p);
        console.log('[STEP 2] Rule-based planner output:', rawPlan);
      } else {
        // Build messages array with conversation history
        const contextInfo = pageContext?.categoryTitle 
          ? `\n\nCURRENT PAGE CONTEXT: User is currently viewing "${pageContext.categoryTitle}" products. When user asks for colors, themes, or modifications without specifying a product type, apply their request to this category.`
          : '';
        const plannerMessages = [
          { role: 'system', content: `You are MaddyCustom's assistant planner. ${functionDocs}\n\n${categoriesSummary}${contextInfo}` },
        ];
        // Add conversation history for context (only last 10 turns to stay within token limit)
        const historyForPlanner = conversationHistory.slice(-10);
        historyForPlanner.forEach(msg => {
          plannerMessages.push({ role: msg.role, content: msg.content });
        });
        // Add current message
        plannerMessages.push({ role: 'user', content: plannerMessage || '' });
        
        console.log('[STEP 2] Calling GPT planner with message:', plannerMessage);
        console.log('[STEP 2] Conversation history length:', historyForPlanner.length);
        // Log full history content so we can verify products are being passed
        console.log('[DEBUG] History content being sent to planner:', historyForPlanner.map(m => ({ role: m.role, content: m.content })));
        
        const planner = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          max_completion_tokens: 400,
          temperature: 0,
          messages: plannerMessages
        });
        rawPlan = planner.choices?.[0]?.message?.content || '{}';
        console.log('[STEP 2] GPT planner raw output:', rawPlan);
        
        // Try to extract JSON if GPT wrapped it in markdown or other text
        const jsonMatch = rawPlan.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          rawPlan = jsonMatch[0];
          // Fix common JSON errors like double closing braces
          rawPlan = rawPlan.replace(/\}\}+$/, '}').replace(/^\{\{+/, '{');
        }
      }
      try { 
        plan = JSON.parse(rawPlan); 
      } catch (parseError) { 
        // Try to fix and re-parse common issues
        console.log('[STEP 2] JSON parse failed, attempting repair:', parseError.message);
        try {
          // Remove trailing garbage, fix unclosed strings
          let fixedPlan = rawPlan.trim();
          // Balance braces
          const openBraces = (fixedPlan.match(/\{/g) || []).length;
          const closeBraces = (fixedPlan.match(/\}/g) || []).length;
          if (closeBraces > openBraces) {
            // Too many closing braces, remove extras from end
            for (let i = 0; i < closeBraces - openBraces; i++) {
              fixedPlan = fixedPlan.replace(/\}([^}]*)$/, '$1');
            }
          } else if (openBraces > closeBraces) {
            // Missing closing braces
            fixedPlan += '}'.repeat(openBraces - closeBraces);
          }
          plan = JSON.parse(fixedPlan);
          console.log('[STEP 2] JSON repair successful');
        } catch (retryError) {
          // Still failed - use raw output as directReply
          console.log('[STEP 2] JSON repair failed:', retryError.message);
          plan = { action: 'direct_answer', reason: 'fallback-parse-text', directReply: rawPlan.trim() };
        }
      }
    }
    // Normalize planner action if it returned an unexpected value but provided a tool
    if (plan && typeof plan === 'object') {
      const toolName = typeof plan.tool === 'string' ? plan.tool : undefined;
      const validAction = plan.action === 'call_tool' || plan.action === 'direct_answer';
      if (!validAction && toolName) {
        plan.action = 'call_tool';
      }
    }
    
    console.log('[STEP 3] Final plan:', JSON.stringify(plan, null, 2));

    let planClassification = normalizeClassification(plan?.classification);
    if (planClassification) {
      plan.classification = planClassification;
    }

    if (dryRun) {
      return NextResponse.json({ plan, threadId, mode: plannerMode });
    }

    // 2) If planner chose a tool, execute and return structured response
    if (plan?.action === 'call_tool' && typeof plan.tool === 'string') {
      const tool = plan.tool;
      const args = plan.args || {};
      timeline.mark('tool_execution_start', { tool });

      if (tool === 'get_order_status') {
        const { orderId, phone } = args || {};
        const result = await getOrderStatus({ orderId, phone });
        timeline.mark('tool_execution_done', { tool });
        const composed = await composeToolReply({ kind: 'get_order_status', input: { orderId, phone }, output: result });
        timeline.mark('compose_reply_done', { tool });
        const classification = planClassification || classificationForTool('get_order_status') || await classifyUserMessage({ text: plannerMessage, tool: 'get_order_status' });
        if (classification) {
          const usedPlanClassification = classification === planClassification;
          timeline.mark('classification_done', { via: usedPlanClassification ? 'plan' : 'tool', type: classification?.type });
        }
        const entries = baseEntries.map(entry => ({ ...entry }));
        entries.push(
          makeToolEntry(
            tool,
            pruneToolArgs(tool, args),
            summarizeToolResult(tool, result)
          )
        );
        let assistantEntry = null;
        if (composed || result) {
          // Store as structured order_status message for UI persistence
          assistantEntry = makeAssistantEntry(composed || '', {
            messageType: 'order_status',
            structuredData: {
              orderId: result?.orderId,
              status: result?.status,
              eta: result?.expectedDelivery,
              trackUrl: result?.trackUrl,
              steps: result?.steps || [],
              orderedAt: result?.orderedAt,
              contactName: result?.contactName,
              contactPhone: result?.contactPhone,
              deliveryAddress: result?.deliveryAddress,
              payment: result?.payment,
              items: result?.items || [],
              isMultiOrder: result?.isMultiOrder,
              linkedOrders: result?.linkedOrders || [],
              paymentFailed: result?.paymentFailed,
              paymentPending: result?.paymentPending,
            }
          });
          entries.push(assistantEntry);
        }
        if (classification) {
          entries.push(makeClassificationEntry(classification));
        }
        if (assistantEntry) {
          assistantEntry.meta = { timings: timeline.summary() };
        }
        await recordChatLog({ userId, threadId, entries });
        timeline.mark('log_recorded');
        timeline.mark('response_ready');
        const timings = timeline.summary();
        logTimings({ userId, threadId, plannerMode }, timings);
        return NextResponse.json({ tool: 'get_order_status', data: result, reply: composed, classification, threadId, timings });
      }
      if (tool === 'search_products') {
        console.log('[STEP 4] Executing search_products tool');
        console.log('[STEP 4] Planner args:', JSON.stringify(args, null, 2));
        
        // pageContext is already extracted from request body at the top
        const sanitizeText = (txt) => {
          if (!txt || typeof txt !== 'string') return undefined;
          return txt.replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 120);
        };
        const numberOrUndefined = v => { if (v === null || v === undefined || v === '') return undefined; const num = Number(v); return isNaN(num) ? undefined : num; };
        let safeMax = numberOrUndefined(args.maxPrice);
        let safeMin = numberOrUndefined(args.minPrice);
        if (safeMax !== undefined && safeMax < 0) safeMax = 0;
        if (safeMin !== undefined && safeMin < 0) safeMin = 0;
        if (safeMax !== undefined && safeMin !== undefined && safeMin > safeMax) { const tmp = safeMin; safeMin = safeMax; safeMax = tmp; }
        const safeKeywords = Array.isArray(args.keywords) ? args.keywords.slice(0, 8).map(sanitizeText).filter(Boolean) : undefined;
        const safeDiversify = args.diversifyCategories === true;
        // Handle classificationTags from planner
        const safeClassificationTags = Array.isArray(args.classificationTags) ? args.classificationTags.slice(0, 5).map(sanitizeText).filter(Boolean) : undefined;
        // Handle excludeTags from planner (for car/bike exclusion)
        const safeExcludeTags = Array.isArray(args.excludeTags) ? args.excludeTags.slice(0, 5).map(sanitizeText).filter(Boolean) : undefined;
        // Handle selectBest for server-side filtering
        const safeSelectBest = numberOrUndefined(args.selectBest);
        // If diversification requested and no explicit limit, force 10 per requirement
        const explicitLimit = Number(args.limit);
        const effectiveLimit = safeDiversify && (isNaN(explicitLimit) || explicitLimit <= 0) ? 10 : explicitLimit;
        const searchPayload = {
          query: sanitizeText(args.query),
          maxPrice: safeMax,
          minPrice: safeMin,
          categoryTitle: sanitizeText(args.categoryTitle) || pageContext?.categoryTitle,
          keywords: safeKeywords,
          classificationTags: safeClassificationTags,
          excludeTags: safeExcludeTags,
          page: Math.max(1, Number(args.page) || 1),
          limit: Math.min(10, Math.max(1, Number(effectiveLimit) || 6)),
          diversifyCategories: safeDiversify,
          sortBy: typeof args.sortBy === 'string' ? args.sortBy : undefined,
          selectBest: safeSelectBest,
          pageContext
        };
        
        console.log('[STEP 5] Search payload to productSearch:', JSON.stringify(searchPayload, null, 2));
        
        const result = searchPayload.query || searchPayload.maxPrice !== undefined || searchPayload.minPrice !== undefined || searchPayload.keywords?.length || searchPayload.categoryTitle || searchPayload.classificationTags?.length || searchPayload.excludeTags?.length
          ? await searchProducts(searchPayload)
          : await categoryFirstSuggestions({ limit: searchPayload.limit });
        
        console.log('[STEP 6] Search result:', {
          productCount: result?.products?.length || 0,
          hasMore: result?.hasMore,
          queryEcho: result?.queryEcho,
          productTitles: result?.products?.slice(0, 5).map(p => p.title)
        });
        console.log('========== END REQUEST ==========\n');
        
        timeline.mark('tool_execution_done', { tool });
        
        // Generate a short contextual summary based on ACTUAL products found
        // Include product names so follow-up questions can reference them
        let composed = '';
        let historyText = ''; // Full text for conversation history (includes product names)
        if (result?.products?.length) {
          const count = result.products.length;
          const prices = result.products.map(p => p.price).filter(p => typeof p === 'number');
          const minPrice = prices.length ? Math.min(...prices) : null;
          const priceInfo = minPrice ? formatINR(minPrice) : '';
          
          // Simple, short summary for UI display
          composed = `Found ${count} options for you${priceInfo ? ` starting at ${priceInfo}` : ''}.${result.hasMore ? ' More available!' : ''}`;
          
          // Build full product list for conversation history (so GPT can reference them in follow-ups)
          const productList = result.products.map(p => `- ${p.title} (${p.slug || 'no-slug'}) - ₹${p.price}`).join('\n');
          historyText = `[SEARCH RESULTS] Found ${count} products:\n${productList}`;
        } else {
          composed = 'No matching products found. Try a different search?';
          historyText = '[SEARCH RESULTS] No products found.';
        }
        timeline.mark('compose_reply_done', { tool });
        const classification = planClassification || classificationForTool('search_products') || await classifyUserMessage({ text: plannerMessage, tool: 'search_products' });
        if (classification) {
          const usedPlanClassification = classification === planClassification;
          timeline.mark('classification_done', { via: usedPlanClassification ? 'plan' : 'tool', type: classification?.type });
        }
        const entries = baseEntries.map(entry => ({ ...entry }));
        entries.push(
          makeToolEntry(
            tool,
            pruneToolArgs(tool, args),
            summarizeToolResult(tool, result)
          )
        );
        let assistantEntry = null;
        if (composed || result?.products?.length) {
          // Store with historyText (includes product names) for conversation context
          // But keep composed as display summary
          assistantEntry = makeAssistantEntry(historyText || composed || '', {
            messageType: 'product_gallery',
            structuredData: {
              products: result?.products || [],
              queryEcho: result?.queryEcho || null,
              hasMore: result?.hasMore || false,
              summary: composed, // UI shows this shorter summary
            }
          });
          entries.push(assistantEntry);
        }
        if (classification) {
          entries.push(makeClassificationEntry(classification));
        }
        if (assistantEntry) {
          assistantEntry.meta = { timings: timeline.summary() };
        }
        await recordChatLog({ userId, threadId, entries });
        timeline.mark('log_recorded');
        timeline.mark('response_ready');
        const timings = timeline.summary();
        logTimings({ userId, threadId, plannerMode }, timings);
        return NextResponse.json({ tool: 'search_products', data: result, reply: composed, classification, threadId, timings });
      }
      if (tool === 'browse_categories') {
        // Build a categories grid using display assets like homepage CategoryGrid
        const toRelativeLink = (link) => {
          if (!link) return link;
          try {
            if (/^https?:\/\//i.test(link)) { const u = new URL(link); return (u.pathname || '/') + (u.search || '') + (u.hash || ''); }
            if (/^\/\//.test(link)) { const u = new URL('https:' + link); return (u.pathname || '/') + (u.search || '') + (u.hash || ''); }
            return link.startsWith('/') ? link : '/' + link;
          } catch { return link.startsWith('/') ? link : '/' + link; }
        };
        const { assets = [] } = await fetchDisplayAssets('homepage');
        const cats = (assets || []).filter(a => a?.isActive && (a?.componentName === 'category-grid' || a?.componentName === 'category-slider'));
        const items = cats.map(a => ({ title: a?.content || a?.title || 'Category', image: a?.media?.desktop || a?.media?.mobile || null, link: toRelativeLink(a?.link || '#') }));
        const hint = 'If you’d like, tell me a specific category like “Window Pillar Wrap” and I’ll open products from there.';
        const composed = await composeToolReply({ kind: 'browse_categories', input: args, output: { title: 'Shop by Category', items, hint } });
        timeline.mark('tool_execution_done', { tool });
        timeline.mark('compose_reply_done', { tool });
        const classification = planClassification || classificationForTool('browse_categories') || await classifyUserMessage({ text: plannerMessage, tool: 'browse_categories' });
        if (classification) {
          const usedPlanClassification = classification === planClassification;
          timeline.mark('classification_done', { via: usedPlanClassification ? 'plan' : 'tool', type: classification?.type });
        }
        const entries = baseEntries.map(entry => ({ ...entry }));
        entries.push(
          makeToolEntry(
            tool,
            pruneToolArgs(tool, args),
            summarizeToolResult(tool, { title: 'Shop by Category', items })
          )
        );
        let assistantEntry = null;
        const categoryGridData = { title: 'Shop by Category', items, hint, summary: composed };
        if (composed) {
          assistantEntry = makeAssistantEntry(composed, {
            messageType: 'category_grid',
            structuredData: categoryGridData
          });
          entries.push(assistantEntry);
        }
        if (classification) {
          entries.push(makeClassificationEntry(classification));
        }
        if (assistantEntry) {
          assistantEntry.meta = { timings: timeline.summary() };
        }
        await recordChatLog({ userId, threadId, entries });
        timeline.mark('log_recorded');
        timeline.mark('response_ready');
        const timings = timeline.summary();
        logTimings({ userId, threadId, plannerMode }, timings);
        return NextResponse.json({ tool: 'browse_categories', data: categoryGridData, reply: composed, classification, threadId, timings });
      }
    }

    // 3) Direct answer path: use planner's directReply if available, otherwise invoke Responses API
    let reply;
    let directReplyText = plan?.directReply;
    
    // Handle if GPT returned directReply as an array or object (e.g., for tables)
    if (directReplyText && typeof directReplyText !== 'string') {
      if (Array.isArray(directReplyText)) {
        // Format array of products as a nice table
        directReplyText = directReplyText.map(item => {
          if (typeof item === 'object' && item.name) {
            return `• ${item.name} - ${item.price || 'Price N/A'}`;
          }
          return typeof item === 'string' ? item : JSON.stringify(item);
        }).join('\n');
      } else {
        directReplyText = JSON.stringify(directReplyText, null, 2);
      }
    }
    
    if (directReplyText && typeof directReplyText === 'string' && directReplyText.trim()) {
      // Use planner's direct reply (for greetings, context recall, simple Q&A)
      reply = directReplyText.trim();
      timeline.mark('direct_reply_from_planner');
    } else {
      timeline.mark('instructions_fetch_start');
      const instructions = await getAssistantInstructions();
      timeline.mark('instructions_ready');
      timeline.mark('assistant_invoke_start');
      
      // Build input with conversation history for context
      const inputItems = [];
      // Add recent history for context
      conversationHistory.slice(-6).forEach(msg => {
        inputItems.push({ role: msg.role, content: msg.content });
      });
      // Add current message
      inputItems.push({ role: 'user', content: messageForThread });
      
      const response = await client.responses.create({
        model: 'gpt-4.1-nano',
        instructions,
        input: inputItems,
        previous_response_id: previousResponseId || undefined,
      });
      timeline.mark('assistant_invoke_done');

      reply = response.output_text?.trim() || 'No reply from assistant';
      sessionDoc.responseId = response.id;
      await sessionDoc.save();
      timeline.mark('session_persisted');
    }

    let classification = planClassification || null;
    if (plan?.handoff) {
      classification = { type: 'query', needsResolutionCheck: false, category: 'customer_support', subcategory: 'human_handoff' };
      timeline.mark('handoff_prepared', { channel: 'whatsapp' });
    } else {
      if (!classification) {
        classification = await classifyUserMessage({ text: plannerMessage });
      }
      if (classification) {
        const usedPlanClassification = classification === planClassification;
        timeline.mark('classification_done', { via: usedPlanClassification ? 'plan' : 'direct', type: classification?.type });
      }
    }

    const responsePayload = { reply, classification, threadId };
    if (plan?.handoff) {
      responsePayload.handoff = { type: 'whatsapp', url: HUMAN_HANDOFF_LINK, phone: HUMAN_HANDOFF_PHONE };
    }

    const entries = baseEntries.map(entry => ({ ...entry }));
    const assistantEntry = makeAssistantEntry(reply, {
      handoff: plan?.handoff ? { type: 'whatsapp', url: HUMAN_HANDOFF_LINK, phone: HUMAN_HANDOFF_PHONE } : undefined
    });
    assistantEntry.meta = { timings: timeline.summary() };
    entries.push(assistantEntry);
    if (classification) {
      entries.push(makeClassificationEntry(classification));
    }
    await recordChatLog({ userId, threadId, entries });
    timeline.mark('log_recorded');
    timeline.mark('response_ready');
    const timings = timeline.summary();
    logTimings({ userId, threadId, plannerMode }, timings);
    responsePayload.timings = timings;
    return NextResponse.json(responsePayload);
  } catch (err) {
    console.error('Assistant API error', err);
    return NextResponse.json({ error: 'Assistant API error' }, { status: 500 });
  }
}
