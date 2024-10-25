/**
 * SpecificCategory Schema
 * Represents a specific category under a subcategory.
 * Examples: Tank Wraps - Slim, Medium, Wide
 */

const mongoose = require('mongoose');

const SpecificCategorySchema = new mongoose.Schema(
  {
    // A unique code for every specific category
    // Example: 'tw'
    specificCategoryCode: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },
    // Name of the specific category
    // Example: "Tank Wraps"
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
    // Description of the specific category
    // Example: "Slim tank wraps for bikes."
    description: {
      type: String,
      maxlength: 500,
    },
    // Keywords for the specific category
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
    // Parent SubCategory as a string (enum)
    parentSubCategory: {
      type: String,
      enum: ['Bike Wraps', 'Car Wraps', 'Safety'],
      required: true,
      index: true, // Index added for efficient querying by parentSubCategory
    },
    // Indicates if the specific category is available
    available: {
      type: Boolean,
      default: true,
    },
    // Indicates if the specific category should appear in search results
    showInSearch: {
      type: Boolean,
      default: true,
    },
    // Image URL for the specific category
    thumbnails: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.models.SpecificCategory ||mongoose.model('SpecificCategory', SpecificCategorySchema);
