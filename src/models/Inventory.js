const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  availableQuantity: {
    type: Number,
    required: true,
    default: 0,
  },
  reservedQuantity: {
    type: Number,
    required: true,
    default: 0,
  },
  reorderLevel: {
    type: Number,
    required: true,
    default: 50,
  },
}, { timestamps: true });

module.exports = mongoose.models.Inventory || mongoose.model('Inventory', InventorySchema);
