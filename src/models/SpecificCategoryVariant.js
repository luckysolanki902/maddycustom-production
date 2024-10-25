/**
 * SpecificCategoryVariant Schema
 * Represents a variant under a specific category.
 * Examples: Tank Wraps - Slim, Medium, Wide
 */

const mongoose = require('mongoose');

const SpecificCategoryVariantSchema = new mongoose.Schema(
  {
    // A unique code for every specific category variant
    // Example: 'tw-sp'
    specificCategoryCodeVariant: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },
    // Name of the specific category variant
    // Example: "Hero Honda Splendor Plus" (in case of modelVariant)
    // Example: "Slim" (in case of sizeVariant)
    variantType: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },
    // Name of the variant
    // Example: "Hero Honda Splendor Plus" (in case of modelVariant)
    // Example: "Slim" (in case of sizeVariant)
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
    // Subtitle at the top of the page below the main title
    // Example: 'Choose Your Style'
    subtitles: [{
      type: String,
      maxlength: 300,
    }],
    // Description of the specific category variant
    // Example: "Slim tank wraps for bikes."
    description: {
      type: String,
      maxlength: 500,
    },
    // Keywords for the specific category variant
    // Example: ["bike", "wrap", "Hero Honda", "Splendor Plus"]
    keywords: [
      {
        type: String,
      },
    ],
    // SEO-friendly URL slug
    // Example: "tank-wraps-slim"
    pageSlug: {
      type: String,
      required: true,
      unique: true,
    },
    // AWS-specific slug
    // Example: "tank-wraps-slim-aws"
    awsSlug: {
      type: String,
      required: true,
      unique: true,
    },
    // Reference to parent SpecificCategory
    parentSpecificCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SpecificCategory',
      required: true,
      index: true, // Index added for efficient querying by parentSpecificCategory
    },
    features: [
      {
        // Image URL for the feature
        imageUrl: {
          type: String,
        },
        // Name of the feature
        // Example: "Printed on High-Quality Vinyl"
        name: {
          type: String,
        },
        // Caption for the feature
        // Example: "Durable and long-lasting vinyl wrap"
        detail: {
          type: String,
        },
      },
    ],
    // Indicates if the specific category variant is available
    available: {
      type: Boolean,
      default: true,
    },
    // Indicates if the specific category variant should appear in search results
    showInSearch: {
      type: Boolean,
      default: true,
    },
    // Image URL for the specific category variant
    thumbnails: [
      {
        type: String,
      },
    ],
    showCase: [{
      mainVideo: {
        available: {
          type: Boolean,
          default: false,
        },
        url: {
          type: String,
        }
      }
    }],
    availableBrands: [
      {
        type: String,
        index: true
      }
    ],
    // Allowed tags for the products in this specific category variant
    // Example: ["bike", "wrap", "Hero Honda", "Splendor Plus"]
    allowedTags: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.models.SpecificCategoryVariant ||mongoose.model('SpecificCategoryVariant', SpecificCategoryVariantSchema);
