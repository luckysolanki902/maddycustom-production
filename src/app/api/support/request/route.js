import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import mongoose from 'mongoose';
import dbConnect from '@/lib/middleware/connectToDb';
import SupportRequest from '@/models/SupportRequest';
import SupportUserChats from '@/models/SupportUserChats';

export async function POST(req) {
  try {
    await dbConnect();
  } catch (e) {
    return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { userId, threadId, mobile, email, category, subcategory, issue, aiResponse, userChats } = body || {};
    if (!mobile || !category || !issue) {
      return NextResponse.json({ error: 'Missing required fields: mobile, category, issue' }, { status: 400 });
    }

    let chatLogId = undefined;
    if (Array.isArray(userChats) && userChats.length) {
      const log = await SupportUserChats.create({ userId, threadId, messages: userChats.map(t => ({ role: 'user', text: String(t||'').slice(0, 4000) })) });
      chatLogId = log?._id;
    }

    // Optional GPT summary refinement
    let finalIssue = issue;
    try {
      if (process.env.OPENAI_API_KEY && Array.isArray(userChats) && userChats.length) {
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const context = `User messages (latest last):\n${userChats.slice(-6).join('\n')}\nAssistant reply:\n${(aiResponse||'').slice(0, 400)}`;
        const resp = await client.chat.completions.create({
          model: 'gpt-4.1-mini',
          temperature: 0,
          messages: [
            { role: 'system', content: 'Summarize the user’s problem as a crisp single sentence (max 28 words). No extra text.' },
            { role: 'user', content: context }
          ]
        });
        const summary = resp.choices?.[0]?.message?.content?.trim();
        if (summary) finalIssue = summary.slice(0, 240);
      }
    } catch (e) {
      // If summarization fails, keep provided issue
    }

    // Simple department routing based on category
    const departmentMap = (cat) => {
      const c = (cat||'').toLowerCase();
      if (c.includes('order') || c.includes('return')) return 'support';
      if (c.includes('ship') || c.includes('delivery')) return 'ops';
      if (c.includes('payment')) return 'sales';
      if (c.includes('quality') || c.includes('sizing')) return 'production';
      return 'support';
    };

    const docData = {
      threadId,
      mobile,
      email,
      category,
      subcategory,
      issue: finalIssue,
      aiResponse,
      chatLogId,
      status: "pending",
      resolvedBy: "ai",
      department: departmentMap(category),
    };

    // Only include userId if it's a valid MongoDB ObjectId
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      docData.userId = userId;
    }

    const doc = await SupportRequest.create(docData);

    return NextResponse.json({ ok: true, id: doc._id, chatLogId });
  } catch (err) {
    console.error('Support request POST failed', err);
    return NextResponse.json({ error: 'Failed to create support request' }, { status: 500 });
  }
}
