const mongoose = require('mongoose');

// Schema for conditions that must be met for the offer to be applied.
const ConditionSchema = new mongoose.Schema(
  {
    // Type of condition (e.g., 'cart_value', 'item_count', 'first_order').
    type: {
      type: String,
      required: true,
      enum: [
        'cart_value',    // Checks if the cart's total value meets a criteria.
        'item_count',    // Checks if the number of items meets a criteria.
        'first_order',   // Checks if the order is the customer's first order.
        'order_count_by_user',   // Checks if the order count meets a criteria.
        // Additional condition types can be added here.
      ],
    },
    // Comparison operator for the condition (e.g., '>=', '<=', '==', etc.).
    operator: {
      type: String,
      required: true,
      enum: ['>=', '<=', '==', '!=', 'in', 'not_in', '>', '<'],
    },
    // The value to compare against (can be a number, boolean, or array of IDs).
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

  },
  { _id: false } // Prevents creation of an automatic _id for each condition.
);

// Schema for actions that define the benefit of the offer.
const ActionSchema = new mongoose.Schema(
  {
    // Type of action (e.g., discount_percent, discount_fixed, free_item, bogo).
    type: {
      type: String,
      required: true,
      enum: [
        'discount_percent', // Provides a percentage discount (e.g., 5% off).
        'discount_fixed',   // Provides a fixed discount amount (e.g., ₹100 off).
        'free_item',        // Gives a free product (e.g., free keychain).
        'bogo',             // Buy-One-Get-One or similar combo offers.
        // Additional action types can be added here.
      ],
    },
    // For discount actions: represents the discount percentage or fixed amount.
    discountValue: {
      type: Number,
      default: 0,
    },
    // For BOGO/combo offers: the quantity a customer must buy.
    buyQuantity: {
      type: Number,
      default: 0,
    },
    // For BOGO/combo offers: the quantity a customer receives for free or at discount.
    getQuantity: {
      type: Number,
      default: 0,
    },
    // Scope defines where the action applies (e.g., specific product, category, or variant).
    scope: {
      type: String,
      enum: ['product', 'category', 'variant', null],
      default: null,
    },
    // Array of IDs corresponding to the scope (e.g., product IDs, category IDs).
    scopeValue: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    // For free_item actions: an array holding the ID(s) of the free product(s).
    freeItemId: [
      {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'freeItemType',
      }
    ],
    freeItemType: {
      type: String,
      enum: ['Product', 'SpecificCategory', 'SpecificCategoryVariant'],
    },
    // For free_item actions: specifies how many free items are given.
    freeQuantity: {
      type: Number,
      default: 1,
    },
  },
  { _id: false } // Prevents creation of an automatic _id for each action.
);

// Main schema that defines an Offer with its conditions and actions.
const OfferSchema = new mongoose.Schema(
  {
    // A short title or name for the offer (e.g., "Welcome Savings").
    name: {
      type: String,
      required: true,
      maxlength: 200,
    },
    // Detailed description of the offer (e.g., "5% off on first order").
    description: {
      type: String,
      maxlength: 1000,
    },
    // For example: Add more items worth {condition.value} to get {action.schema.discountValue} % or rs discount
    conditionMessage: {
      type: String,
      default: '',
    },
    // Indicates whether to display the offer as a card in the UI.
    showAsCard: {
      type: Boolean,
      default: false,
    },
    // URL for a thumbnail image used in the offer card (only needed when showAsCard is true)
    thumbnail: {
      type: String,
    },
    // Indicates if the offer is active. If false, the offer won't be applied.
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // The date from which the offer becomes valid.
    validFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // The date until which the offer is valid. Must be later than validFrom.
    validUntil: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value > this.validFrom;
        },
        message: 'validUntil must be after validFrom',
      },
    },
    // The priority of the offer. Higher values imply higher precedence if offers conflict.
    priority: {
      type: Number,
      default: 1,
      index: true,
    },
    // Maximum times a single user can use the offer (0 means no limit).
    usageLimitPerUser: {
      type: Number,
      default: 0,
    },
    // Maximum overall usage of the offer (0 means no limit).
    usageLimitOverall: {
      type: Number,
      default: 0,
    },
    // Counter tracking the total number of times the offer has been used.
    usedCount: {
      type: Number,
      default: 0,
    },
    // Array of coupon codes that trigger this offer (e.g., "WELCOME5", "FREE2U", "SAVE100").
    couponCodes: [
      {
        type: String,
        uppercase: true, // Stores the coupon code in uppercase.
        trim: true,      // Trims any leading or trailing whitespace.
        maxlength: 20,
      }
    ],
    // If true, the offer is applied automatically when conditions are met.
    autoApply: {
      type: Boolean,
      default: false,
    },
    // URL for an image to be used for auto-apply animations or effects.
    autoApplyAnimationImage: {
      type: String,
    },
    // Array of conditions (using ConditionSchema) that must be met for the offer.
    conditions: {
      type: [ConditionSchema],
      default: [],
    },
    // Array of actions (using ActionSchema) that define the benefits of the offer.
    actions: {
      type: [ActionSchema],
      default: [],
    },
    // Can be combined with other offers.
    allowStacking: {
      type: Boolean,
      default: false,
    },
    discountCap: {
      type: Number,
      default: 0,
    }
  },
  { timestamps: true } // Automatically manages createdAt and updatedAt fields.
);

// Create a text index on the name and description fields for search optimization.
OfferSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.models.Offer || mongoose.model('Offer', OfferSchema);
