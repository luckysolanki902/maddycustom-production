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
  // How many times a message has been sent for this campaign
  count: {
    type: Number,
    default: 0,
  },
  lastSentAt: {
    type: Date,
  },
}, { timestamps: true });

// Create a unique index to prevent duplicate logs for the same user, order, and campaign
CampaignLogSchema.index({ user: 1, order: 1, campaignName: 1 }, { unique: true });

module.exports = mongoose.models.CampaignLog || mongoose.model('CampaignLog', CampaignLogSchema);



// {
//   "crons": [
//     {
//       "path": "/api/cron/aisensy/abandoned-cart-first-campaign",
//       "schedule": "*/10 * * * *"
//     },
//     {
//       "path": "/api/aisensy//abandoned-cart-second-campaign",
//       "schedule": "*/10 * * * *"
//     }
//   ]
// }
