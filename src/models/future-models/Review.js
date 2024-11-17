/**
 * Review Schema
 * Represents a customer review for a product.
 */

const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema(
  {
    // Reference to Product
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true, // Index added for efficient querying by product
    },
    // Reference to User
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Rating given by the user
    // Example: 4.5
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    // Review comment
    comment: {
      type: String,
      maxlength: 1000,
    },
    // Image URLs uploaded by the user
    images: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

// Unique index to prevent multiple reviews by the same user on the same product
ReviewSchema.index({ product: 1, user: 1 }, { unique: true });

module.exports = mongoose.models.Review || mongoose.model('Review', ReviewSchema);
