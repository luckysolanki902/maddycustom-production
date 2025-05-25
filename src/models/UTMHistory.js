const mongoose = require('mongoose');

const UTMHistorySchema = new mongoose.Schema(
  {
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
    history: [
      {
        source: {
          type: String,
          default: 'direct',
        },
        medium: String,
        campaign: String,
        term: String,
        content: String,
        fbc: String,
        pathname: String,
        queryParams: {
          type: mongoose.Schema.Types.Mixed,
          default: null,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

// Create compound index for efficient querying
UTMHistorySchema.index({ user: 1, order: 1 });

if (mongoose.models.UTMHistory) {
  delete mongoose.models.UTMHistory;
}

module.exports = mongoose.models.UTMHistory || mongoose.model('UTMHistory', UTMHistorySchema);
