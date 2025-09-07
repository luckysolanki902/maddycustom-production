const mongoose = require('mongoose');
const { Schema } = mongoose;

const InventorySchema = new Schema({
  availableQuantity: { type: Number, required: true, default: 0, min: 0 },
  reservedQuantity:  { type: Number, required: true, default: 0, min: 0 },
  reorderLevel:      { type: Number, required: true, default: 50, min: 0 },
  // track previous qty for trigger: (prev <= 0) -> (now > 0)
  lastAvailableQuantity: { type: Number, required: true, default: 0, min: 0 },
}, { timestamps: true, versionKey: false, strict: true });

// keep lastAvailableQuantity = previous availableQuantity on updates
InventorySchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() || {};
  const nextAvail =
    update.availableQuantity ??
    (update.$set && update.$set.availableQuantity);
  if (nextAvail !== undefined) {
    const doc = await this.model.findOne(this.getQuery()).select('availableQuantity').lean();
    if (doc) {
      this.setUpdate({
        ...update,
        $set: { ...(update.$set || {}), lastAvailableQuantity: doc.availableQuantity }
      });
    }
  }
  next();
});

// if using save() path
InventorySchema.pre('save', async function (next) {
  if (!this.isNew && this.isModified('availableQuantity')) {
    const prev = await this.constructor.findById(this._id).select('availableQuantity').lean();
    if (prev) this.lastAvailableQuantity = prev.availableQuantity;
  }
  next();
});

InventorySchema.index({ updatedAt: -1 });

module.exports = mongoose.models.Inventory || mongoose.model('Inventory', InventorySchema);