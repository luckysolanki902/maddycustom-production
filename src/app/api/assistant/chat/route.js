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

const SIMPLE_GREETING_TOKENS = new Set([
  'hi', 'hii', 'hiii', 'hello', 'helo', 'hey', 'heyy', 'heyyy', 'hola', 'namaste', 'yo', 'sup', 'hai', 'hlo', 'hloo', 'hola', 'hey there', 'hi there', 'hello there'
]);

const normalizeGreetingCandidate = (text) => {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
};

const detectGreetingReply = (text) => {
  const normalized = normalizeGreetingCandidate(text);
  if (!normalized) return null;
  if (SIMPLE_GREETING_TOKENS.has(normalized)) {
    return 'Hey! I can help with wraps, fragrances, accessories, or order updates—just let me know what you need.';
  }
  if (normalized.length <= 6 && /^(hi+|hey+|h?ello|yo)$/.test(normalized.replace(/\s+/g, ''))) {
    return 'Hey! I can help with wraps, fragrances, accessories, or order updates—just let me know what you need.';
  }
  return null;
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

const COLOR_KEYWORDS = new Set([
  'red', 'maroon', 'blue', 'navy', 'purple', 'violet', 'pink', 'magenta', 'green', 'lime', 'teal', 'cyan',
  'black', 'white', 'silver', 'gold', 'yellow', 'orange', 'bronze', 'gray', 'grey', 'brown', 'cream', 'beige',
  'matte', 'gloss', 'chrome', 'carbon', 'pearlescent', 'neon'
]);

const RELATION_KEYWORDS = new Set([
  'dad', 'father', 'mom', 'mother', 'brother', 'sister', 'husband', 'wife', 'boyfriend', 'girlfriend',
  'friend', 'partner', 'son', 'daughter', 'uncle', 'aunt', 'boss'
]);

const PRODUCT_INTENT_KEYWORDS = new Set([
  'wrap', 'wraps', 'design', 'designs', 'sticker', 'stickers', 'decal', 'decals', 'skin', 'skins', 'fragrance',
  'fragrances', 'perfume', 'perfumes', 'freshener', 'fresheners', 'keychain', 'keychains', 'accessory',
  'accessories', 'helmet', 'bonnet', 'roof', 'pillar', 'tank', 'hood', 'bike', 'car', 'scooter', 'scooty',
  'motorcycle', 'automotive', 'vinyl', 'graphics', 'gift', 'present', 'theme', 'variant', 'collection'
]);

const PRODUCT_STOP_WORDS = new Set([
  'my', 'for', 'the', 'and', 'with', 'that', 'this', 'have', 'some', 'show', 'give', 'need', 'want', 'your',
  'from', 'please', 'kindly', 'just', 'about', 'what', 'something', 'like', 'can', 'you', 'me', 'our', 'his',
  'her', 'their', 'its', 'any', 'more', 'also', 'make', 'into', 'looking', 'budget', 'under', 'less', 'than',
  'below', 'within', 'help', 'idea', 'ideas', 'options', 'option', 'maybe', 'would', 'could', 'there', 'available',
  'good', 'best', 'tell', 'suggest', 'recommend', 'price', 'range', 'color', 'colour', 'colors', 'colours', 'on',
  'is', 'in', 'it', 'of', 'a', 'to', 'wow', 'awesome', 'nice', 'cool', 'unique', 'need', 'budget'
]);

const PRODUCT_DOMAIN_HINTS = [
  { word: 'car', category: null, diversify: true, keyword: 'car' },
  { word: 'bike', category: 'bike wrap', diversify: false, keyword: 'bike' },
  { word: 'motorcycle', category: 'bike wrap', diversify: false, keyword: 'bike' },
  { word: 'scooter', category: 'bike wrap', diversify: false, keyword: 'scooter' },
  { word: 'scooty', category: 'bike wrap', diversify: false, keyword: 'scooty' },
  { word: 'helmet', category: 'helmet wrap', diversify: false, keyword: 'helmet' },
  { word: 'bonnet', category: 'bonnet wrap', diversify: false, keyword: 'bonnet' },
  { word: 'hood', category: 'bonnet wrap', diversify: false, keyword: 'hood' },
  { word: 'roof', category: 'roof wrap', diversify: false, keyword: 'roof' },
  { word: 'pillar', category: 'window pillar wrap', diversify: false, keyword: 'pillar' },
  { word: 'window', category: 'window pillar wrap', diversify: false, keyword: 'window' },
  { word: 'tank', category: 'tank wrap', diversify: false, keyword: 'tank' },
  { word: 'interior', category: 'car interiors', diversify: false, keyword: 'interior' },
  { word: 'dashboard', category: 'car interiors', diversify: false, keyword: 'dashboard' },
  { word: 'fragrance', category: 'car fragrance', diversify: false, keyword: 'fragrance' },
  { word: 'freshener', category: 'car fragrance', diversify: false, keyword: 'freshener' },
  { word: 'perfume', category: 'car fragrance', diversify: false, keyword: 'perfume' },
  { word: 'keychain', category: null, diversify: false, keyword: 'keychain' },
  { word: 'sticker', category: null, diversify: false, keyword: 'sticker' },
  { word: 'decal', category: null, diversify: false, keyword: 'decal' },
  { word: 'jdm', category: null, diversify: true, keyword: 'jdm' }
];

const PRODUCT_NEGATION_PATTERNS = [
  /how long/i,
  /how much time/i,
  /\bmaterial\b/i,
  /\bdurability\b/i,
  /\binstall/i,
  /\binstallation\b/i,
  /\bcare\b/i,
  /\bmaintenance\b/i,
  /\bwarranty\b/i,
  /\breturn\b/i,
  /\brefund\b/i,
  /\bexchange\b/i,
  /\bpolicy\b/i,
  /\bwhere is my order\b/i,
  /\border status\b/i,
  /\btrack (?:my )?order\b/i,
  /\btracking (?:my )?order\b/i,
  /\bshipping time\b/i,
  /\bdelivery time\b/i,
  /\bhow soon\b/i
];

const sanitizeToken = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
};

