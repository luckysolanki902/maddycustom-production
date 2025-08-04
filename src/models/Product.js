// /models/Product.js

const mongoose = require('mongoose');

function toTitleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      maxlength: 200,
      index: true,
      set: toTitleCase,
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
    MRP: {
      type: Number,
      required: true,
      min: 1,
      index: true,
      default: 1000,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },
    //options available for the product
    optionsAvailable: {
      type: Boolean,
      default: false,
    },
    sku: {
      type: String,
      unique: true,
      required: false,
      index: true,
    },
    designTemplate: {
      designCode: {
        type: String,
        required: true,
      },
      imageUrl: {
        type: String,
        required: true,
      }
    },

    displayOrder: {
      type: Number,
      index: true,
    },

    available: {
      type: Boolean,
      default: true,
    },
    productSource: {
      type: String,
      required: true,
      enum: ['inhouse', 'marketplace'],
      index: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: false,
      index: true,
    },
    inventoryData: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
    },
    lastSyncedToGoogle: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// Pre-save hook to ensure pageSlug starts with a "/"
ProductSchema.pre('save', function(next) {
  if (this.pageSlug && !this.pageSlug.startsWith('/')) {
    this.pageSlug = '/' + this.pageSlug;
  }
  next();
});


module.exports = mongoose.models.Product || mongoose.model('Product', ProductSchema);
