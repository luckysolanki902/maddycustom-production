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
    captions: [
      {
        type: String,
        maxlength: 200,
      },
    ],
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
    description: {
      type: String,
      maxlength: 2000,
    },
    mainTags: [
      {
        type: String,
      },
    ],
    searchKeywords: [
      {
        type: String,
      },
    ],
    pageSlug: {
      type: String,
      required: true,
      unique: true,
    },
    category: {
      type: String,
      enum: ['Wraps', 'Accessories'],
      required: true,
      index: true,
    },
    subCategory: {
      type: String,
      enum: ['Bike Wraps', 'Car Wraps', 'Safety'],
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
    },
    stock: {
      type: Number,
      min: 0,
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
    designTemplate:{
      designCode: {
        type: String,
        required: true,
      },
      imageUrl: {
        type: String,
        required: true,
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
    showInSearch: {
      type: Boolean,
      default: true,
    },
    dominantColor: {
      colorName: {
        type: String,
        index: true,
      },
      colorFamily: {
        type: String,
        index: true,
      },
      dominantColor: {
        type: String,
      },
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
      searchKeywords: 4,
      mainTags: 3,
      description: 1,
    },
    name: 'TextIndex',
  }
);

module.exports = mongoose.models.Product || mongoose.model('Product', ProductSchema);
