/**
 * Coupon Schema
 * Represents a coupon code in the system.
 */

const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema(
  {
    // Coupon code
    // Example: "FESTIVE500"
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      maxlength: 20,
    },
    captions: [
      {
        type: String,
        maxlength: 200,
      },
    ],
    // Description of the coupon
    description: {
      type: String,
      maxlength: 1000,
    },
    // Type of discount
    discountType: {
      type: String,
      required: true,
      enum: ['fixed', 'percentage'],
    },
    // Discount value
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    // Array of conditions for the coupon
    conditions: [
      {
        // Type of condition
        conditionType: {
          type: String,
          required: true,
          enum: [
            'minimumAmount',
            'minimumQuantity',
            'specificProduct',
            'category',
          ],
        },
        // Value of the condition
        value: mongoose.Schema.Types.Mixed,
      },
    ],
    // Number of times the coupon can be used per user
    usageLimit: {
      type: Number,
      default: 1,
      min: 1,
    },
    // If true, coupon can be used unlimited times
    isUnlimitedUse: {
      type: Boolean,
      default: false,
    },
    // Coupon valid from this date
    validFrom: {
      type: Date,
      required: true,
    },
    // Coupon valid until this date
    validUntil: {
      type: Date,
      required: true,
    },
    // Indicates if the coupon is currently active
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', CouponSchema);
