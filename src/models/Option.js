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
  uniqueNumericId: {
    type: Number,
    unique: true,
    sparse: true,
    index: true,
  },
  // A flexible approach to store option details using a Map
  optionDetails: {
    // Example: { color: 'red', size: 'M' }
    // Example: { color: 'blue'}
    type: Map,
    of: String,
    required: false,
  },
  images: [
    {
      type: String,
    },
  ],
  inventoryData: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
  },

  // New thumbnail field: stores either a hex code or an image URL and is not required
  thumbnail: {
    type: String,
    required: false,
  },

}, { timestamps: true });

// Pre-save hook to generate uniqueNumericId if not present
OptionSchema.pre('save', async function (next) {
  if (!this.uniqueNumericId) {
    const timestamp = Date.now().toString().slice(-10);
    const random = Math.floor(Math.random() * 1000);
    this.uniqueNumericId = Number(`${timestamp}${random.toString().padStart(3, '0')}`);
  }
  next();
});

module.exports = mongoose.models.Option || mongoose.model('Option', OptionSchema);
