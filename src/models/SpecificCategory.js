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
    commonPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    subtitles: [{
      type: String,
      maxlength: 300,
    }],
    description: {
      type: String,
      maxlength: 500,
    },
    keywords: [
      {
        type: String,
      },
    ],
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
    showInSearch: {
      type: Boolean,
      default: true,
    },
    thumbnails: [
      {
        type: String,
      },
    ],
    availableSpecificCategoryVariants: [
      {
        variantCode: {
          type: String,
          maxlength: 100,
          trim: true,
        },
        name: {
          type: String,
          maxlength: 100,
          trim: true,
        },
        helperText: {
          type: String,
          maxlength: 300,
        },
        image: {
          type: String,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.models.SpecificCategory || mongoose.model('SpecificCategory', SpecificCategorySchema);
