const mongoose = require('mongoose');

const PackagingBoxSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true,
  },
  dimensions: {
    length: {
      type: Number,
      required: true,
    },
    breadth: {
      type: Number,
      required: true,
    },
    height: {
      type: Number,
      required: true,
    },
  },
  weight: {
    type: Number,
    required: true,
  },
  capacity: {
    type: Number,
    required: true, // Maximum number of items the box can hold
  },
});

module.exports = mongoose.models.PackagingBox || mongoose.model('PackagingBox', PackagingBoxSchema);
