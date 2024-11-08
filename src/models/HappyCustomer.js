// /models/HappyCustomer.js
const mongoose = require('mongoose');

const PlacementSchema = new mongoose.Schema({
  refType: {
    type: String,
    enum: ['SpecificCategory', 'SpecificCategoryVariant', 'Product'],
    required: true,
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'placements.refType',
    required: true,
  },
  displayOrder: {
    type: Number,
    required: true,
    default: 0,
  },
}, { _id: false });

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
    // Indicates if the testimonial is global (appears on all relevant pages)
    isGlobal: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Array of placements where the testimonial should appear (if not global)
    placements: [
      PlacementSchema
    ],
    // Indicates if the testimonial is active
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Indexes for efficient querying
HappyCustomerSchema.index({ isGlobal: 1 });
HappyCustomerSchema.index({ 'placements.refType': 1, 'placements.refId': 1 });
HappyCustomerSchema.index({ 'placements.displayOrder': 1 });
HappyCustomerSchema.index({ isActive: 1 });

module.exports = mongoose.models.HappyCustomer || mongoose.model('HappyCustomer', HappyCustomerSchema);
