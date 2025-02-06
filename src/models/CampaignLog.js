const mongoose = require('mongoose');

const CampaignLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    index: true,
  },
  campaignName: {
    type: String,
    required: true,
    index: true,
  },
  source: {
    type: String, // e.g., 'aisensy'
    default: 'aisensy',
  },
  medium: {
    type: String, // e.g., 'whatsapp', 'sms', 'email'
    default: 'whatsapp',
  },
  phoneNumber: {
    type: String,
  },
  email: {
    type: String,
  },
  // Counters for tracking messages sent via this campaign
  totalCount: {
    type: Number,
    default: 0,
  },
  successfulCount: {
    type: Number,
    default: 0,
  },
  failedCount: {
    type: Number,
    default: 0,
  },
  lastSentAt: {
    type: Date,
  },
}, { timestamps: true });

// Unique index to prevent duplicate logs for the same user, order, and campaign
CampaignLogSchema.index({ user: 1, order: 1, campaignName: 1 }, { unique: true });

module.exports = mongoose.models.CampaignLog || mongoose.model('CampaignLog', CampaignLogSchema);




