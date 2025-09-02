// models/meta/Catalogue.js
import mongoose from 'mongoose';

const CatalogueSchema = new mongoose.Schema({
  cycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CatalogueCycle',
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  // If present, this entry was created for a product option.
  optionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Option',
  },
  // Feed data to be used in the Facebook dynamic catalogue.
  feedData: {
    id: String, // a unique identifier (for example, productId or productId-optionId)
    title: String,
    description: String,
    availability: String,
    condition: String,
    price: String,
    // Structured pricing for Merchant API (amount + currency)
    price_amount: Number,
    price_currency: String,
    sale_price_amount: Number,
    sale_price_currency: String,
    link: String,
    image_link: String,
    brand: String,
    // Optional additional images
    additional_image_links: [String],
    // Google specific
    google_product_category: String,
    // Custom attributes array of { name, value }
    custom_attributes: [
      {
        name: String,
        value: String,
      }
    ],
    // Feed meta
    content_language: String,
    target_country: String,
    channel: String,
    feed_label: String,
  },
  processed: {
    type: Boolean,
    default: true,
  },
  // Track if this entry has been synced to Google Merchant
  googleSynced: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Optimize queries selecting unsynced entries in a cycle
CatalogueSchema.index({ cycleId: 1, processed: 1, googleSynced: 1 });

export default mongoose.models.Catalogue || mongoose.model('Catalogue', CatalogueSchema);
