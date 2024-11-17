// /models/HappyCustomer.js
const mongoose = require('mongoose');

const PlacementSchema = new mongoose.Schema({
  refType: {
    type: String,
    enum: ['SpecificCategoryVariant'],
    required: true,
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'specificCategoryVariant',
    required: true,
  },
  displayOrder: {
    type: Number,
    required: true,
    default: 0,
  },
});

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
    showOnHomepage: {
      type: Boolean,
      default: false
    },
    globalDisplayOrder:{
      type: Number,
      required: true,
      default: 0,
      index: true
    },
    // Indicates if the testimonial is active
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.HappyCustomer || mongoose.model('HappyCustomer', HappyCustomerSchema);
