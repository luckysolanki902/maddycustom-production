/**
 * HappyCustomer Schema
 * Represents a happy customer testimonial with photo.
 */

const mongoose = require('mongoose');

const HappyCustomerSchema = new mongoose.Schema(
  {
    // Name of the customer
    // Example: "John Doe"
    name: {
      type: String,
      required: true,
      maxlength: 100,
    },
    // URL to the customer's review photo
    photo: {
      type: String,
      required: true,
    },
    homepageDisplayOrder: {
      type: Number,
      index: true
    },
    // Pages where the testimonial should appear
    pagesToAppearOn: [
      {
        // Variants pages with same display order
        specificCategory: [{
          type: mongoose.Schema.Types.ObjectId,
          ref: 'SpecificCategory',
        }],
        // Order in which the testimonial should appear
        displayOrder: {
          type: Number,
          required: true,
          index: true
        },
      },
    ],
    // Indicates if the testimonial is active
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Create indexes for the schema fields as specified
HappyCustomerSchema.index({ homepageDisplayOrder: 1 });
HappyCustomerSchema.index({ 'pagesToAppearOn.specificCategoryCode': 1 });
HappyCustomerSchema.index({ 'pagesToAppearOn.displayOrder': 1 });

module.exports = mongoose.models.HappyCustomer || mongoose.model('HappyCustomer', HappyCustomerSchema);
