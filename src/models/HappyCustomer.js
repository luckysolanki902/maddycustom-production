const mongoose = require('mongoose');

const PlacementSchema = new mongoose.Schema({
  refType: {
    type: String,
    enum: ['SpecificCategory'],
    required: true,
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SpecificCategory',
    required: true,
  },
  displayOrder: {
    type: Number,
    required: true,
    default: 0,
  },
});

const HappyCustomerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      maxlength: 100,
    },
    photo: {
      type: String,
      required: true,
    },
    isGlobal: {
      type: Boolean,
      default: false,
      index: true,
    },
    placements: [PlacementSchema],
    globalDisplayOrder: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    showOnHomepage: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.HappyCustomer || mongoose.model('HappyCustomer', HappyCustomerSchema);