const extractSearchHints = (text) => {
  if (!text || typeof text !== 'string') return null;
  const lowered = text.toLowerCase();
  if (!lowered.trim()) return null;
  if (PRODUCT_NEGATION_PATTERNS.some(rx => rx.test(lowered))) return null;

  const tokens = lowered.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;

  const keywordSet = new Set();
  let categoryTitle = null;
  let hasDomain = false;
  let diversify = false;

  for (const hint of PRODUCT_DOMAIN_HINTS) {
    if (lowered.includes(hint.word)) {
      hasDomain = true;
      if (hint.keyword) keywordSet.add(hint.keyword);
      if (!categoryTitle && hint.category) categoryTitle = hint.category;
      if (hint.diversify) diversify = true;
    }
  }

  const colorMatches = tokens.filter(word => COLOR_KEYWORDS.has(word));
  colorMatches.forEach(word => keywordSet.add(word));

  const relationMatches = tokens.filter(word => RELATION_KEYWORDS.has(word));
  relationMatches.forEach(word => keywordSet.add(word));

  const productIntentMatches = tokens.filter(word => PRODUCT_INTENT_KEYWORDS.has(word));
  productIntentMatches.forEach(word => keywordSet.add(word));

  const hasGift = lowered.includes('gift') || lowered.includes('present');
  if (hasGift) {
    keywordSet.add('gift');
  }

  let maxPrice = null;
  const budgetPattern = /\b(?:budget(?: is| of|=)?|under|less than|below|within|upto|up to)\s*(?:rs\.?|₹|rupees?)?\s*(\d{2,6})/i;
  const currencyPattern = /(?:₹|rs\.?|rupees?)\s*(\d{2,6})/i;
  const reverseCurrencyPattern = /(\d{2,6})\s*(?:₹|rs\.?|rupees?)/i;
  let match = budgetPattern.exec(lowered);
  if (match) {
    maxPrice = Number(match[1]);
  } else {
    match = currencyPattern.exec(lowered);
    if (match) {
      maxPrice = Number(match[1]);
    } else {
      match = reverseCurrencyPattern.exec(lowered);
      if (match) {
        maxPrice = Number(match[1]);
      }
    }
  }
  if (!maxPrice && /\b(?:budget|under|less than|below|within|upto|up to)\b/.test(lowered)) {
    const numberMatch = lowered.match(/\b\d{2,6}\b/);
    if (numberMatch) {
      const candidate = Number(numberMatch[0]);
      if (candidate > 10 && candidate <= 200000) {
        maxPrice = candidate;
      }
    }
  }

  if (!hasDomain && productIntentMatches.length === 0 && colorMatches.length === 0 && !hasGift) {
    return null;
  }

  const significantTokens = tokens
    .map(sanitizeToken)
    .filter(token => token && !PRODUCT_STOP_WORDS.has(token));
  for (const token of significantTokens) {
  if (keywordSet.size >= 8) break;
  if (/^\d+$/.test(token)) continue;
    keywordSet.add(token);
  }

  const keywords = Array.from(keywordSet).filter(Boolean).slice(0, 8);
  const args = {};
  if (categoryTitle) args.categoryTitle = categoryTitle;
  if (typeof maxPrice === 'number') args.maxPrice = maxPrice;
  if (keywords.length) args.keywords = keywords;
  if (!categoryTitle && (diversify || hasDomain)) {
    args.diversifyCategories = true;
    args.limit = 10;
  }
  if (!args.limit) {
    args.limit = categoryTitle ? 6 : 10;
  }

  if (!args.categoryTitle && !args.keywords && typeof args.maxPrice !== 'number') {
    return null;
  }

  return {
    shouldForce: hasDomain || productIntentMatches.length > 0 || colorMatches.length > 0 || hasGift,
    args
  };
};

