// models/Offer.js

const mongoose = require("mongoose");

// A minimal condition schema
const ConditionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ["cart_value", "item_count", "first_order", "order_count_by_user"],
  },
  operator: { type: String, required: true, enum: [">=", "<=", "==", "!=", ">", "<"] },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
}, { _id: false });


// Action schema now only has percent/fixed **or** a multi-component bundle
const ActionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ["discount_percent", "discount_fixed", "bundle"], // (bundle like: buy 3 tank wraps at 999 or buy 2 pillar wraps and 1 tank wrap at 1699)
  },

  // for percent/fixed
  discountValue: { type: Number, default: 0 },

  // for bundle
  bundlePrice: { type: Number, default: 0 },

  // *list* of components required by the bundle
  bundleComponents: [{
    // how to match this component (a category, product ID, or variant ID)
    scope: {
      type: String,
      required: true,
      enum: ["category", "product", "variant"],
    },
    // one or more IDs in that scope
    scopeValue: {
      type: [mongoose.Schema.Types.ObjectId],
      required: true,
    },
    // how many of this component are needed in *one* bundle
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  }],

}, { _id: false });


const OfferSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 200 },
  description: { type: String, maxlength: 1000 },

  isActive: { type: Boolean, default: true, index: true },
  validFrom: { type: Date, required: true, default: Date.now },
  validUntil: {
    type: Date, required: true,
    validate: {
      validator(value) { return value > this.validFrom },
      message: "validUntil must be after validFrom"
    }
  },

  autoApply: { type: Boolean, default: false },
  allowStacking: { type: Boolean, default: false },

  conditions: { type: [ConditionSchema], default: [] },
  actions: { type: [ActionSchema], default: [] },

  couponCodes: [{ type: String, uppercase: true, trim: true, maxlength: 20 }],
  discountCap: { type: Number, default: Infinity },
  showAsCard: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

OfferSchema.index({ name: "text", description: "text" });

module.exports = mongoose.models.Offer || mongoose.model("Offer", OfferSchema); 