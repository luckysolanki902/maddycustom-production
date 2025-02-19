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

// For letter-mapping variant selection
const LetterMappingOptionSchema = new mongoose.Schema({
  letterCode: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 300,
  },

  thumbnail: {
    type: String,
    trim: true,
    maxlength: 300,
  },
});

const LetterMappingGroupSchema = new mongoose.Schema({
  groupName: {
    type: String,
    required: true,
    trim: true,
  },
  question: {
    type: String,
    trim: true,
    default: '',
  },

  thumbnailRequired: {
    type: Boolean,
    default: false,
  },
  // If you want to allow single vs multi-select, add something like:
  // multiple: { type: Boolean, default: false },
  mappings: {
    type: [LetterMappingOptionSchema],
    default: [],
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
      type: [ExtraFieldSchema],
      default: [],
    },
    // review fetch source
    reviewFetchSource: {
      type: String,
      enum: ['variant', 'product', 'specCat'],
      default: 'variant',
      lowercase: true
    },
    productInfoTabs: [
      {
        title: {
          type: String,
          enum: ['Description', 'How to Apply']
        },
        fetchSource: {
          type: String,
          enum: ['Variant', 'SpecCat', 'Product']
        }
      }
    ],

    // NEW FIELDS FOR LETTER MAPPING LOGIC
    useLetterMapping: {
      type: Boolean,
      default: false,
    },
    letterMappingGroups: {
      type: [LetterMappingGroupSchema],
      default: [],
    },
  },
  { timestamps: true }
);

if (mongoose.models.SpecificCategory) {
  delete mongoose.models.SpecificCategory;
}
  module.exports =
    mongoose.models.SpecificCategory ||
    mongoose.model('SpecificCategory', SpecificCategorySchema);
