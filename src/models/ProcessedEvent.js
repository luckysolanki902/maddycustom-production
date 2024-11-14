// models/ProcessedEvent.js

import mongoose from 'mongoose';

/**
 * Schema to track processed webhook events for idempotency.
 * Supports multiple providers and various event types.
 */
const ProcessedEventSchema = new mongoose.Schema(
  {
    /**
     * The name of the webhook provider (e.g., 'razorpay', 'stripe', 'paypal').
     */
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    
    /**
     * The unique identifier for the event provided by the webhook provider.
     * For Razorpay, this would be the value of the 'x-razorpay-event-id' header.
     */
    eventId: {
      type: String,
      required: true,
      trim: true,
    },
    
    /**
     * The type of event received (e.g., 'payment.captured', 'payment.failed').
     */
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    
    /**
     * The identifier of the resource affected by the event.
     * For example, an order ID or payment ID.
     */
    resourceId: {
      type: String,
      required: false,
      trim: true,
    },
    
    /**
     * Timestamp indicating when the event was processed.
     */
    processedAt: {
      type: Date,
      default: Date.now,
      index: { expires: '30d' }, // Documents expire after 30 days
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

/**
 * Composite Unique Index
 * Ensures that each combination of provider and eventId is unique.
 * This prevents the same event from being processed multiple times.
 */
ProcessedEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

/**
 * Prevent model recompilation in development environments.
 * This avoids "OverwriteModelError" when using hot-reloading.
 */
export default mongoose.models.ProcessedEvent || mongoose.model('ProcessedEvent', ProcessedEventSchema);
