const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  // User information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional for guests
    index: true,
  },
  phoneNumber: {
    type: String,
    required: true,
    index: true,
  },
  email: {
    type: String,
    required: false,
    index: true,
  },
  userName: {
    type: String,
    required: false,
  },
  
  // Notification details
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NotificationTemplate',
    required: true,
    index: true,
  },

  // Notification type for categorization
  notificationType: {
    type: String,
    required: true,
    enum: [
      'restocking',
      'abandoned_cart_1',
      'abandoned_cart_2', 
      'abandoned_cart_3',
      'order_confirmed',
      'order_shipped',
      'order_delivered',
      'order_cancelled',
      'price_drop',
      'back_in_stock',
      'low_stock_alert',
      'welcome_series',
      'review_request',
      'winback_campaign',
      'promotional',
      'custom'
    ],
  },

  // Human-friendly unique name for this notification (requested unique)
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  
  // Variables to replace in templates
  variables: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  
  // Channels to use for this notification
  channels: [{
    type: String,
    enum: ['sms', 'whatsapp', 'email'], // email feature is not availabe yet
    required: true,
  }],
  
  // WhatsApp-specific parameters for dynamic content
  whatsappParams: {
    templateParams: [String], // Dynamic values for template placeholders
    media: {
      url: String,
      filename: String,
      type: {
        type: String,
        enum: ['image', 'video', 'document'],
        default: 'image',
      },
    },
    buttons: [{
      type: {
        type: String,
        enum: ['url', 'call', 'quick_reply'],
      },
      title: String,
      url: String,
      phoneNumber: String,
      // AiSensy button structure
      sub_type: String,
      index: String,
      parameters: [{
        type: String,
        text: String,
      }],
    }],
    carouselCards: [{
      type: mongoose.Schema.Types.Mixed, // Flexible structure for carousel cards
    }],
  },
  
  // Scheduling
  scheduleTime: {
    type: Date,
    default: null, // null means send immediately
    index: true,
  },
  scheduleDelayMinutes: {
    type: Number,
    default: 0, // 0 means send immediately like 30 minutes later of abandoned cart
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'queued', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true,
  },
  
  // Retry configuration
  totalRetryCount: {
    type: Number,
    default: 3,
  },
  
  // Per-channel status
  channelStatus: [{
    channel: {
      type: String,
      enum: ['sms', 'whatsapp', 'email'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'readyForQueue', 'queued', 'processing', 'sent', 'failed', 'skipped'],
      default: 'pending',
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    lastAttempt: {
      type: Date,
      required: false,
    },
    sentAt: {
      type: Date,
      required: false,
    },
    error: {
      message: String,
      code: String,
      details: mongoose.Schema.Types.Mixed,
    },
    response: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },
  }],

  // Generic contextual data (inventoryId, productId, optionId, thumbnail, etc.)
  info: [{
    key: { type: String, required: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed }
  }],

  // Idempotency / de-duplication
  dedupeKey: { type: String, sparse: true, unique: true, trim: true },

  // Queue metadata for observability
  queuedAt: { type: Date },
  sqsMessageId: { type: String, index: true },
  sqsQueue: { type: String },
  
  // Processing metadata
  processedAt: {
    type: Date,
    required: false,
  },
  completedAt: {
    type: Date,
    required: false,
  },
  
  // Additional metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  
}, { timestamps: true });

// Indexes for efficient querying
NotificationSchema.index({ status: 1, scheduleTime: 1 });
NotificationSchema.index({ phoneNumber: 1, notificationType: 1 });
NotificationSchema.index({ user: 1, notificationType: 1 });
NotificationSchema.index({ 'info.key': 1, 'info.value': 1 });

// Ensure every selected channel has a corresponding channelStatus row
NotificationSchema.pre('validate', function(next) {
  if (!Array.isArray(this.channels)) return next();
  const map = new Map((this.channelStatus || []).map(s => [s.channel, s]));
  this.channelStatus = this.channels.map(ch => map.get(ch) || ({ channel: ch, status: 'pending', retryCount: 0 }));
  next();
});

// Pre-save hook to set scheduleTime based on scheduleDelayMinutes
NotificationSchema.pre('save', function(next) {
  if (this.scheduleDelayMinutes > 0 && !this.scheduleTime) {
    this.scheduleTime = new Date(Date.now() + this.scheduleDelayMinutes * 60 * 1000);
  }
  next();
});

module.exports = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
