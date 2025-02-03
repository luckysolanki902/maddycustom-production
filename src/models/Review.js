// /models/Review.js

const mongoose = require('mongoose');

/**
 * This schema supports two main “types” of reviews:
 *  1. Admin reviews that can be attached to a whole specificCategory OR a variant OR a single product.
 *  2. User reviews that are attached to the exact product they purchased.
 *
 * The “scope” fields in the schema are:
 *    product               -> If review is for a single Product
 *    specificCategoryVariant -> If review is for all products under a specific variant
 *    specificCategory      -> If review is for all products under a specific category
 *
 * For user-created reviews, we typically store product + user + order references.
 * For admin-created reviews, we can store a single scope reference (e.g., specificCategoryVariant) 
 * or even product if you wish. 
 * 
 * On the front-end, to show all relevant reviews for a product, you can query:
 *
 *   Review.find({
 *     status: 'approved',
 *     $or: [
 *       { product: currentProductId },                 // exact product-level reviews
 *       { specificCategoryVariant: productVariantId }, // variant-level reviews
 *       { specificCategory: productCategoryId },       // category-level reviews
 *     ],
 *   });
 *
 * And that will bring back both admin “common” reviews and user “unique” reviews, all displayed on the product page.
 */

const ReviewSchema = new mongoose.Schema(
  {
    // Basic fields
    comment: {
      type: String,
      required: true,
      maxlength: 2000, // feel free to adjust
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
    name:{
      type:String,
      required:true,
      maxlength: 200, // feel free to adjust
      trim: true,
    },

    /**
     * Who created the review?
     * - For user-submitted reviews, store the user’s ObjectId
     * - For admin-created “common” reviews, this might be empty or 
     *   store an admin user’s ObjectId if you have separate Admin docs.
     */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // Not strictly required, because admin may create the review without a user.
    },

    /**
     * If you want to differentiate easily whether a review was user-generated or admin-generated:
     */
    isAdminReview: {
      type: Boolean,
      default: false,
    },

    // References to “scope”
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

    /**
     * For user-submitted reviews, you can store a reference to the Order 
     * to validate that the user actually bought the item.
     */
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },

    /**
     * Whether the review is live or not.
     * Admin will moderate and change from 'pending' -> 'approved' or 'rejected'.
     */
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

/**
 * EXAMPLE VALIDATIONS (optional):
 * 
 *  - Force “product” to be required if it is a user (isAdminReview = false).
 *  - Alternatively, if it’s admin review (isAdminReview = true), at least one of
 *    [product, specificCategoryVariant, specificCategory] must be specified.
 *
 * You can do this inside a custom pre-validation hook:
 */
ReviewSchema.pre('validate', function (next) {
  if (!this.isAdminReview) {
    // User review => Must have a product reference
    if (!this.product) {
      return next(new Error('User-generated reviews must include a product reference.'));
    }
  } else {
    // Admin review => Must have at least one reference
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

module.exports = mongoose.models.Review || mongoose.model('Review', ReviewSchema);