import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import connectToDb from '@/lib/middleware/connectToDb';
import AssistantThread from '@/models/AssistantThread';
import UserMessage from '@/models/UserMessage';
import helpingData from '@/lib/faq/helpingdata';
import { searchProducts, categoryFirstSuggestions } from '@/lib/assistant/productSearch';
import { store } from '@/store';

// Tag marker for internal knowledge messages we do NOT expose to UI
const INTERNAL_KNOWLEDGE_TAG = '__INTERNAL_KNOWLEDGE__';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    // Ensure assistant exists (create once)
    if (!global.__ASSISTANT_ID) {
      const a = await client.beta.assistants.create({
        name: 'MaddyCustom Chatbot',
        instructions: `You are the official support assistant for MaddyCustom. Use the following domain knowledge about products, wraps, installation, shipping, durability, fragrance variants, JDM keychains, ordering & tracking. Never fabricate policies. If unsure, ask the user for clarification. ALWAYS be concise, friendly, respectful and avoid markdown formatting. Domain Knowledge:\n\n${helpingData}`,
        model: 'gpt-4.1-mini',
      });
      global.__ASSISTANT_ID = a.id;
    }
    const assistantId = global.__ASSISTANT_ID;

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
      await client.beta.threads.messages.create(threadId, { role: 'assistant', content: `${INTERNAL_KNOWLEDGE_TAG}\n${helpingData}` });
    }

    // Tool invocation short-circuit (for pagination / show more etc.)
    if (action === 'tool:search_products') {
      // Expect toolInvocation object with params
      const params = toolInvocation || {};
      const {
        query,
        maxPrice,
        minPrice,
        categoryTitle,
        page = 1,
        limit = 6,
        keywords
      } = params;

      // Access assistantContext from redux store (non-persisted) for additional hints
      let pageContext = null;
      try {
        pageContext = store.getState().assistantContext;
      } catch {}

      const sanitizeText = (txt) => {
        if (!txt || typeof txt !== 'string') return undefined;
        // Basic sanitation: trim, collapse whitespace, strip control chars
        return txt.replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 120);
      };
      const numberOrUndefined = v => {
        if (v === null || v === undefined || v === '') return undefined;
        const num = Number(v);
        if (isNaN(num)) return undefined;
        return num;
      };
      let safeMax = numberOrUndefined(maxPrice);
      let safeMin = numberOrUndefined(minPrice);
      if (safeMax !== undefined && safeMax < 0) safeMax = 0;
      if (safeMin !== undefined && safeMin < 0) safeMin = 0;
      if (safeMax !== undefined && safeMin !== undefined && safeMin > safeMax) {
        // swap if inverted
        const tmp = safeMin; safeMin = safeMax; safeMax = tmp;
      }
      const safeKeywords = Array.isArray(keywords) ? keywords.slice(0, 8).map(sanitizeText).filter(Boolean) : undefined;
      const searchPayload = {
        query: sanitizeText(query),
        maxPrice: safeMax,
        minPrice: safeMin,
        categoryTitle: sanitizeText(categoryTitle) || pageContext?.categoryTitle,
        keywords: safeKeywords,
        page: Math.max(1, Number(page) || 1),
        limit: Math.min(12, Math.max(1, Number(limit) || 6)),
        pageContext
      };
      const result = query || maxPrice || minPrice || keywords?.length || categoryTitle
        ? await searchProducts(searchPayload)
        : await categoryFirstSuggestions({ limit });

      return NextResponse.json({
        tool: 'search_products',
        data: result
      });
    }

    // Append the exact user message without UI-visible hints to thread
    await client.beta.threads.messages.create(threadId, { role: 'user', content: message });

    UserMessage.create({ userId, message }).catch(err => console.error('Failed to save user message', err));

    // Run assistant on the thread
    let run = await client.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    // Poll until run completes
    while (run.status !== "completed" && run.status !== "failed" && run.status !== "cancelled") {
      await new Promise(r => setTimeout(r, 1000));
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

    return NextResponse.json({ reply, threadId });
  } catch (err) {
    console.error('Assistant API error', err);
    return NextResponse.json({ error: 'Assistant API error' }, { status: 500 });
  }
}
