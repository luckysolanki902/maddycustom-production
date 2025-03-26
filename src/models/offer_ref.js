/**
 * Offer.js
 * ==============================================================================
 * This file defines a robust and highly flexible "Offer" (Promotion) schema for
 * an e-commerce platform. It is designed to handle a wide range of promotional
 * scenarios, including:
 *
 *  1. Automatic MRP discounts (e.g., show discounted price on product detail pages).
 *  2. Cart-level promotions (percentage or fixed discount if certain conditions are met).
 *  3. Coupon-based promotions (apply code at checkout).
 *  4. BOGO (Buy One, Get One) or "Buy X, Get Y" deals.
 *  5. "First order" discounts, or loyalty-based discounts.
 *  6. Combo deals (e.g., buy 2 from certain categories, get discount or freebies).
 *  7. Free item(s) upon certain conditions (e.g., "buy this, get a free gift").
 *  8. Excluding certain products, categories, or variants from promotions.
 *  9. Stacking rules (whether multiple offers can apply) and usage limits.
 *
 * By storing "conditions" (the logic for when an offer is valid) and "actions" 
 * (the logic for what discount / freebies to apply), this schema is extremely flexible.
 *
 * You can further tweak or expand the enumerations (like conditionType, actionType)
 * to accommodate your own custom logic, as well as build your own interpretation
 * layer in your checkout or cart service.
 *
 * Below, you will also see a README-like explanation that covers in detail how 
 * to handle the logic of applying these offers in your application.
 */

const mongoose = require('mongoose');

/* --------------------------------------------------------------------------
 * ConditionSchema
 * --------------------------------------------------------------------------
 * A flexible schema to define the rules/criteria under which an offer applies.
 * 
 * EXAMPLES:
 *   - { conditionType: 'cart_value', operator: '>=', value: 500 }
 *       => Offer requires the total cart value to be at least ₹500
 *   - { conditionType: 'item_count', operator: '>=', value: 3 }
 *       => Offer requires at least 3 items in the cart
 *   - { conditionType: 'product_in', operator: 'in', value: ['PRODUCT_ID_123'] }
 *       => Offer requires the user to have at least one of these product IDs in cart
 *   - { conditionType: 'first_order', operator: '==', value: true }
 *       => Offer requires that this is the user's first order
 *   - { conditionType: 'loyalty_level', operator: '>=', value: 3 }
 *       => Offer requires user loyalty level >= 3
 *
 * The operator works in combination with value depending on the condition type.
 * 
 * Common ConditionType values (expand as needed):
 *  - "cart_value" (total cart price)
 *  - "item_count" (total number of items in cart)
 *  - "product_in" (a list of product IDs that must appear in cart)
 *  - "product_not_in" (products that must NOT appear in the cart)
 *  - "category_in" (cart must have items from these categories)
 *  - "category_not_in" (cart must NOT have items from certain categories)
 *  - "variant_in", "variant_not_in"
 *  - "first_order" (this is the user's first order)
 *  - "loyalty_level" (some measure of user loyalty)
 *
 * Common Operators:
 *  - '>=', '<=', '==', '!=', '>', '<' => for numeric or boolean checks
 *  - 'in' => the cart must contain any (or all) items in the "value" array
 *  - 'not_in' => the cart must not contain items in the "value" array
 */

const ConditionSchema = new mongoose.Schema(
  {
    conditionType: {
      type: String,
      required: true,
      enum: [
        'cart_value',
        'item_count',
        'product_in',
        'product_not_in',
        'category_in',
        'category_not_in',
        'variant_in',
        'variant_not_in',
        'first_order',
        'loyalty_level',
        // Add additional condition types as needed
      ],
    },
    operator: {
      type: String,
      required: true,
      enum: ['>=', '<=', '==', '!=', 'in', 'not_in', '>', '<'],
    },
    // The "value" can be a number, a boolean, or an array of IDs, etc.
    // For 'in'/'not_in', it is typically an array (e.g. a list of product IDs or category IDs).
    // For '>=', '==', etc. it is typically a numeric or boolean value.
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // Optional message about this condition or failure reason
    message: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

/* --------------------------------------------------------------------------
 * ActionSchema
 * --------------------------------------------------------------------------
 * Defines WHAT happens if all the offer's conditions are satisfied.
 *
 * EXAMPLES:
 *   - A simple 10% off => { actionType: 'discount_percent', discountValue: 10 }
 *   - A ₹300 off => { actionType: 'discount_fixed', discountValue: 300 }
 *   - A BOGO => { actionType: 'bogo', buyQuantity: 1, getQuantity: 1, scope: 'product', scopeValue: [PRODUCT_ID] }
 *   - A "get a free item" => { actionType: 'free_item', freeProductId: FREEBIE_PRODUCT_ID, freeQuantity: 1 }
 *   - A special price => { actionType: 'set_special_price', newPrice: 299 }
 *   - A combo => { actionType: 'combo_deal', comboDetails: {...some structure...} }
 */

const ActionSchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      required: true,
      enum: [
        'discount_percent',
        'discount_fixed',
        'bogo',
        'free_item',
        'set_special_price',
        'combo_deal',
        // Add more as needed
      ],
    },

    // For "discount_percent" or "discount_fixed":
    // discountValue is used to store the actual discount amount or percentage.
    // e.g. discountValue = 10 => means 10%, if actionType='discount_percent'.
    //      discountValue = 300 => means ₹300 off, if actionType='discount_fixed'.
    discountValue: {
      type: Number,
      default: 0,
    },

    // For "set_special_price", you override the item price with newPrice.
    newPrice: {
      type: Number,
      default: 0,
    },

    // BOGO or combos:
    // Typically something like buyQuantity=1, getQuantity=1 for Buy 1 Get 1 free.
    // scope => "product", "category", or "variant"
    // scopeValue => an array of IDs for the scope
    buyQuantity: {
      type: Number,
      default: 0,
    },
    getQuantity: {
      type: Number,
      default: 0,
    },
    scope: {
      type: String,
      enum: ['product', 'category', 'variant', null],
      default: null,
    },
    scopeValue: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },

    // For "free_item" action, store the product ID of the free item and how many.
    freeProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    freeQuantity: {
      type: Number,
      default: 1,
    },

    // For advanced combos:
    // You can store additional data in comboDetails to define the logic
    // (like "buy any 2 from category X, get 1 from category Y free").
    comboDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

