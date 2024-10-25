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
    // URL to the customer's photo
    // Example: "https://example.com/photos/johndoe.jpg"
    photo: {
      type: String,
      required: true,
    },
    // Customer's rating
    // Example: 5
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    // Optional review comment
    review: {
      type: String,
      maxlength: 1000,
    },
    // Pages where the testimonial should appear
    pagesToAppearOn: [
      {
        // Page type (e.g., "home", "product", "category")
        pageType: {
          type: String,
          required: true,
          enum: ['home', 'product', 'category'],
        },
        // Reference to specific page (e.g., category slug)
        pageReference: {
          type: String,
        },
        // Order in which the testimonial should appear
        displayOrder: {
          type: Number,
          required: true,
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

// Index added for efficient querying by pageType and pageReference
HappyCustomerSchema.index({
  'pagesToAppearOn.pageType': 1,
  'pagesToAppearOn.pageReference': 1,
});

module.exports = mongoose.models.HappyCustomer ||mongoose.model('HappyCustomer', HappyCustomerSchema);
