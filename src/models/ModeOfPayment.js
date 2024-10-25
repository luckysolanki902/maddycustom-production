// ModeOfPayment.js

const mongoose = require('mongoose');

/**
 * ModeOfPayment Schema
 * Represents different modes of payment.
 * Examples: COD, Online, CustomFifty, CustomThirty
 */
const ModeOfPaymentSchema = new mongoose.Schema(
  {
    // Name of the mode of payment
    // Example: 'cod', 'online', 'customFifty', 'customThirty'
    name: {
      type: String,
      required: true,
      unique: true,
      maxlength: 50,
      trim: true,
      lowercase: true, // To ensure consistency
    },
    // Caption
    // Example: "50% online 50% COD"
    caption: {
      type: String,
      maxlength: 300,
      trim: true,
    },
    // Description of the mode of payment
    // Example: "Cash on Delivery", "Online Payment", etc.
    description: {
      type: String,
      maxlength: 300,
      trim: true,
    },
    // Extra Charges (anti-discount)
    // Example: 100
    extraCharge: {
      type: Number,
      min: 0,
    },
    // Discount on certain mops (type:fixed or percentage, and value)
    discount: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed',
    },
    // Value of the discount
    discountValue: {
      type: Number,
      min: 0,
    },
    // Configuration details for custom payment modes
    // For example, percentages for online and COD
    configuration: {
      onlinePercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      codPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 100,
      },
    },
    // Indicates if this payment mode is currently active
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.ModeOfPayment ||mongoose.model('ModeOfPayment', ModeOfPaymentSchema);
