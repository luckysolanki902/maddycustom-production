const mongoose = require('mongoose');

const PageSchema = new mongoose.Schema(
  {
    path: { type: String, trim: true },
    name: { type: String, trim: true },
    pageCategory: { type: String, trim: true },
    category: { type: String, trim: true },
    slug: { type: String, trim: true },
    title: { type: String, trim: true },
    referringPath: { type: String, trim: true },
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true },
    name: { type: String, trim: true },
    price: { type: Number },
    quantity: { type: Number },
    variantId: { type: String, trim: true },
    brand: { type: String, trim: true },
    category: { type: String, trim: true },
  },
  { _id: false }
);

const CartSchema = new mongoose.Schema(
  {
    items: { type: Number },
    value: { type: Number },
    currency: { type: String, trim: true },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, trim: true },
    value: { type: Number },
    coupon: { type: String, trim: true },
    currency: { type: String, trim: true },
  },
  { _id: false }
);

const EventUtmSchema = new mongoose.Schema(
  {
    source: { type: String, trim: true },
    medium: { type: String, trim: true },
    campaign: { type: String, trim: true },
    term: { type: String, trim: true },
    content: { type: String, trim: true },
  },
  { _id: false }
);

const FunnelEventSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FunnelSession',
      required: true,
      index: true,
    },
    visitorId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    step: {
      type: String,
      required: true,
      enum: [
        'visit',
        'view_product',
        'add_to_cart',
        'apply_offer',
        'view_cart_drawer',
        'open_order_form',
        'address_tab_open',
        'initiate_checkout',
        'contact_info',
        'payment_initiated',
        'purchase',
        'session_return',
      ],
      index: true,
    },
    timestamp: { type: Date, default: Date.now, index: true },
    eventId: { type: String, trim: true },
    eventHash: { type: String, trim: true },

    page: PageSchema,
    product: ProductSchema,
    cart: CartSchema,
    order: OrderSchema,
    utm: EventUtmSchema,

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    errors: {
      type: [String],
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

FunnelEventSchema.index({ step: 1, timestamp: -1 });
FunnelEventSchema.index({ 'page.category': 1, timestamp: -1 });
FunnelEventSchema.index({ 'page.pageCategory': 1, timestamp: -1 });
FunnelEventSchema.index({ 'product.id': 1, timestamp: -1 });
FunnelEventSchema.index({ sessionId: 1, step: 1, timestamp: -1 });
FunnelEventSchema.index(
  { sessionId: 1, step: 1, eventId: 1 },
  {
    unique: true,
    partialFilterExpression: { eventId: { $type: 'string' } },
  }
);
// Additional index for eventHash-based deduplication
FunnelEventSchema.index(
  { sessionId: 1, step: 1, eventHash: 1 },
  {
    partialFilterExpression: { 
      eventHash: { $type: 'string' },
      step: { $in: ['purchase', 'payment_initiated', 'initiate_checkout'] }
    },
  }
);

module.exports =
  mongoose.models.FunnelEvent || mongoose.model('FunnelEvent', FunnelEventSchema);
