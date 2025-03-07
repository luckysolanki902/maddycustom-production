// /models/OptionSchema.js
const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  //sku
  sku: {
    type: String,
    required: true,
    unique: true,   
  },
  // A flexible approach to store option details using a Map
  optionDetails: {
    // Example: { color: 'red', size: 'M' }
      // Example: { color: 'blue'}
    type: Map,
    of: String,
    required: false,
  },
  images:[
    {
      type: String,
    },
  ],
  inventoryData: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
  },
}, { timestamps: true });

module.exports = mongoose.models.Option || mongoose.model('Option', OptionSchema);
