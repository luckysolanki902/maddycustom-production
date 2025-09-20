import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import connectToDb from '@/lib/middleware/connectToDb';
import AssistantThread from '@/models/AssistantThread';
import UserMessage from '@/models/UserMessage';

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
    const { action, message, userId } = body || {};

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

    if (!message) {
      return NextResponse.json({ error: 'message required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId required in POST body' }, { status: 400 });
    }

    // Ensure assistant exists (create once)
    if (!global.__ASSISTANT_ID) {
      const a = await client.beta.assistants.create({
        name: 'MaddyCustom Chatbot',
        // instructions: 'You are a helpful assistant.',
        model: 'gpt-4.1-mini',
      });
      global.__ASSISTANT_ID = a.id;
    }
    const assistantId = global.__ASSISTANT_ID;

    // Determine threadId for this user via DB mapping or incoming threadId
    let threadId = null;
    if (!threadId) {
      const mapping = await AssistantThread.findOne({ userId }).lean();
      if (mapping?.threadId) threadId = mapping.threadId;
    }

    if (!threadId) {
      const t = await client.beta.threads.create();
      threadId = t.id;
      // persist mapping
      await AssistantThread.findOneAndUpdate(
        { userId },
        { threadId },
        { upsert: true, new: true }
      );
    }

    // Append user message
    await client.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message,
    });

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
    const assistantMessages = messagesResp.data.filter(m => m.role === "assistant");
    const reply = assistantMessages[0]?.content?.[0]?.text?.value || "No reply from assistant";

    return NextResponse.json({ reply, threadId });
  } catch (err) {
    console.error('Assistant API error', err);
    return NextResponse.json({ error: 'Assistant API error' }, { status: 500 });
  }
}
