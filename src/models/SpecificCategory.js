// /models/SpecificCategory.js
const mongoose = require('mongoose');

const ExtraFieldSchema = new mongoose.Schema({
  fieldName: {
    type: String,
    required: true,
    trim: true,
  },
  fieldType: {
    type: String,
    enum: ['String', 'Number'],
    required: true,
  },
  question: {
    type: String,
    required: true,
    trim: true,
  },
});

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
    extraFields: {
      type: [ExtraFieldSchema], // Array of ExtraFieldSchema
      default: [],
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.SpecificCategory ||
  mongoose.model('SpecificCategory', SpecificCategorySchema);