const mergeSearchArgs = (existingArgs = {}, extraArgs = {}) => {
  if (!extraArgs || typeof extraArgs !== 'object') {
    return { ...existingArgs };
  }
  const merged = { ...existingArgs };
  if (extraArgs.categoryTitle && !merged.categoryTitle) {
    merged.categoryTitle = extraArgs.categoryTitle;
  }
  if (typeof extraArgs.maxPrice === 'number') {
    if (merged.maxPrice === undefined || extraArgs.maxPrice < merged.maxPrice) {
      merged.maxPrice = extraArgs.maxPrice;
    }
  }
  const keywordSet = new Set();
  if (Array.isArray(existingArgs.keywords)) {
    existingArgs.keywords.forEach(keyword => {
      if (keyword) keywordSet.add(String(keyword));
    });
  }
  if (Array.isArray(extraArgs.keywords)) {
    extraArgs.keywords.forEach(keyword => {
      if (keyword) keywordSet.add(String(keyword));
    });
  }
  if (keywordSet.size) {
    merged.keywords = Array.from(keywordSet).slice(0, 8);
  }
  if (extraArgs.diversifyCategories) {
    merged.diversifyCategories = true;
  }
  if (extraArgs.limit) {
    const capped = Math.min(10, Math.max(1, Number(extraArgs.limit) || 0));
    if (!merged.limit || capped > merged.limit) {
      merged.limit = capped;
    }
  }
  if (!merged.limit) {
    merged.limit = 6;
  }
  if (extraArgs.query && !merged.query) {
    merged.query = extraArgs.query;
  }
  return merged;
};

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
  const products = Array.isArray(output?.products) ? output.products : [];
  if (!products.length) return '';

  const limit = typeof input?.limit === 'number' ? input.limit : (typeof output?.limit === 'number' ? output.limit : 6);

  const highlights = products.slice(0, Math.min(products.length, 2)).map(item => {
    const price = typeof item.price === 'number' ? formatINR(item.price) : null;
    return price ? `${item.title || 'Option'} (${price})` : (item.title || 'Option');
  });

  const prices = products
    .map(p => (typeof p.price === 'number' && !Number.isNaN(p.price) ? p.price : null))
    .filter(v => v !== null);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const budgetCap = typeof input?.maxPrice === 'number'
    ? input.maxPrice
    : (typeof output?.queryEcho?.maxPrice === 'number' ? output.queryEcho.maxPrice : null);

  const keywordPool = new Set();
  const appendKeywords = (values) => {
    if (!values) return;
    const arr = Array.isArray(values) ? values : [values];
    arr.forEach(val => {
      if (typeof val === 'string' && val.trim()) {
        keywordPool.add(val.trim().toLowerCase());
      }
    });
  };
  appendKeywords(input?.keywords);
  appendKeywords(output?.queryEcho?.keywords);
  const queryText = typeof input?.query === 'string' && input.query.trim()
    ? input.query
    : (typeof output?.queryEcho?.query === 'string' ? output.queryEcho.query : '');
  if (queryText) {
    queryText.toLowerCase().split(/[^a-z0-9]+/g).forEach(tok => tok && keywordPool.add(tok));
  }

  const FINISH_KEYWORDS = new Set(['matte', 'gloss', 'chrome', 'carbon', 'pearlescent', 'neon']);
  let dominantColor = null;
  for (const word of keywordPool) {
    if (COLOR_KEYWORDS.has(word) && !FINISH_KEYWORDS.has(word)) {
      dominantColor = word;
      break;
    }
  }
  let dominantFinish = null;
  if (!dominantColor) {
    for (const word of keywordPool) {
      if (FINISH_KEYWORDS.has(word)) {
        dominantFinish = word;
        break;
      }
    }
  }

  const ACCENT_SUGGESTIONS = {
    red: 'black',
    blue: 'black',
    black: 'silver',
    white: 'black',
    green: 'black',
    orange: 'black',
    yellow: 'black',
    pink: 'white',
    purple: 'black',
    maroon: 'black'
  };

  const rideContext = /\bbike\b/i.test(queryText) ? 'bike' : (/\bcar\b/i.test(queryText) ? 'car' : 'ride');

  const listToSentence = (items = []) => {
    if (!items.length) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    const head = items.slice(0, -1).join(', ');
    return `${head}, and ${items[items.length - 1]}`;
  };

  const GENERIC_KEYWORDS = new Set(['wrap', 'wraps', 'design', 'designs', 'product', 'products', 'something', 'show', 'suggest', 'need', 'want', 'theme', 'option', 'options', 'bike', 'car', 'ride']);
  const orderedKeywords = Array.from(keywordPool);
  const primaryKeyword = orderedKeywords.find(word => !GENERIC_KEYWORDS.has(word) && !COLOR_KEYWORDS.has(word) && !RELATION_KEYWORDS.has(word));

  const normalizedCategory = String(input?.categoryTitle || output?.queryEcho?.categoryTitle || '').toLowerCase();
  const categoryContext = (() => {
    if (/interior/.test(normalizedCategory) || orderedKeywords.includes('interior')) return 'interior';
    if (/fragrance|perfume|scent/.test(normalizedCategory) || orderedKeywords.some(k => /fragrance|perfume|scent/.test(k))) return 'fragrance';
    if (rideContext === 'bike') return 'bike';
    return 'car';
  })();

  const pairingSuggestions = {
    car: ['bonnet wrap', 'window pillar wrap', 'fuel cap wrap'],
    bike: ['tank wrap', 'helmet wrap', 'visor strip wrap'],
    interior: ['dashboard trim overlay', 'console accent kit', 'door handle sleeves'],
    fragrance: ['vent perfume pods', 'hanging diffuser', 'underseat sachet'],
    default: ['bonnet wrap', 'window pillar wrap', 'boot garnish wrap']
  };
  const basePairings = pairingSuggestions[categoryContext] || pairingSuggestions.default;
  const withArticle = (phrase = '') => {
    if (/^(?:an?|the)\s/i.test(phrase)) return phrase;
    const trimmed = phrase.trim();
    if (!trimmed) return phrase;
    const startsVowel = /^[aeiou]/i.test(trimmed);
    return `${startsVowel ? 'an' : 'a'} ${trimmed}`;
  };
  const pairingWithArticles = basePairings.slice(0, 3).map(withArticle);
  const pairingSentence = 
  // let's use static sentence for now
  "Here are the best picks for you"
  // listToSentence(pairingWithArticles);

  const currencyRange = (() => {
    if (budgetCap) return formatINR(budgetCap);
    if (maxPrice && minPrice && maxPrice !== minPrice) return `${formatINR(minPrice)}–${formatINR(maxPrice)}`;
    if (minPrice) return formatINR(minPrice);
    if (maxPrice) return formatINR(maxPrice);
    return null;
  })();

  const pieces = [];
  if (highlights.length) {
    const leadDescriptor = products.length >= limit ? `top ${limit}` : `${products.length}`;
    pieces.push(`Pulled ${leadDescriptor} options like ${highlights.join(' and ')}.`);
  }

  if (budgetCap) {
    const budgetText = formatINR(budgetCap);
    const floorText = minPrice && minPrice !== budgetCap ? `, opening near ${formatINR(minPrice)}` : '';
    pieces.push(`Everything stays within ${budgetText}${floorText}.`);
  } else if (minPrice && maxPrice && minPrice !== maxPrice) {
    pieces.push(`Pricing hovers roughly between ${formatINR(minPrice)} and ${formatINR(maxPrice)}.`);
  } else if (minPrice) {
    pieces.push(`Pricing starts close to ${formatINR(minPrice)}.`);
  }

  if (pairingSentence) {
    const budgetNote = currencyRange ? ` while staying around ${currencyRange}` : '';
    pieces.push(`Think about layering ${pairingSentence}${budgetNote} to round out the look.`);
  }

  if (dominantColor) {
    pieces.push(`Most picks weave in ${dominantColor} accents so they echo your ${rideContext} instead of feeling tacked on.`);
    const accent = ACCENT_SUGGESTIONS[dominantColor];
    if (accent) {
      pieces.push(`${accent.charAt(0).toUpperCase() + accent.slice(1)} touches add contrast without overpowering the theme if you ever want to dial it up.`);
    }
  } else if (dominantFinish) {
    pieces.push(`There’s a ${dominantFinish} surface running through these picks, keeping glare low and the finish feeling intentional.`);
  }

  const followUpBase = (() => {
    if (primaryKeyword) {
      return `Want me to queue up more ${primaryKeyword} ideas or shift the vibe altogether?`;
    }
    if (dominantColor) {
      return `Should I explore more in this ${dominantColor} lane or add a contrasting accent?`;
    }
    if (budgetCap) {
      return 'Need me to stretch or tighten that budget window?';
    }
    return 'Happy to explore another theme or tweak the budget—just say the word.';
  })();

  if (output?.hasMore) {
    pieces.push(`${followUpBase} I can also line up to 10 more options if you want a broader shortlist.`);
  } else {
    pieces.push(followUpBase);
  }

  return pieces.join(' ');
};

