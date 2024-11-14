// /models/SpecificCategoryVariant.js
const mongoose = require('mongoose');

const SpecificCategoryVariantSchema = new mongoose.Schema(
  {
    variantCode: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },
    variantType: {
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
    cardCaptions: [{
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
    specificCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SpecificCategory',
      required: true,
      index: true,
    },
    features: [
      {
        imageUrl: {
          type: String,
        },
        name: {
          type: String,
        },
        detail: {
          type: String,
        },
      },
    ],
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
    showCase: [{
      available: {
        type: Boolean,
        default: false,
      },
      url: {
        type: String,
      }
    }],
    designTemplateFolderPath: {
      type: String,
      required: true,
    },
    stock: {
      type: Number,
      default: 1000,
    },
    availableBrands: [
      {
        brandName: {
          type: String,
        },
        brandLogo: {
          type: String,
        },
        brandBasePrice: {
          type: Number,
          default: 0
        }
      }
    ],
    sizes: {
      applicable: {
        type: Boolean,
        default: false,
      },
      availableSizes: {
        type: [String],
        enum: ['S', 'M', 'L', 'XL', 'XXL'],
        required: function () {
          return this.sizes.applicable;
        }
      }
    },
    variantInfo: {
      type: String,
      default: '', // Empty by default
      maxlength: 500, // Optional: adjust as needed
    },
    // New Field: dimensions
    dimensions: {
      length: {
        type: Number,
        default: 8,
      },
      breadth: {
        type: Number,
        default: 8,
      },
      height: {
        type: Number,
        default: 39,
      },
      weight: {
        type: Number,
        default: 0.3,
      },
    },
  },
  { timestamps: true }
);


module.exports = mongoose.models.SpecificCategoryVariant || mongoose.model('SpecificCategoryVariant', SpecificCategoryVariantSchema);
