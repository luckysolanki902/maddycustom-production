/**
 * MagicCheckoutSession Model
 * Tracks Shiprocket Magic Checkout sessions for order reconciliation and analytics
 */

import mongoose from 'mongoose';

const MagicCheckoutSessionSchema = new mongoose.Schema(
  {
    // Cart signature for deduplication
    cartSignature: {
      type: String,
      required: true,
      index: true,
    },

    // Shiprocket access token
    token: {
      type: String,
      required: true,
    },

    // Token expiration
    tokenExpiresAt: {
      type: Date,
      required: true,
    },

    // Shiprocket order ID (assigned after checkout)
    shiprocketOrderId: {
      type: String,
      index: true,
      sparse: true,
    },

    // Shiprocket Fastrr order ID (internal Shiprocket order number)
    fastrrOrderId: {
      type: String,
      index: true,
      sparse: true,
    },

    // Shiprocket cart ID
    shiprocketCartId: {
      type: String,
      index: true,
      sparse: true,
    },

    // Session status
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'expired'],
      default: 'pending',
      index: true,
    },

    // Redirect URLs
    redirectUrl: {
      type: String,
      required: true,
    },

    fallbackUrl: String,

    // Order details snapshot
    totals: {
      subtotal: Number,
      discount: Number,
      payable: Number,
    },

    coupon: {
      code: String,
      amount: Number,
      discountType: String,
    },

    user: {
      type: {
        id: mongoose.Schema.Types.ObjectId,
        localId: String,
        name: String,
        email: String,
        phoneNumber: String,
      },
      default: null,
    },

    paymentMode: {
      type: {
        id: String,
        name: String,
      },
      default: null,
    },

    // UTM tracking data
    utm: {
      details: mongoose.Schema.Types.Mixed,
      history: [mongoose.Schema.Types.Mixed],
    },

    // Analytics context
    analyticsContext: {
      cartValue: Number,
      discount: Number,
      payable: Number,
      itemsCount: Number,
      couponCode: String,
    },

    // Cart items snapshot
    cartItems: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
        },
        optionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Option',
        },
        variantNumericId: Number,
        quantity: Number,
        unitPrice: Number,
        mrp: Number,
        sku: String,
        name: String,
        image: String,
      },
    ],

    // Internal Order reference (created after webhook confirmation)
    internalOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
      sparse: true,
    },

    // Metadata for debugging and extensions
    metadata: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
MagicCheckoutSessionSchema.index({ createdAt: 1 });
MagicCheckoutSessionSchema.index({ status: 1, createdAt: -1 });
MagicCheckoutSessionSchema.index({ 'user.id': 1, createdAt: -1 });
MagicCheckoutSessionSchema.index({ shiprocketOrderId: 1, shiprocketCartId: 1 });

// TTL index to auto-delete old sessions after 90 days
MagicCheckoutSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const MagicCheckoutSession =
  mongoose.models.MagicCheckoutSession ||
  mongoose.model('MagicCheckoutSession', MagicCheckoutSessionSchema);

export default MagicCheckoutSession;
