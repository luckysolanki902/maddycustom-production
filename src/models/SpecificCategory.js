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
      // e.g. Bike Wraps, Car Wraps, Safety, Minimal Personalization
      required: true,
      index: true,
    },
    category: {
      type: String,
      // e.g. 'Wraps', 'Accessories'
    },
    classificationTags: [String],
    seperateCategoryShipping: {
      type: Boolean,
      default: false, // If true, this category has to be delivered in a separate shiprocket order (items of this category can be combined)
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
    // temproary-review-count
    tempReviewCount: {
      type: Number,
      default: 33,
    },
    commonProductCardImagesSource: {
      type: String,
      enum: ['variant', 'specCat'],
    },
    commonProductCardImages: {
      type: [String],
      default: [],
    },
    // a boolean for show product description images in product image gallery too
    showDescriptionImagesInGallery: {
      type: Boolean,
      default: true,
    },

    tempReviewDistribution: {
      type: Object,
      default: {
        1: 0,
        2: 0,
        3: 9,
        4: 11,
        5: 13
      }, // e.g., { "3": 0, "4": 0, "5": 0 }
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