const summarizeCategories = ({ output = {} }) => {
  const items = Array.isArray(output?.items) ? output.items : [];
  if (!items.length) return '';
  const names = items.slice(0, 3).map(item => item.title || 'Category');
  return `Here are categories like ${names.join(', ')}. Tell me which one to open.`;
};

const summarizeOrderStatus = ({ output = {} }) => {
  if (!output) return '';
  if (output.ok === false) {
    return output.error || 'I couldn’t find that order. Could you double-check the ID or phone number?';
  }
  const status = output.status || 'Processing';
  const eta = output.expectedDelivery ? ` ETA ${output.expectedDelivery}.` : '';
  const track = output.trackUrl ? ` Track it here: ${output.trackUrl}` : '';
  const base = `Latest update: ${status}.${eta}${track ? ` ${track}` : ''}`;
  const needsTransitNote = !/delivered/i.test(status || '');
  const transitNote = needsTransitNote
    ? ' Orders typically process in 2-3 business days and reach you within 7-10 business days once dispatched. Couriers attempt delivery up to 3 times with OTP.'
    : '';
  return `${base}${transitNote ? ` ${transitNote}` : ''} Let me know if you need anything else.`;
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
      model: 'gpt-5-nano',
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

const buildInstructionString = (helpingData) => `You are the official support assistant for MaddyCustom. Use the following domain knowledge about products, wraps, installation, shipping, durability, fragrance variants, JDM keychains, ordering & tracking. Never fabricate policies. If unsure, ask the user for clarification. ALWAYS be concise, friendly, respectful and avoid markdown formatting. When the user asks for a human agent, real person, WhatsApp support, or similar handoff, do NOT drop a link immediately. Instead say: "I can redirect you to our human team on WhatsApp (${HUMAN_HANDOFF_PHONE}). Would you like me to open it?" and wait for a clear Yes before sharing ${HUMAN_HANDOFF_LINK}. Domain Knowledge:\n\n${helpingData}`;

const FALLBACK_INSTRUCTIONS = `You are the official support assistant for MaddyCustom. Use your knowledge about products, wraps, installation, shipping, durability, fragrance variants, JDM keychains, ordering & tracking. Never fabricate policies. If unsure, ask the user for clarification. ALWAYS be concise, friendly, respectful and avoid markdown formatting. When the user asks for a human agent, real person, WhatsApp support, or similar handoff, do NOT drop a link immediately. Instead say: "I can redirect you to our human team on WhatsApp (${HUMAN_HANDOFF_PHONE}). Would you like me to open it?" and wait for a clear Yes before sharing ${HUMAN_HANDOFF_LINK}.`;

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
    const messages = ordered
      .filter(entry => (entry.role === 'user' || entry.role === 'assistant') && entry.text)
      .map(entry => ({
        id: `${entry.role}-${new Date(entry.timestamp || Date.now()).getTime()}`,
        role: entry.role,
        text: entry.text || '',
        created_at: new Date(entry.timestamp || Date.now()).toISOString(),
      }));

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
    const { action, message, userId, toolInvocation } = body || {};

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
  const greetingReply = detectGreetingReply(plannerInput);
  if (greetingReply) {
    timeline.mark('greeting_shortcut');
    const classification = { type: 'browse', needsResolutionCheck: false, category: 'general', subcategory: 'greeting' };
    const entries = baseEntries.map(entry => ({ ...entry }));
    const assistantEntry = makeAssistantEntry(greetingReply);
    assistantEntry.meta = { timings: timeline.summary() };
    entries.push(assistantEntry);
    entries.push(makeClassificationEntry(classification));
    await recordChatLog({ userId, threadId, entries });
    timeline.mark('log_recorded');
    timeline.mark('response_ready');
    const timings = timeline.summary();
    logTimings({ userId, threadId, plannerMode: 'shortcut' }, timings);
    return NextResponse.json({ reply: greetingReply, classification, threadId, shortcut: 'greeting', timings });
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
  args: { orderId?: string; phone?: string }
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
- Choose get_order_status only if the user asks to track an order or provides a valid order id or 10-digit phone number tied to the order. 
- Keep args minimal and relevant; do not invent values. Never exceed limit 10. 
- If user says something like window pillar wrap material or finish or something like that don't call a tool; answer directly about material; don't blindly call search_products for every message just because there is a keyword.
- If the user asks for a human agent, real person, customer support number, or WhatsApp support, do not call any tool. Return { action: 'direct_answer', handoff: true }. The direct answer must politely ask "Would you like me to open our human team on WhatsApp (${HUMAN_HANDOFF_PHONE})?" and wait for a clear Yes before sharing ${HUMAN_HANDOFF_LINK}.

Examples:
1) User: "show me all products" → { "action": "call_tool", "tool": "browse_categories", "args": {}, "reason": "Generic browse", "classification": { "type": "browse", "needsResolutionCheck": false, "category": "browse", "subcategory": "category_browse" } }
2) User: "What products do you sell?" → { "action": "call_tool", "tool": "browse_categories", "args": {}, "reason": "Generic browse", "classification": { "type": "browse", "needsResolutionCheck": false, "category": "browse", "subcategory": "category_browse" } }
3) User: "See all product categories" → { "action": "call_tool", "tool": "browse_categories", "args": {}, "reason": "Explicit category request", "classification": { "type": "browse", "needsResolutionCheck": false, "category": "browse", "subcategory": "category_browse" } }
4) User: "show me window pillar wraps" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "window pillar wrap", "keywords": ["pillar","wrap"], "limit": 6 }, "reason": "Specific category", "classification": { "type": "browse", "needsResolutionCheck": false, "category": "browse", "subcategory": "product_search" } }
5) User: "most ordered pillar wraps under 600" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "pillar wrap", "maxPrice": 600, "sortBy": "orders", "limit": 10 }, "reason": "Popularity sort with budget", "classification": { "type": "browse", "needsResolutionCheck": false, "category": "browse", "subcategory": "product_search" } }
6) User: "Suggest some red designs" → { "action": "call_tool", "tool": "search_products", "args": { "keywords": ["red"], "limit": 6 }, "reason": "Color-based search" }
7) User: "Show me anime-themed wraps" → { "action": "call_tool", "tool": "search_products", "args": { "keywords": ["anime"], "limit": 6 }, "reason": "Theme-based search" }
8) User: "track 64abc...ef" → { "action": "call_tool", "tool": "get_order_status", "args": { "orderId": "64abc...ef" }, "reason": "Order tracking", "classification": { "type": "query", "needsResolutionCheck": true, "category": "order_status", "subcategory": "tracking" } }
9) User: "Track my order with phone 1234567890" → { "action": "call_tool", "tool": "get_order_status", "args": { "phone": "9436151594" }, "reason": "Phone-based order lookup", "classification": { "type": "query", "needsResolutionCheck": true, "category": "order_status", "subcategory": "tracking" } }
10) User: "Where is my order?" → { "action": "direct_answer", "reason": "Ask for order ID or phone", "classification": { "type": "query", "needsResolutionCheck": true, "category": "order_status", "subcategory": "tracking" } }
11) User: "Track my new order" → { "action": "direct_answer", "reason": "Ask for order ID or phone", "classification": { "type": "query", "needsResolutionCheck": true, "category": "order_status", "subcategory": "tracking" } }
12) User: "show something for bike" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "bike wrap", "keywords": ["bike"], "limit": 6 }, "reason": "User mentioned bike; choose closest category from list", "classification": { "type": "browse", "needsResolutionCheck": false, "category": "browse", "subcategory": "product_search" } }
13) User: "Do you have something for my bike?" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "bike wrap", "keywords": ["bike"], "limit": 6 }, "reason": "Bike-related query", "classification": { "type": "browse", "needsResolutionCheck": false, "category": "browse", "subcategory": "product_search" } }
13) User: "Show me something for my car" → { "action": "call_tool", "tool": "search_products", "args": { "keywords": ["car"], "diversifyCategories": true, "limit": 10 }, "reason": "Generic car domain; diversify across categories" }
14) User: "show something for car interiors" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "car interiors", "keywords": ["car","interior"], "limit": 6 }, "reason": "User mentioned car interiors" }
15) User: "car roof" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "roof wrap", "limit": 6 }, "reason": "Roof wraps for car" }
16) User: "Show me something for my car roof" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "roof wrap", "keywords": ["car","roof"], "limit": 6 }, "reason": "Car roof specific" }
17) User: "show me something for my red car" → { "action": "call_tool", "tool": "search_products", "args": { "keywords": ["car","red"], "diversifyCategories": true, "limit": 10 }, "reason": "Generic car domain with color; diversify across categories" }
18) User: "Suggest a car freshener I can gift my dad" → { "action": "call_tool", "tool": "search_products", "args": { "categoryTitle": "car fragrance", "keywords": ["fragrance","freshener"], "limit": 6 }, "reason": "Car fragrance/freshener query", "classification": { "type": "browse", "needsResolutionCheck": false, "category": "browse", "subcategory": "product_search" } }
19) User: "Do you ship across India?" → { "action": "direct_answer", "reason": "Shipping policy question", "classification": { "type": "query", "needsResolutionCheck": false, "category": "shipping_time", "subcategory": "shipping_policy" } }
20) User: "What material is used?" → { "action": "direct_answer", "reason": "Material question; answer from knowledge base", "classification": { "type": "query", "needsResolutionCheck": false, "category": "product_quality", "subcategory": "materials" } }
21) User: "How long does the product last?" → { "action": "direct_answer", "reason": "Durability question", "classification": { "type": "query", "needsResolutionCheck": false, "category": "product_quality", "subcategory": "durability" } }
22) User: "Wrap durability and care" → { "action": "direct_answer", "reason": "Care instructions question", "classification": { "type": "query", "needsResolutionCheck": false, "category": "product_quality", "subcategory": "care" } }
23) User: "How long does shipping take?" → { "action": "direct_answer", "reason": "Shipping time question", "classification": { "type": "query", "needsResolutionCheck": false, "category": "shipping_time", "subcategory": "eta" } }
24) User: "Shipping time details" → { "action": "direct_answer", "reason": "Shipping policy question", "classification": { "type": "query", "needsResolutionCheck": false, "category": "shipping_time", "subcategory": "policy" } }
25) User: "Can I change the shipping address?" → { "action": "direct_answer", "reason": "Order modification question", "classification": { "type": "query", "needsResolutionCheck": false, "category": "order_status", "subcategory": "modification" } }
26) User: "How long until delivery?" → { "action": "direct_answer", "reason": "Delivery time question", "classification": { "type": "query", "needsResolutionCheck": false, "category": "shipping_time", "subcategory": "eta" } }
27) User: "When will packaging start?" → { "action": "direct_answer", "reason": "Order processing question", "classification": { "type": "query", "needsResolutionCheck": false, "category": "order_status", "subcategory": "processing" } }
28) User: "Order tracking support" → { "action": "direct_answer", "reason": "Ask for order ID or phone for tracking", "classification": { "type": "query", "needsResolutionCheck": true, "category": "order_status", "subcategory": "tracking" } } 
29) User: "I want to talk to a real person" → { "action": "direct_answer", "handoff": true, "reason": "Offer WhatsApp human support", "classification": { "type": "query", "needsResolutionCheck": false, "category": "customer_support", "subcategory": "human_handoff" } }
30) User: "My car is red and my budget is 500" → { "action": "call_tool", "tool": "search_products", "args": { "keywords": ["car","red", "black"], "maxPrice": 500, "diversifyCategories": true, "limit": 10 }, "reason": "Generic car domain with color and budget; diversify across categories" } // black here because black will look good with red car
Also set classification for the current user message:
classification: {
  type: 'browse' | 'query' | 'general',
  needsResolutionCheck: boolean,
  category: 'order_status' | 'shipping_time' | 'product_quality' | 'sizing_help' | 'returns_policy' | 'payment_issue' | 'general' | 'browse' | 'customer_support' | 'other',
  subcategory?: string
}
If you propose a WhatsApp handoff, set category to customer_support and subcategory to human_handoff.

