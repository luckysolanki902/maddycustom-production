// ModeOfPayment.js

const mongoose = require('mongoose');

/**
 * ModeOfPayment Schema
 * Represents different modes of payment.
 * Currently: online, fifty
 */
const ModeOfPaymentSchema = new mongoose.Schema(
  {
    // Name of the mode of payment
    // For now, just: 'online', 'fifty' (lowercase)
    name: {
      type: String,
      required: true,
      unique: true,
      maxlength: 50,
      trim: true,
      lowercase: true, // To ensure consistency
    },
    // Caption
    // Example: "50% online 50% COD" in case of fifty, else empty
    caption: {
      type: String,
      maxlength: 300,
      trim: true,
    },
    // Description of the mode of payment
    // Example: "Cards, UPI, Wallets", etc (in both online fifty), but in fifty add one mroe thing, that in parts
    description: {
      type: String,
      maxlength: 300,
      trim: true,
    },
    // Extra Charges (anti-discount)
    // Example: 100 (in case of fifty)
    extraCharge: {
      type: Number,
      min: 0,
    },

    // Configuration details for custom payment modes
    // For example, percentages for online and COD
    configuration: {
      // Percentage of amount to be paid online
      onlinePercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      // Percentage of amount to be paid via COD
      codPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 100,
      },
    },
    notAvailableWith: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SpecificCategory',
      }
    ],
    // Indicates if this payment mode is currently active
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.ModeOfPayment || mongoose.model('ModeOfPayment', ModeOfPaymentSchema);
