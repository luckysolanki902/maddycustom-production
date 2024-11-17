// /models/Coupon.js

const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema(
  {
    showAsCard: {
      type: Boolean,
      default: false,
    },
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
    minimumPurchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    usagePerUser: {
      type: Number,
      default: 100,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Coupon valid from this date
    validFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // Coupon valid until this date
    validUntil: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value > this.validFrom;
        },
        message: 'validUntil must be after validFrom',
      },
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