/* --------------------------------------------------------------------------
 * OfferSchema
 * --------------------------------------------------------------------------
 * The main Offer schema that ties everything together.
 * This includes:
 *   - Basic promotional info (name, description, etc.)
 *   - Lifecycle (active status, valid dates)
 *   - Priority, usage limits, stacking rules
 *   - Conditions (array of ConditionSchema)
 *   - Actions (array of ActionSchema)
 *   - Optional "applicable/excluded" references for quick whitelisting/blacklisting
 *   - Flags for first-order, loyalty-based, etc.
 */

const OfferRefSchema = new mongoose.Schema(
  {
    // A short name or title for the offer.
    name: {
      type: String,
      required: true,
      maxlength: 200,
    },
    // A more detailed description / marketing text for the offer.
    description: {
      type: String,
      maxlength: 1000,
    },

    // If you want to display an "offer card" somewhere, set this to true.
    showAsCard: {
      type: Boolean,
      default: false,
    },
    // Additional short marketing texts or highlights.
    captions: [
      {
        type: String,
        maxlength: 200,
      },
    ],

    // Toggle whether this offer is active/inactive.
    // If isActive = false, it won't be applied regardless of other fields.
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Valid from and until. If current date is not within this range, the offer does not apply.
    validFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
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

    // Priority (higher means it is considered earlier or has precedence if there's a conflict).
    // allowStacking indicates if this offer can combine with other offers that are also valid.
    priority: {
      type: Number,
      default: 1,
      index: true,
    },
    allowStacking: {
      type: Boolean,
      default: false,
    },

    // Usage limits (per user or overall).
    usageLimitPerUser: {
      type: Number,
      default: 0, // 0 => no limit
    },
    usageLimitOverall: {
      type: Number,
      default: 0, // 0 => no limit
    },
    usedCount: {
      type: Number,
      default: 0,
    },

    // If the offer is triggered by coupon code(s), store them here.
    // If the array is empty, it likely means the offer is "auto apply" or triggered otherwise.
    couponCodes: [
      {
        type: String,
        uppercase: true,
        trim: true,
        maxlength: 20,
      },
    ],

    // If autoApply is true, the system will attempt to apply this offer automatically
    // if conditions are met, even if the user did not enter a coupon code.
    autoApply: {
      type: Boolean,
      default: false,
    },

    // conditions => an array of ConditionSchema objects, describing "when" the offer applies.
    conditions: {
      type: [ConditionSchema],
      default: [],
    },

    // actions => an array of ActionSchema objects, describing "what" discount or freebies are given.
    actions: {
      type: [ActionSchema],
      default: [],
    },

    /**
     * The fields below give a quick way to define which products/categories/variants
     * are included or excluded from the offer, without needing a Condition.
     *
     * For example, if "applicableProducts" has a list of product IDs, you might only
     * apply the discount to those items (and ignore the rest).
     *
     * Alternatively, you can rely purely on conditions. But these lists can provide
     * a simpler approach for broad, direct scoping (and can help with performance if
     * you quickly filter out offers that don't apply to certain cart items).
     */
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    excludedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    applicableCategories: [
      {
        type: String,
        // Alternatively, store references to Category model if you have them:
        // type: mongoose.Schema.Types.ObjectId, ref: 'Category'
      },
    ],
    excludedCategories: [
      {
        type: String,
      },
    ],
    applicableVariants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SpecificCategoryVariant',
      },
    ],
    excludedVariants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SpecificCategoryVariant',
      },
    ],

    // Example special-case flags for "only first order" or "minimum loyalty points".
    onlyFirstOrder: {
      type: Boolean,
      default: false,
    },
    minUserLoyaltyPoints: {
      type: Number,
      default: 0, // user must have at least X loyalty points to qualify
    },
  },
  { timestamps: true }
);

// Optional text indexes if you want to search offers by name/description
OfferRefSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.models.OfferRef || mongoose.model('OfferRef', OfferRefSchema);