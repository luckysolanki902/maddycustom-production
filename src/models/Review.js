// models/Review.js

const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  // Core fields
  comment: {
    type: String,
    required: true,
    maxlength: 2000, // adjust as needed
    trim: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  images: [
    {
      type: String,
    },
  ],
  name: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true,
  },

  // For user-submitted reviews
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // not strictly required if you allow admin/manual creation without a user
  },

  // If review is from an admin or from normal user
  isAdminReview: {
    type: Boolean,
    default: false,
  },

  // References for "scope" of the review
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    index: true,
  },
  specificCategoryVariant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SpecificCategoryVariant',
    index: true,
  },
  specificCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SpecificCategory',
    index: true,
  },

  // Reference to the Order in which user purchased
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },

  // Timestamps
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },

  // Moderation status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
});

/**
 * Validation example:
 *  - If it's NOT an admin review (isAdminReview=false), a product reference is required.
 */
ReviewSchema.pre('validate', function (next) {
  if (!this.isAdminReview) {
    if (!this.product) {
      return next(
        new Error('User-generated reviews must include a product reference.')
      );
    }
  } else {
    // For admin review, at least one reference is required
    if (!this.product && !this.specificCategoryVariant && !this.specificCategory) {
      return next(
        new Error(
          'Admin-generated review must have at least one reference: product, specificCategoryVariant, or specificCategory.'
        )
      );
    }
  }
  next();
});

// Update the 'updatedAt' field whenever we save or update
ReviewSchema.pre(['findOneAndUpdate', 'updateOne', 'save'], function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports =
  mongoose.models.Review || mongoose.model('Review', ReviewSchema);
