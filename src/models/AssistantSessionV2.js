// AssistantSessionV2 Model - Session storage for Agent V2
import mongoose from 'mongoose';

const sessionItemSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['message', 'tool_call', 'tool_result'],
    default: 'message'
  },
  role: { 
    type: String, 
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now },
  tokenCount: Number,
}, { _id: false });

const paginationSchema = new mongoose.Schema({
  query: String,
  categoryTitle: String,
  filters: {
    minPrice: Number,
    maxPrice: Number,
    keywords: [String],
  },
  currentPage: { type: Number, default: 1 },
  pageSize: { type: Number, default: 6 },
  totalResults: Number,
  hasMore: Boolean,
}, { _id: false });

const metadataSchema = new mongoose.Schema({
  totalMessages: { type: Number, default: 0 },
  totalTokensUsed: { type: Number, default: 0 },
  lastClassification: String,
  conversationSummary: String,
  lastActiveAt: { type: Date, default: Date.now },
}, { _id: false });

const assistantSessionV2Schema = new mongoose.Schema({
  sessionId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  threadId: { 
    type: String, 
    index: true,
    sparse: true // Allow null values
  },
  
  // Conversation items
  items: [sessionItemSchema],
  
  // Metadata
  metadata: {
    type: metadataSchema,
    default: () => ({})
  },
  
  // Pagination state
  pagination: {
    type: paginationSchema,
    default: null
  },
  
}, { 
  timestamps: true,
  collection: 'assistantsessionsv2'
});

// Indexes for efficient queries
assistantSessionV2Schema.index({ userId: 1, 'metadata.lastActiveAt': -1 });
assistantSessionV2Schema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // 30 day TTL

// Virtual for item count
assistantSessionV2Schema.virtual('itemCount').get(function() {
  return this.items?.length || 0;
});

// Instance methods
assistantSessionV2Schema.methods.addItem = function(item) {
  this.items.push({
    ...item,
    timestamp: new Date(),
  });
  this.metadata.totalMessages += 1;
  this.metadata.lastActiveAt = new Date();
  return this.save();
};

assistantSessionV2Schema.methods.getRecentItems = function(limit = 10) {
  if (!this.items || this.items.length === 0) return [];
  const start = Math.max(this.items.length - limit, 0);
  return this.items.slice(start);
};

// Static methods
assistantSessionV2Schema.statics.findByUserId = function(userId, options = {}) {
  const { limit = 10, skip = 0 } = options;
  return this.find({ userId })
    .sort({ 'metadata.lastActiveAt': -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

assistantSessionV2Schema.statics.findOrCreateSession = async function(sessionId, userId) {
  let session = await this.findOne({ sessionId });
  if (!session) {
    session = await this.create({
      sessionId,
      userId,
      items: [],
      metadata: {
        totalMessages: 0,
        totalTokensUsed: 0,
        lastActiveAt: new Date(),
      },
    });
  }
  return session;
};

// Ensure model is only compiled once
const AssistantSessionV2 = mongoose.models.AssistantSessionV2 || 
  mongoose.model('AssistantSessionV2', assistantSessionV2Schema);

export default AssistantSessionV2;
