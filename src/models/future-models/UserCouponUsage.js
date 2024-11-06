/**
 * CouponUsage Schema
 * Tracks the usage of coupons by users.
 */

const mongoose = require('mongoose');

const CouponUsageSchema = new mongoose.Schema(
  {
    // Reference to the user who used the coupon
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Reference to the coupon used
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true,
    },
    // Number of times the user has used this coupon
    timesUsed: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { timestamps: true }
);

// Ensure a user can have only one CouponUsage document per coupon
CouponUsageSchema.index({ user: 1, coupon: 1 }, { unique: true });

module.exports =
  mongoose.models.CouponUsage ||
  mongoose.model('CouponUsage', CouponUsageSchema);
