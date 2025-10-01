const mongoose = require('mongoose');

const UTMSubSchema = new mongoose.Schema(
  {
    source: { type: String, trim: true },
    medium: { type: String, trim: true },
    campaign: { type: String, trim: true },
    term: { type: String, trim: true },
    content: { type: String, trim: true },
    fbc: { type: String, trim: true },
    pathname: { type: String, trim: true },
    queryParams: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const DeviceSchema = new mongoose.Schema(
  {
    userAgent: { type: String },
    platform: { type: String },
    language: { type: String },
    screen: {
      width: { type: Number },
      height: { type: Number },
    },
  },
  { _id: false }
);

const FlagsSchema = new mongoose.Schema(
  {
    isReturning: { type: Boolean, default: false },
    isFromAd: { type: Boolean, default: false },
  },
  { _id: false }
);

const ContactSchema = new mongoose.Schema(
  {
    phoneNumber: { type: String, trim: true },
    email: { type: String, trim: true },
    name: { type: String, trim: true },
  },
  { _id: false }
);

const MetadataSchema = new mongoose.Schema(
  {
    contact: { type: ContactSchema, default: undefined },
    tags: [{ type: String, trim: true }],
    lastLinkedAt: { type: Date },
  },
  { _id: false }
);

const FunnelSessionSchema = new mongoose.Schema(
  {
    visitorId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    metadata: { type: MetadataSchema, default: undefined },

    utm: UTMSubSchema,
    referrer: { type: String, trim: true },
    landingPage: {
      path: { type: String, trim: true },
      name: { type: String, trim: true },
      pageCategory: { type: String, trim: true },
      category: { type: String, trim: true },
      slug: { type: String, trim: true },
      title: { type: String, trim: true },
    },

    device: DeviceSchema,
    geo: {
      city: { type: String, trim: true },
      region: { type: String, trim: true },
      country: { type: String, trim: true },
      timezone: { type: String, trim: true },
    },

    firstActivityAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now, index: true },
    revisits: { type: Number, default: 0 },

    flags: FlagsSchema,
  },
  {
    timestamps: true,
  }
);

FunnelSessionSchema.index({ visitorId: 1, sessionId: 1 }, { unique: true });
FunnelSessionSchema.index({ 'utm.campaign': 1, lastActivityAt: -1 });
FunnelSessionSchema.index({ 'device.platform': 1, lastActivityAt: -1 });
FunnelSessionSchema.index({ 'landingPage.pageCategory': 1, lastActivityAt: -1 });
FunnelSessionSchema.index({ 'metadata.contact.phoneNumber': 1, lastActivityAt: -1 });

module.exports =
  mongoose.models.FunnelSession || mongoose.model('FunnelSession', FunnelSessionSchema);
