// /models/SpecificCategory.js
const mongoose = require('mongoose');

const SpecificCategorySchema = new mongoose.Schema(
  {
    specificCategoryCode: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    pageSlug: {
      type: String,
      required: true,
      unique: true,
    },
    subCategory: {
      type: String,
      enum: ['Bike Wraps', 'Car Wraps', 'Safety'],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['Wraps', 'Accessories'],
    },
    available: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.SpecificCategory || mongoose.model('SpecificCategory', SpecificCategorySchema);
