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
    title:{
      type:String,
      required:true,
      maxlength:200,
      trim:true
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
        default: 0.08,
      },
      boxWeight:{
        type: Number,
        default:0.3
      },
      boxCapacity:{
        type: Number,
        default:4
      },
    },
  },
  { timestamps: true }
);




module.exports = mongoose.models.SpecificCategoryVariant ||  mongoose.model('SpecificCategoryVariant', SpecificCategoryVariantSchema);