Decision JSON schema:
{ "action": "call_tool" | "direct_answer", "tool"?: "search_products"|"get_order_status"|"browse_categories", "args"?: object, "reason": string, "handoff"?: boolean, "classification"?: { ... } }
`;
  const searchHint = extractSearchHints(plannerMessage);
    // If client explicitly invoked a tool, honor it to avoid planner overriding color/style searches
    let plan = null;
    if (!action && plannerMode !== 'rule' && searchHint?.shouldForce) {
      plan = {
        action: 'call_tool',
        tool: 'search_products',
        args: mergeSearchArgs({}, searchHint.args || {}),
        reason: 'Detected strong product intent (pre-planner)',
        classification: classificationForTool('search_products')
      };
    }
    if (!plan && (action === 'tool:search_products' || action === 'tool:get_order_status' || action === 'tool:browse_categories')) {
      const map = { 'tool:search_products': 'search_products', 'tool:get_order_status': 'get_order_status', 'tool:browse_categories': 'browse_categories' };
      const toolName = map[action];
      plan = {
        action: 'call_tool',
        tool: toolName,
        args: toolInvocation || {},
        reason: 'client-requested tool',
        classification: classificationForTool(toolName)
      };
    }
    if (!plan) {
      let rawPlan = '{}';
      if (plannerMode === 'rule') {
        const p = ruleBasedPlan(plannerMessage || '');
        rawPlan = JSON.stringify(p);
      } else {
        const planner = await client.chat.completions.create({
          model: 'gpt-5-nano',
          max_completion_tokens:500,
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

    if (plan?.action === 'call_tool' && plan.tool === 'search_products') {
      plan.args = mergeSearchArgs(plan.args || {}, searchHint?.args || {});
    } else if (plan?.action === 'call_tool' && plan.tool === 'browse_categories' && searchHint?.shouldForce) {
      plan.tool = 'search_products';
      plan.args = mergeSearchArgs({}, searchHint.args || {});
      plan.reason = `${plan.reason || 'browse request'} (escalated to targeted search)`;
      plan.classification = classificationForTool('search_products');
    } else if (!plan?.handoff && plan?.action === 'direct_answer' && searchHint?.shouldForce) {
      plan = {
        action: 'call_tool',
        tool: 'search_products',
        args: mergeSearchArgs({}, searchHint.args || {}),
        reason: `${plan.reason || 'direct answer'} (product search override)`,
        classification: classificationForTool('search_products')
      };
    }

    let planClassification = normalizeClassification(plan?.classification);
    if (planClassification) {
      plan.classification = planClassification;
    }

    if (searchHint?.shouldForce) {
      if (!plan || plan.action === 'direct_answer') {
        plan = {
          action: 'call_tool',
          tool: 'search_products',
          args: mergeSearchArgs(plan?.args || {}, searchHint.args || {}),
          reason: `${plan?.reason || 'product intent detected'} (forced product search)`,
          classification: classificationForTool('search_products')
        };
      } else if (plan.action === 'call_tool' && plan.tool === 'browse_categories') {
        plan = {
          ...plan,
          tool: 'search_products',
          args: mergeSearchArgs(plan.args || {}, searchHint.args || {}),
          reason: `${plan.reason || 'category browse'} (upgraded to product search)`,
          classification: classificationForTool('search_products')
        };
      } else if (plan.action === 'call_tool' && plan.tool === 'search_products') {
        plan = {
          ...plan,
          args: mergeSearchArgs(plan.args || {}, searchHint.args || {})
        };
      }

      if (plan?.classification) {
        const ensured = normalizeClassification(plan.classification) || classificationForTool('search_products');
        if (ensured) {
          plan.classification = ensured;
        }
      }
      planClassification = normalizeClassification(plan?.classification);
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
        if (composed) {
          assistantEntry = makeAssistantEntry(composed);
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
        timeline.mark('tool_execution_done', { tool });
        if (!result?.products?.length && result?.fallback === 'browse_categories') {
          const toRelativeLink = (link) => { if (!link) return link; try { if (/^https?:\/\//i.test(link)) { const u = new URL(link); return (u.pathname||'/')+(u.search||'')+(u.hash||''); } if (/^\/\//.test(link)) { const u = new URL('https:'+link); return (u.pathname||'/')+(u.search||'')+(u.hash||''); } return link.startsWith('/')?link:'/'+link; } catch { return link.startsWith('/')?link:'/'+link; } };
          const { assets = [] } = await fetchDisplayAssets('homepage');
          const cats = (assets || []).filter(a => a?.isActive && (a?.componentName === 'category-grid' || a?.componentName === 'category-slider'));
          const items = cats.map(a => ({ title: a?.content || a?.title || 'Category', image: a?.media?.desktop || a?.media?.mobile || null, link: toRelativeLink(a?.link || '#') }));
          const hint = 'Couldn’t find items that match. Want to browse by category? For example, say “Window Pillar Wrap”.';
          const composed = await composeToolReply({ kind: 'browse_categories', input: args, output: { title: 'Shop by Category', items, hint } });
          timeline.mark('compose_reply_done', { tool: 'browse_categories' });
          const classification = classificationForTool('browse_categories') || planClassification || await classifyUserMessage({ text: plannerMessage, tool: 'browse_categories' });
          if (classification) {
            const usedPlanClassification = classification === planClassification;
            timeline.mark('classification_done', { via: usedPlanClassification ? 'plan' : 'tool-fallback', type: classification?.type });
          }
          timeline.mark('tool_fallback', { from: tool, to: 'browse_categories' });
          const entries = baseEntries.map(entry => ({ ...entry }));
          entries.push(
            makeToolEntry(
              tool,
              pruneToolArgs(tool, args),
              summarizeToolResult(tool, result)
            )
          );
          let assistantEntry = null;
          if (composed) {
            assistantEntry = makeAssistantEntry(composed);
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
          return NextResponse.json({ tool: 'browse_categories', data: { title: 'Shop by Category', items, hint }, reply: composed, classification, threadId, timings });
        }
        const composed = await composeToolReply({ kind: 'search_products', input: args, output: result });
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
        if (composed) {
          assistantEntry = makeAssistantEntry(composed);
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
        if (composed) {
          assistantEntry = makeAssistantEntry(composed);
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
        return NextResponse.json({ tool: 'browse_categories', data: { title: 'Shop by Category', items, hint }, reply: composed, classification, threadId, timings });
      }
    }

    // 3) Direct answer path: invoke Responses API for the reply
    timeline.mark('instructions_fetch_start');
    const instructions = await getAssistantInstructions();
    timeline.mark('instructions_ready');
    timeline.mark('assistant_invoke_start');
    const response = await client.responses.create({
      model: 'gpt-5-nano',
      instructions,
      input: [
        {
          role: 'user',
          content: messageForThread,
        },
      ],
      previous_response_id: previousResponseId || undefined,
    });
    timeline.mark('assistant_invoke_done');

    const reply = response.output_text?.trim() || 'No reply from assistant';
    sessionDoc.responseId = response.id;
    await sessionDoc.save();
    timeline.mark('session_persisted');

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
