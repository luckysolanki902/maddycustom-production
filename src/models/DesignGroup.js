// /models/DesignGroup.js
const mongoose = require('mongoose');

const DesignGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: function(tags) {
          return tags.length <= 10; // Limit to 10 tags
        },
        message: 'Maximum 10 tags allowed'
      }
    },
    searchKeywords: {
      type: [String],
      default: [],
      // Transform each keyword to lowercase and trim whitespace before saving
      set: function(keywords) {
        if (Array.isArray(keywords)) {
          return keywords
            .map(keyword => typeof keyword === 'string' ? keyword.toLowerCase().trim() : keyword)
            .filter(keyword => keyword && keyword.length > 0);
        }
        return keywords;
      },
      validate: {
        validator: function(keywords) {
          return keywords.length <= 20; // Limit to 20 keywords
        },
        message: 'Maximum 20 search keywords allowed'
      }
    },
    thumbnail: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { 
    timestamps: true,
  }
);

// Add index for better performance
DesignGroupSchema.index({ isActive: 1, createdAt: -1 });

if (mongoose.models.DesignGroup) {
  delete mongoose.models.DesignGroup;
}

module.exports = mongoose.models.DesignGroup || mongoose.model('DesignGroup', DesignGroupSchema);
