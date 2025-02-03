// /models/Review.js

const mongoose = require('mongoose');


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
    createdAt:{
      type: Date,
      required:true,
      default:Date.now()
    },
    updatedAt:{
      type: Date,
      required:true,
      default:Date.now()
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
  }
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
ReviewSchema.pre(["findOneAndUpdate", "updateOne","save"],function(next){
  this.updatedAt=new Date();
  next();
})

module.exports = mongoose.models.Review || mongoose.model('Review', ReviewSchema);