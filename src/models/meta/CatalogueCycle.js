// models/meta/CatalogueCycle.js
import mongoose from 'mongoose';

const CatalogueCycleSchema = new mongoose.Schema({
  startedAt: {
    type: Date,
    required: true,
  },
  // The cycle status can be "in_progress" or "completed".
  status: {
    type: String,
    enum: ['in_progress', 'completed'],
    default: 'in_progress',
  },
  // The pointer to the list of products that have been fully processed.
  lastProcessedIndex: {
    type: Number,
    default: 0,
  },
  // (Optional) Total count of feed entries created in this cycle.
  processedCount: {
    type: Number,
    default: 0,
  },
  // Track any processing errors that occurred during processing
  processingErrors: [{
    message: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
}, { timestamps: true });

export default mongoose.models.CatalogueCycle ||
  mongoose.model('CatalogueCycle', CatalogueCycleSchema);
