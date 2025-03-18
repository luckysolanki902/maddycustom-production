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
    listLayout:{
      type: String,
      default:'1',
      required: false,
    },
    thumbnail: {
      type: String,
      required: false
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
      required: false,
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
    // temproary-review-count
    tempReviewCount: {
      type: Number,
      default: 33,
    },
    // 

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
      weight: {
        type: Number
      }
    },
    productDescription: {
      type: String,
      maxlength: 500,
    },
    customTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomTemplate',
    },
    defaultCarouselImages: [String],
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
    },
    popupDetails: {
      type: [String],
      required: false,
    },
  },
  { timestamps: true }
);



module.exports = mongoose.models.SpecificCategoryVariant || mongoose.model('SpecificCategoryVariant', SpecificCategoryVariantSchema);