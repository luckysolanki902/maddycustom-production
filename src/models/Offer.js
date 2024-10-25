/**
 * Offer Schema
 * Represents an offer in the system.
 */

const mongoose = require('mongoose');

const OfferSchema = new mongoose.Schema(
  {
    // Name of the offer
    // Example: "Buy Three Get One Free"
    name: {
      type: String,
      required: true,
      maxlength: 200,
    },
    captions: [
      {
        type: String,
        maxlength: 200,
      },
    ],
    // Description of the offer
    description: {
      type: String,
      maxlength: 1000,
    },
    // Array of conditions for the offer
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
    // Type of discount
    discountType: {
      type: String,
      required: true,
      enum: ['fixed', 'percentage', 'freeItem'],
    },
    // Discount value
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    // Offer valid from this date
    validFrom: {
      type: Date,
      required: true,
    },
    // Offer valid until this date
    validUntil: {
      type: Date,
      required: true,
    },
    // Indicates if the offer is currently active
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Index added for efficient querying by validFrom and validUntil
OfferSchema.index({ validFrom: 1, validUntil: 1 });

module.exports = mongoose.models.Offer || mongoose.model('Offer', OfferSchema);
