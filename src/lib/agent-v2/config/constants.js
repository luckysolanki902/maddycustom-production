// Agent V2 Configuration Constants

export const MODELS = {
  CLASSIFIER: process.env.OPENAI_AGENT_MODEL_CLASSIFIER || 'gpt-4.1-mini',
  DATA_QUERY: process.env.OPENAI_AGENT_MODEL_DATA || 'gpt-4.1',
  VECTOR_STORE: process.env.OPENAI_AGENT_MODEL_VECTOR || 'gpt-4.1-mini',
  DIRECT_ANSWER: process.env.OPENAI_AGENT_MODEL_DIRECT || 'gpt-4.1-nano',
  HANDOFF: process.env.OPENAI_AGENT_MODEL_DIRECT || 'gpt-4.1-nano',
};

export const VECTOR_STORE_ID = process.env.OPENAI_VECTOR_STORE_ID || '';

export const LIMITS = {
  // Message limits
  MAX_MESSAGE_LENGTH: 1000,
  MIN_MESSAGE_LENGTH: 1,
  
  // Context limits
  MAX_CONTEXT_ITEMS: 10,
  SUMMARY_THRESHOLD: 10, // Generate summary after this many messages
  MAX_CONTEXT_TOKENS: 4096,
  
  // Pagination
  DEFAULT_PAGE_SIZE: 6,
  MAX_PAGE_SIZE: 10,
  
  // Response limits
  MAX_RESPONSE_LENGTH: 2000,
  GPT_REPLY_CHAR_LIMIT: 200,
  
  // Rate limiting
  MAX_REQUESTS_PER_MINUTE: 20,
  MAX_REQUESTS_PER_HOUR: 200,
  
  // Timeouts
  AGENT_TIMEOUT_MS: 30000,
  TOOL_TIMEOUT_MS: 10000,
};

export const CACHE_TTL = {
  CATEGORIES: 5 * 60 * 1000, // 5 minutes
  PRODUCTS: 2 * 60 * 1000,   // 2 minutes
  SESSIONS: 30 * 60 * 1000,  // 30 minutes
};

export const HUMAN_HANDOFF = {
  WHATSAPP_LINK: 'https://wa.me/918112673988',
  PHONE: '8112673988',
};

export const CLASSIFICATION_CATEGORIES = {
  DATA_QUERY: 'DATA_QUERY',
  VECTOR_STORE: 'VECTOR_STORE',
  DIRECT_ANSWER: 'DIRECT_ANSWER',
  HUMAN_HANDOFF: 'HUMAN_HANDOFF',
};

// Greeting tokens for fast-path detection
export const GREETING_TOKENS = new Set([
  'hi', 'hii', 'hiii', 'hello', 'helo', 'hey', 'heyy', 'heyyy', 
  'hola', 'namaste', 'yo', 'sup', 'hai', 'hlo', 'hloo'
]);

// Keywords that suggest data query intent
export const DATA_QUERY_KEYWORDS = new Set([
  'product', 'products', 'item', 'items', 'wrap', 'wraps', 'design', 'designs',
  'sticker', 'stickers', 'decal', 'decals', 'fragrance', 'fragrances',
  'keychain', 'keychains', 'accessory', 'accessories', 'helmet', 'bonnet',
  'roof', 'pillar', 'tank', 'hood', 'bike', 'car', 'scooter', 'motorcycle',
  'order', 'track', 'tracking', 'status', 'delivery', 'shipment', 'shipping',
  'price', 'cost', 'budget', 'cheap', 'expensive', 'affordable',
  'show', 'find', 'search', 'browse', 'category', 'categories'
]);

// Keywords that suggest vector store/FAQ query
export const VECTOR_STORE_KEYWORDS = new Set([
  'how', 'what', 'why', 'when', 'where', 'can', 'does', 'do', 'is', 'are',
  'policy', 'policies', 'return', 'refund', 'exchange', 'warranty',
  'install', 'installation', 'apply', 'application', 'remove', 'removal',
  'care', 'maintain', 'maintenance', 'clean', 'cleaning',
  'material', 'quality', 'durability', 'last', 'lifetime',
  'company', 'about', 'contact', 'support', 'help',
  'faq', 'question', 'questions'
]);

// Keywords that suggest human handoff needed
export const HANDOFF_KEYWORDS = new Set([
  'complaint', 'complain', 'angry', 'frustrated', 'disappointed',
  'speak', 'talk', 'human', 'person', 'agent', 'manager',
  'urgent', 'emergency', 'immediately', 'asap',
  'legal', 'lawyer', 'sue', 'court',
  'damaged', 'broken', 'defective', 'wrong', 'missing'
]);
