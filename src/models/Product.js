/**
 * Product Schema
 * Represents a product with all necessary details for an e-commerce site.
 */

const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    // Name of the product
    // Example: "Naruto 1 Window Pillar Wrap"
    name: {
      type: String,
      required: true,
      maxlength: 200,
      index: true,
    },
    // Multiple lines of caption to be shown below the name in the card
    captions: [
      {
        type: String,
        maxlength: 200,
      },
    ],
    // Example: "Best Full Bike Wrap for Hero Honda Splendor Plus"
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    // Detailed description of the product
    // Example: "High-quality wrap designed for Hero Honda Splendor Plus..."
    description: {
      type: String,
      maxlength: 2000,
    },
    // Tags for the product
    // Example: ["anime", "formal"]
    tags: [
      {
        type: String,
      },
    ],
    // Keywords for search, higher weight than tags
    // Example: ["krishna", "red strips", "naruto"]
    searchKeywords: [
      {
        type: String,
      },
    ],
    // SEO-friendly URL slug
    // Example: "full-bike-wrap-hero-honda-splendor-plus"
    pageSlug: {
      type: String,
      required: true,
      unique: true,
    },
    // AWS-specific slug
    // Example: "full-bike-wrap-hero-honda-splendor-plus-aws"
    awsSlug: {
      type: String,
      required: true,
      unique: true,
    },
    // Category with enum
    category: {
      type: String,
      enum: ['Wraps', 'Accessories'],
      required: true,
      index: true, // Index added for efficient querying by category
    },
    // SubCategory with enum
    subCategory: {
      type: String,
      enum: ['Bike Wraps', 'Car Wraps', 'Safety'],
      required: true,
      index: true, // Index added for efficient querying by subCategory
    },
    // Reference to SpecificCategory
    specificCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SpecificCategory',
      index: true, // Index added for efficient querying by specificCategory
    },
    // Reference to SpecificCategoryVariant
    specificCategoryVariant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SpecificCategoryVariant',
      index: true,
    },
    // Available colors with image galleries
    availableColors: [
      {
        // Name of the color
        // Example: "Red"
        colorName: {
          type: String,
        },
        // Image URLs for this color variant
        imageGallery: [
          {
            type: String,
          },
        ],
        // Hex code of dominant color
        // Example: "#FF0000"
        dominantColor: {
          type: String,
        },
      },
    ],

    // Image URLs for the product
    images: [
      {
        type: String,
      },
    ],
    // Delivery Cost
    // Example: 100
    deliveryCost: {
      type: Number,
      default: 100,
      min: 0,
    },
    // Price of the product
    // Example: 1999.99
    price: {
      type: Number,
      required: true,
      min: 0,
      index: true, // Index added for efficient price range queries
    },
    // Stock Keeping Unit, unique identifier
    // Example: "BSW12"
    sku: {
      type: String,
      unique: true,
      required: true,
    },
    // Freebies
    // Example: "tools to apply at home eg: cutter, slider etc"
    freebies: {
      available: {
        type: Boolean,
        default: false,
      },
      description: {
        type: String,
      },
      images: [
        {
          type: String,
        },
      ],
    },
    // References to Review documents
    reviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Review',
      },
    ],
    // Ratings data
    ratings: {
      // Average rating calculated from reviews
      // Example: 4.5
      averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      // Total number of ratings
      numberOfRatings: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    // Indicates if the product is available
    available: {
      type: Boolean,
      default: true,
    },
    // Indicates if the product should appear in search results
    showInSearch: {
      type: Boolean,
      default: true,
    },
    // Hex code of dominant color
    // Example skyblue
    dominantColor: {
      colorName: {
        type: String,
        index: true,
      },
      colorFamily: {
        type: String,
        index: true,
      },
      // Hex code of dominant color
      // Example: "#FF0000"
      dominantColor: {
        type: String,
      },
    },
    // Custom fields for additional information
  },
  { timestamps: true }
);

// Text index for full-text search with weighted fields
ProductSchema.index(
  {
    title: 'text',
    searchKeywords: 'text',
    tags: 'text',
    description: 'text',
  },
  {
    weights: {
      title: 5,
      searchKeywords: 4,
      tags: 3,
      description: 1,
    },
    name: 'TextIndex',
  }
);

module.exports = mongoose.models.Product ||mongoose.model('Product', ProductSchema);
