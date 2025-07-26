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
    link: String,
    image_link: String,
    brand: String,
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

export default mongoose.models.Catalogue || mongoose.model('Catalogue', CatalogueSchema);
