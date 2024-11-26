// /models/SpecificCategoryVariant.js
const mongoose = require('mongoose');


const SpecificCategoryVariantSchema = new mongoose.Schema(
  {
    variantCode: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
      index: true,
      unique: true,
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
    title: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true
    },
    subtitles: [
      {
        type: String,
        maxlength: 300,
        trim: true,
      }
    ],
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
        maxlength: 100,
        trim: true,
      },
    ],
    pageSlug: {
      type: String,
      required: true,
      unique: true,
      index: true,
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
      },
    ],
    available: {
      type: Boolean,
      default: true,
      index: true,
    },
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
      index: true,
    },
    imageFolderPath: {
      type: String,
      required: true,
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
      default: '',
      maxlength: 500,
    },
    freebies: {
      available: {
        type: Boolean,
        default: false,
      },
      description: {
        type: String,
      },
      image: {
        type: String,
      },
    },
    productDescription: {
      type: String,
      maxlength: 500,
    },
    packagingDetails: {
      boxId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PackagingBox',
        // required: true,
        index: true,
      },
      productWeight: {
        type: Number,
        // required: true,
      },
    }
  },
  { timestamps: true }
);



module.exports = mongoose.models.SpecificCategoryVariant || mongoose.model('SpecificCategoryVariant', SpecificCategoryVariantSchema);