import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import connectToDb from '@/lib/middleware/connectToDb';
import AssistantThread from '@/models/AssistantThread';
import UserMessage from '@/models/UserMessage';
import { searchProducts, categoryFirstSuggestions } from '@/lib/assistant/productSearch';
import { getOrderStatus } from '@/lib/assistant/orderStatus';
import { store } from '@/store';
import { fetchDisplayAssets } from '@/lib/utils/fetchutils';
import AssistantChatLog from '@/models/AssistantChatLog';

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
      trackUrl: result?.trackUrl || null
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

const makeUserEntry = (text) => ({
  role: 'user',
  kind: 'text',
  text: truncateText(text, 500),
  timestamp: new Date()
});

const makeAssistantEntry = (text, extras = {}) => ({
  role: 'assistant',
  kind: extras.kind || 'text',
  text: truncateText(text, GPT_REPLY_CHAR_LIMIT),
  handoff: extras.handoff || undefined,
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

async function recordChatLog({ userId, threadId, entries }) {
  if (!userId || !threadId || !Array.isArray(entries) || entries.length === 0) return;
  try {
    await AssistantChatLog.findOneAndUpdate(
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

// Small helper: compose a concise, user-facing reply for tool outputs
async function composeToolReply({ kind, input, output, assistantId }) {
  try {
    const system = 'You summarize tool results for a shopping assistant. Be concise, friendly, and do not use markdown.';
    const user = JSON.stringify({ kind, input, output });
    const prompt = `Write a single short sentence (max ~60 words) to accompany the UI data. Reference the intent briefly and suggest the next best action when helpful. No markdown.`;
    const resp = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.5,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `${prompt}\n\nData:\n${user}` }
      ]
    });
    return resp.choices?.[0]?.message?.content?.trim() || '';
  } catch {
    return '';
  }
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
      model: 'gpt-4.1-mini',
      temperature: 0.3,
      max_tokens: 2000,
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
  const plan = { action: 'direct_answer', reason: 'default' };
  if (!text.trim()) return plan;

  // Lightweight: only order tracking signal in rule mode, everything else to LLM in prod
  const hexId = (text.match(/\b[a-f0-9]{24}\b/i) || [])[0];
  const mentionsOrder = /\border\b|\btrack\b|\btracking\b/.test(text);
  const phoneMatch = (text.match(/\b\+?\d{10,13}\b/) || [])[0];
  if (mentionsOrder && hexId) return { action: 'call_tool', tool: 'get_order_status', args: { orderId: hexId }, reason: 'Order tracking by id' };
  if (mentionsOrder && phoneMatch && !hexId) return { action: 'direct_answer', reason: 'Order tracking by phone not supported in test mode; ask for order id' };
  // Everything else: generic browse to categories (safe default) in rule mode
  return { action: 'call_tool', tool: 'browse_categories', args: {}, reason: 'Rule mode default to categories; LLM handles in production' };
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

export async function GET(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 500 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");

    let threadId = null;
    await connectToDb();

    if (userId) {
      const mapping = await AssistantThread.findOne({ userId }).lean();
      if (mapping?.threadId) threadId = mapping.threadId;
    }

    if (!threadId) {
      return NextResponse.json({ messages: [], threadId: null });
    }
    const messagesResp = await client.beta.threads.messages.list(threadId);

    const messages = messagesResp.data
      .filter(m => {
        const txt = m.content?.[0]?.text?.value || '';
        return !txt.startsWith(INTERNAL_KNOWLEDGE_TAG); // hide internal knowledge injection
      })
      .slice()
      .reverse()
      .map(m => ({
        id: m.id,
        role: m.role,
        text: m.content?.[0]?.text?.value || "",
        created_at: new Date(m.created_at * 1000).toISOString(),
      }));
    return NextResponse.json({ messages, threadId });
  } catch (err) {
    console.error("Failed to fetch thread from OpenAI or DB", err);
    return NextResponse.json({ error: "Failed to fetch thread history" }, { status: 500 });
  }
}


export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured.' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
  const { action, message, userId, toolInvocation } = body || {};

    await connectToDb();

    // Reset: remove mapping for userId
    if (action === 'reset') {
      if (!userId) return NextResponse.json({ error: 'userId required for reset' }, { status: 400 });
      try {
        await AssistantThread.deleteOne({ userId });
        return NextResponse.json({ ok: true });
      } catch (err) {
        console.error('Failed to reset mapping', err);
        return NextResponse.json({ error: 'Failed to reset mapping' }, { status: 500 });
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId required in POST body' }, { status: 400 });
    }

    // Allow tool calls without a free-form message
    if (!message && !(action && action.startsWith('tool:'))) {
      return NextResponse.json({ error: 'message required' }, { status: 400 });
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
        plannerMessage = id ? `track order ${id}` : 'track my order';
      }
    }

    // Ensure assistant exists and its instructions include latest helping data
    const INSTRUCTIONS_TTL_MS = 30 * 60 * 1000; // refresh every 30 min at most
    let assistantId = global.__ASSISTANT_ID || null;
    const composeInstructions = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/assistant/helping-data`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error('helping-data fetch failed');
        const { helpingData } = await res.json();
        return `You are the official support assistant for MaddyCustom. Use the following domain knowledge about products, wraps, installation, shipping, durability, fragrance variants, JDM keychains, ordering & tracking. Never fabricate policies. If unsure, ask the user for clarification. ALWAYS be concise, friendly, respectful and avoid markdown formatting. When the user asks for a human agent, real person, WhatsApp support, or similar handoff, do NOT drop a link immediately. Instead say: "I can redirect you to our human team on WhatsApp (${HUMAN_HANDOFF_PHONE}). Would you like me to open it?" and wait for a clear Yes before sharing ${HUMAN_HANDOFF_LINK}. Domain Knowledge:\n\n${helpingData}`;
      } catch (error) {
        console.error('Failed to fetch helping data:', error);
        return `You are the official support assistant for MaddyCustom. Use your knowledge about products, wraps, installation, shipping, durability, fragrance variants, JDM keychains, ordering & tracking. Never fabricate policies. If unsure, ask the user for clarification. ALWAYS be concise, friendly, respectful and avoid markdown formatting. When the user asks for a human agent, real person, WhatsApp support, or similar handoff, do NOT drop a link immediately. Instead say: "I can redirect you to our human team on WhatsApp (${HUMAN_HANDOFF_PHONE}). Would you like me to open it?" and wait for a clear Yes before sharing ${HUMAN_HANDOFF_LINK}.`;
      }
    };
    if (!assistantId) {
      const a = await client.beta.assistants.create({
        name: 'MaddyCustom Chatbot',
        instructions: await composeInstructions(),
        model: 'gpt-4.1-mini',
      });
      assistantId = a.id;
      global.__ASSISTANT_ID = assistantId;
      global.__ASSISTANT_LAST_UPDATE_TS = Date.now();
    } else {
      const lastTs = global.__ASSISTANT_LAST_UPDATE_TS || 0;
      const needsRefresh = Date.now() - lastTs > INSTRUCTIONS_TTL_MS;
      if (needsRefresh) {
        try {
          await client.beta.assistants.update(assistantId, { instructions: await composeInstructions() });
          global.__ASSISTANT_LAST_UPDATE_TS = Date.now();
        } catch (e) {
        }
      }
    }

    // Determine threadId for this user via DB mapping or incoming threadId
    let threadId = null;
    let newThreadCreated = false;
    if (!threadId) {
      const mapping = await AssistantThread.findOne({ userId }).lean();
      if (mapping?.threadId) threadId = mapping.threadId;
    }

    if (!threadId) {
      const t = await client.beta.threads.create();
      threadId = t.id;
      newThreadCreated = true;
      await AssistantThread.findOneAndUpdate(
        { userId },
        { threadId },
        { upsert: true, new: true }
      );
    }

    // Inject hidden knowledge message ONLY once per new thread (not shown to UI)
    if (newThreadCreated) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/assistant/helping-data`, {
          cache: "no-store",
        });
        if (res.ok) {
          const { helpingData } = await res.json();
          await client.beta.threads.messages.create(threadId, { role: 'assistant', content: `${INTERNAL_KNOWLEDGE_TAG}\n${helpingData}` });
        }
      } catch (e) {
      }
      // Inject categories context as HIDDEN knowledge, not visible to the user
      try {
        const data = await fetchCategoriesInfoCached();
        const lines = (data.categories || []).slice(0, 50).map(c => `• ${c.title}${c.description ? ' – ' + c.description : ''}`);
        const summary = lines.length ? `CATEGORIES OVERVIEW (for assistant context only)\n${lines.join('\n')}` : 'CATEGORIES OVERVIEW: wraps, fragrances, accessories, etc.';
        await client.beta.threads.messages.create(threadId, { role: 'assistant', content: `${INTERNAL_KNOWLEDGE_TAG}\n${summary}` });
      } catch (e) {
      }
    }

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

    // Provide categories overview to the planner for robust category selection
    let categoriesSummary = 'CATEGORIES:\n';
    try {
      const catInfo = await fetchCategoriesInfoCached();
      const lines = (catInfo.categories || []).slice(0, 80).map(c => `- ${c.title}${c.subCategory ? ' ['+c.subCategory+']' : ''}${c.classificationTags?.length ? ' #' + c.classificationTags.join(',') : ''}`);
      categoriesSummary += lines.join('\n');
    } catch {
      categoriesSummary += '- wraps (bike, car, pillar, roof, tank)\n- fragrances\n- accessories (keychain, stickers)';
    }

    const functionDocs = `
You can decide to CALL ONE of these functions or ANSWER DIRECTLY. Output STRICT JSON only, no markdown.

Functions:
- search_products(args): Find products matching a query and hints.
  args: {
    query?: string; // user query
    maxPrice?: number; minPrice?: number;
    categoryTitle?: string; // pick one closest from the categories list below (e.g., 'window pillar wrap', 'tank wrap', 'bike wrap', 'car wrap', 'car fragrance', 'keychain')
    diversifyCategories?: boolean; // set true for generic domain-only queries (e.g., "something for my red car") to return a mix from different specific categories (pillar wraps, bonnet wraps, roof wraps, etc.)
    page?: number; limit?: number; // limit max 10 (use 10 when diversifyCategories is true)
    keywords?: string[]; // optional extra terms
    sortBy?: 'orders' | 'price_asc' | 'price_desc'
  }
  returns: { products: Array<{ title, image, slug, price, mrp, discountPercent }>, hasMore, page, limit, queryEcho, continuation }

- get_order_status(args): Get order tracking snapshot.
  args: { orderId: string }
  returns: { ok, orderId, status, expectedDelivery, trackUrl, steps, orderedAt, deliveryAddress, contactName, contactPhone }

- browse_categories(args): Show category cards so user can pick a section.
  args: {} // no args needed
  returns: { title: string, items: Array<{ title, image, link }>, hint: string }

- customer_support(args): Send info to customer support.
  args: { phoneNumber: string }
  returns: { ok: boolean, message: string }

Decision policy:
- If the user is generically browsing (e.g., "show me products", "show me all products", "browse products", "everything", "all items"), choose browse_categories. 
- Choose search_products when the user specifies a concrete product concept, keywords, or category (e.g., "window pillar wrap", "perfume under 500", "most ordered pillar wraps"). When the user mentions a domain like bike/car/interior/exterior: 
  - If they ALSO mention a specific structure/category (e.g., pillar/tank/roof/bonnet/window), set categoryTitle accordingly (e.g., "window pillar wrap"). 
  - If they ONLY mention the domain without a specific category (e.g., "show me something for my red car"), DO NOT set categoryTitle. Instead set args.keywords with the domain (e.g., ["car"]) and set diversifyCategories=true with limit=10 so results are a diverse mix across different specific categories (pillar, roof, bonnet, etc.). 
- Choose get_order_status only if the user asks to track an order or provides a valid order id. 
- Keep args minimal and relevant; do not invent values. Never exceed limit 10. 
- If user says something like window pillar wrap material or finish or something like that don't call a tool; answer directly about material; don't blindly call search_products for every message just because there is a keyword.
- If the user asks for a human agent, real person, customer support number, or WhatsApp support, do not call any tool. Return { action: 'direct_answer', handoff: true }. The direct answer must politely ask "Would you like me to open our human team on WhatsApp (${HUMAN_HANDOFF_PHONE})?" and wait for a clear Yes before sharing ${HUMAN_HANDOFF_LINK}.

Examples:
1) User: "show me all products" → { "action": "call_tool", "tool": "browse_categories", "args": {}, "reason": "Generic browse" }
2) User: "What products do you sell?" → { "action": "call_tool", "tool": "browse_categories", "args": {}, "reason": "Generic browse" }
3) User: "See all product categories" → { "action": "call_tool", "tool": "browse_categories", "args": {}, "reason": "Explicit category request" }
4) User: "show me window pillar wraps" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "window pillar wrap", "keywords": ["pillar","wrap"], "limit": 6 }, "reason": "Specific category" }
5) User: "most ordered pillar wraps under 600" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "pillar wrap", "maxPrice": 600, "sortBy": "orders", "limit": 10 }, "reason": "Popularity sort with budget" }
6) User: "Suggest some red designs" → { "action": "call_tool", "tool": "search_products", "args": { "keywords": ["red"], "limit": 6 }, "reason": "Color-based search" }
7) User: "Show me anime-themed wraps" → { "action": "call_tool", "tool": "search_products", "args": { "keywords": ["anime"], "limit": 6 }, "reason": "Theme-based search" }
8) User: "track 64abc...ef" → { "action": "call_tool", "tool": "get_order_status", "args": { "orderId": "64abc...ef" }, "reason": "Order tracking" }
9) User: "Where is my order?" → { "action": "direct_answer", "reason": "Ask for order ID" }
10) User: "Track my new order" → { "action": "direct_answer", "reason": "Ask for order ID" }
11) User: "show something for bike" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "bike wrap", "keywords": ["bike"], "limit": 6 }, "reason": "User mentioned bike; choose closest category from list" }
12) User: "Do you have something for my bike?" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "bike wrap", "keywords": ["bike"], "limit": 6 }, "reason": "Bike-related query" }
13) User: "Show me something for my car" → { "action": "call_tool", "tool": "search_products", "args": { "keywords": ["car"], "diversifyCategories": true, "limit": 10 }, "reason": "Generic car domain; diversify across categories" }
14) User: "show something for car interiors" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "car interiors", "keywords": ["car","interior"], "limit": 6 }, "reason": "User mentioned car interiors" }
15) User: "car roof" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "roof wrap", "limit": 6 }, "reason": "Roof wraps for car" }
16) User: "Show me something for my car roof" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "roof wrap", "keywords": ["car","roof"], "limit": 6 }, "reason": "Car roof specific" }
17) User: "show me something for my red car" → { "action": "call_tool", "tool": "search_products", "args": { "keywords": ["car","red"], "diversifyCategories": true, "limit": 10 }, "reason": "Generic car domain with color; diversify across categories" }
18) User: "Suggest a car freshener I can gift my dad" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "car fragrance", "keywords": ["fragrance","freshener"], "limit": 6 }, "reason": "Car fragrance/freshener query" }
19) User: "Do you ship across India?" → { "action": "direct_answer", "reason": "Shipping policy question" }
20) User: "What material is used?" → { "action": "direct_answer", "reason": "Material question; answer from knowledge base" }
21) User: "How long does the product last?" → { "action": "direct_answer", "reason": "Durability question" }
22) User: "Wrap durability and care" → { "action": "direct_answer", "reason": "Care instructions question" }
23) User: "How long does shipping take?" → { "action": "direct_answer", "reason": "Shipping time question" }
24) User: "Shipping time details" → { "action": "direct_answer", "reason": "Shipping policy question" }
25) User: "Can I change the shipping address?" → { "action": "direct_answer", "reason": "Order modification question" }
26) User: "How long until delivery?" → { "action": "direct_answer", "reason": "Delivery time question" }
27) User: "When will packaging start?" → { "action": "direct_answer", "reason": "Order processing question" }
28) User: "Order tracking support" → { "action": "direct_answer", "reason": "Ask for order ID or phone for tracking" } 
29) User: "I want to talk to a real person" → { "action": "direct_answer", "handoff": true, "reason": "Offer WhatsApp human support" }

Decision JSON schema:
{ "action": "call_tool" | "direct_answer", "tool"?: "search_products"|"get_order_status"|"browse_categories", "args"?: object, "reason": string, "handoff"?: boolean }
`;
    // If client explicitly invoked a tool, honor it to avoid planner overriding color/style searches
    let plan = null;
    if (action === 'tool:search_products' || action === 'tool:get_order_status' || action === 'tool:browse_categories') {
      const map = { 'tool:search_products': 'search_products', 'tool:get_order_status': 'get_order_status', 'tool:browse_categories': 'browse_categories' };
      plan = { action: 'call_tool', tool: map[action], args: toolInvocation || {}, reason: 'client-requested tool' };
    } else {
      let rawPlan = '{}';
      if (plannerMode === 'rule') {
        const p = ruleBasedPlan(plannerMessage || '');
        rawPlan = JSON.stringify(p);
      } else {
        const planner = await client.chat.completions.create({
          model: 'gpt-4.1-mini',
          temperature: 0,
          max_tokens: 120,
          messages: [
            { role: 'system', content: 'You are a careful planner. Decide the best next step and return STRICT JSON matching the schema.' },
            { role: 'system', content: categoriesSummary },
            { role: 'system', content: functionDocs },
            { role: 'user', content: plannerMessage || '' }
          ]
        });
        rawPlan = planner.choices?.[0]?.message?.content || '{}';
      }
      try { plan = JSON.parse(rawPlan); } catch { plan = { action: 'direct_answer', reason: 'fallback-parse' }; }
    }
    // Normalize planner action if it returned an unexpected value but provided a tool
    if (plan && typeof plan === 'object') {
      const toolName = typeof plan.tool === 'string' ? plan.tool : undefined;
      const validAction = plan.action === 'call_tool' || plan.action === 'direct_answer';
      if (!validAction && toolName) {
        plan.action = 'call_tool';
      }
    }

    if (dryRun) {
      return NextResponse.json({ plan, threadId, mode: plannerMode });
    }

    // 2) If planner chose a tool, execute and return structured response
    if (plan?.action === 'call_tool' && typeof plan.tool === 'string') {
      const tool = plan.tool;
      const args = plan.args || {};

      if (tool === 'get_order_status') {
        const { orderId } = args || {};
        const result = await getOrderStatus({ orderId });
        const composed = await composeToolReply({ kind: 'get_order_status', input: { orderId }, output: result, assistantId });
        const classification = await classifyUserMessage({ text: plannerMessage, tool: 'get_order_status' });
        const entries = baseEntries.map(entry => ({ ...entry }));
        entries.push(
          makeToolEntry(
            tool,
            pruneToolArgs(tool, args),
            summarizeToolResult(tool, result)
          )
        );
        if (composed) {
          entries.push(makeAssistantEntry(composed));
        }
        if (classification) {
          entries.push(makeClassificationEntry(classification));
        }
        await recordChatLog({ userId, threadId, entries });
        return NextResponse.json({ tool: 'get_order_status', data: result, reply: composed, classification, threadId });
      }
      if (tool === 'search_products') {
        // Reuse sanitize + search logic from explicit tool path
        let pageContext = null;
        try { pageContext = store.getState().assistantContext; } catch {}
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
        // If diversification requested and no explicit limit, force 10 per requirement
        const explicitLimit = Number(args.limit);
        const effectiveLimit = safeDiversify && (isNaN(explicitLimit) || explicitLimit <= 0) ? 10 : explicitLimit;
        const searchPayload = {
          query: sanitizeText(args.query),
          maxPrice: safeMax,
          minPrice: safeMin,
          categoryTitle: sanitizeText(args.categoryTitle) || pageContext?.categoryTitle,
          keywords: safeKeywords,
          page: Math.max(1, Number(args.page) || 1),
          limit: Math.min(10, Math.max(1, Number(effectiveLimit) || 6)),
          diversifyCategories: safeDiversify,
          sortBy: typeof args.sortBy === 'string' ? args.sortBy : undefined,
          pageContext
        };
        const result = searchPayload.query || searchPayload.maxPrice !== undefined || searchPayload.minPrice !== undefined || searchPayload.keywords?.length || searchPayload.categoryTitle
          ? await searchProducts(searchPayload)
          : await categoryFirstSuggestions({ limit: searchPayload.limit });
        if (!result?.products?.length && result?.fallback === 'browse_categories') {
          const toRelativeLink = (link) => { if (!link) return link; try { if (/^https?:\/\//i.test(link)) { const u = new URL(link); return (u.pathname||'/')+(u.search||'')+(u.hash||''); } if (/^\/\//.test(link)) { const u = new URL('https:'+link); return (u.pathname||'/')+(u.search||'')+(u.hash||''); } return link.startsWith('/')?link:'/'+link; } catch { return link.startsWith('/')?link:'/'+link; } };
          const { assets = [] } = await fetchDisplayAssets('homepage');
          const cats = (assets || []).filter(a => a?.isActive && (a?.componentName === 'category-grid' || a?.componentName === 'category-slider'));
          const items = cats.map(a => ({ title: a?.content || a?.title || 'Category', image: a?.media?.desktop || a?.media?.mobile || null, link: toRelativeLink(a?.link || '#') }));
          const hint = 'Couldn’t find items that match. Want to browse by category? For example, say “Window Pillar Wrap”.';
          const composed = await composeToolReply({ kind: 'browse_categories', input: args, output: { title: 'Shop by Category', items, hint }, assistantId });
          const classification = await classifyUserMessage({ text: plannerMessage, tool: 'browse_categories' });
          const entries = baseEntries.map(entry => ({ ...entry }));
          entries.push(
            makeToolEntry(
              tool,
              pruneToolArgs(tool, args),
              summarizeToolResult(tool, result)
            )
          );
          if (composed) {
            entries.push(makeAssistantEntry(composed));
          }
          if (classification) {
            entries.push(makeClassificationEntry(classification));
          }
          await recordChatLog({ userId, threadId, entries });
          return NextResponse.json({ tool: 'browse_categories', data: { title: 'Shop by Category', items, hint }, reply: composed, classification, threadId });
        }
        const composed = await composeToolReply({ kind: 'search_products', input: args, output: result, assistantId });
        const classification = await classifyUserMessage({ text: plannerMessage, tool: 'search_products' });
        const entries = baseEntries.map(entry => ({ ...entry }));
        entries.push(
          makeToolEntry(
            tool,
            pruneToolArgs(tool, args),
            summarizeToolResult(tool, result)
          )
        );
        if (composed) {
          entries.push(makeAssistantEntry(composed));
        }
        if (classification) {
          entries.push(makeClassificationEntry(classification));
        }
        await recordChatLog({ userId, threadId, entries });
        return NextResponse.json({ tool: 'search_products', data: result, reply: composed, classification, threadId });
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
        const composed = await composeToolReply({ kind: 'browse_categories', input: args, output: { title: 'Shop by Category', items, hint }, assistantId });
        const classification = await classifyUserMessage({ text: plannerMessage, tool: 'browse_categories' });
        const entries = baseEntries.map(entry => ({ ...entry }));
        entries.push(
          makeToolEntry(
            tool,
            pruneToolArgs(tool, args),
            summarizeToolResult(tool, { title: 'Shop by Category', items })
          )
        );
        if (composed) {
          entries.push(makeAssistantEntry(composed));
        }
        if (classification) {
          entries.push(makeClassificationEntry(classification));
        }
        await recordChatLog({ userId, threadId, entries });
        return NextResponse.json({ tool: 'browse_categories', data: { title: 'Shop by Category', items, hint }, reply: composed, classification, threadId });
      }
    }

    // 3) Direct answer path: Append the synthesized plannerMessage to the assistant thread and run
    await client.beta.threads.messages.create(threadId, { role: 'user', content: messageForThread });

    UserMessage.create({ userId, message: messageForThread }).catch(err => console.error('Failed to save user message', err));

    // Run assistant on the thread
    let run = await client.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    // Poll until run completes
    while (run.status !== "completed" && run.status !== "failed" && run.status !== "cancelled") {
      await new Promise(r => setTimeout(r, 600));
      run = await client.beta.threads.runs.retrieve(threadId, run.id);
    }

    // Fetch messages from thread
    const messagesResp = await client.beta.threads.messages.list(threadId);
    // Select most recent assistant reply that is NOT the internal knowledge message
    const assistantMessages = messagesResp.data
      .filter(m => m.role === 'assistant')
      .filter(m => {
        const txt = m.content?.[0]?.text?.value || '';
        return !txt.startsWith(INTERNAL_KNOWLEDGE_TAG);
      })
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    const reply = assistantMessages[0]?.content?.[0]?.text?.value || "No reply from assistant";
    let classification;
    if (plan?.handoff) {
      classification = { type: 'query', needsResolutionCheck: false, category: 'customer_support', subcategory: 'human_handoff' };
    } else {
      classification = await classifyUserMessage({ text: plannerMessage });
    }
    const responsePayload = { reply, classification, threadId };
    if (plan?.handoff) {
      responsePayload.handoff = { type: 'whatsapp', url: HUMAN_HANDOFF_LINK, phone: HUMAN_HANDOFF_PHONE };
    }
    const entries = baseEntries.map(entry => ({ ...entry }));
    entries.push(
      makeAssistantEntry(reply, {
        handoff: plan?.handoff ? { type: 'whatsapp', url: HUMAN_HANDOFF_LINK, phone: HUMAN_HANDOFF_PHONE } : undefined
      })
    );
    if (classification) {
      entries.push(makeClassificationEntry(classification));
    }
    await recordChatLog({ userId, threadId, entries });
    return NextResponse.json(responsePayload);
  } catch (err) {
    console.error('Assistant API error', err);
    return NextResponse.json({ error: 'Assistant API error' }, { status: 500 });
  }
}
