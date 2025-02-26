// /models/Product.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      maxlength: 200,
      index: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: false,
    },
    images: [
      {
        type: String,
      },
    ],
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    mainTags: [
      {
        type: String,
        lowercase: true,
        trim: true,
        index: true,
      },
    ],
    pageSlug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    subCategory: {
      type: String,
      required: true,
      index: true,
    },
    specificCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SpecificCategory',
      index: true,
    },
    specificCategoryVariant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SpecificCategoryVariant',
      index: true,
    },
    deliveryCost: {
      type: Number,
      default: 100,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },
    sku: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    designTemplate: {
      designCode: {
        type: String,
        required: false,
      },
      imageUrl: {
        type: String,
        required: false,
      }
    },
    reviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Review',
      },
    ],
    displayOrder: {
      type: Number,
      index: true,
    },
    ratings: {
      averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      numberOfRatings: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    available: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

ProductSchema.index(
  {
    title: 'text',
    searchKeywords: 'text',
    mainTags: 'text',
    description: 'text',
  },
  {
    weights: {
      title: 5,
      mainTags: 3,
      description: 1,
    },
    name: 'TextIndex',
  }
);



module.exports = mongoose.models.Product || mongoose.model('Product', ProductSchema);
