const mongoose = require('mongoose');

const NotificationTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  description: {
    type: String,
    required: false,
  },
  // SMS template
  sms: {
    enabled: {
      type: Boolean,
      default: false,
    },
    template: {
      type: String,
      required: false,
    },
    // MSG91 specific fields
    templateId: {
      type: String,
      required: false,
    },
    dltTemplateId: {
      type: String,
      required: false,
    },
  },
  // WhatsApp template
  whatsapp: {
    enabled: {
      type: Boolean,
      default: false,
    },
    template: {
      type: String,
      required: false,
    },
    // AiSensy specific fields
    campaignName: {
      type: String,
      required: false,
    },
    templateParams: [{
      type: String,
    }],
    media: {
      url: String,
      filename: String,
      type: {
        type: String,
        enum: ['image', 'video', 'document'],
        default: 'image',
      },
    },
    buttons: [{
      type: {
        type: String,
        enum: ['url', 'call', 'quick_reply'],
      },
      title: String,
      url: String,
      phoneNumber: String,
      // AiSensy button structure
      sub_type: String,
      index: String,
      parameters: [{
        type: String,
        text: String,
      }],
    }],
    // Support for carousel messages
    carouselSupport: {
      type: Boolean,
      default: false,
    },
    carouselTemplate: {
      cardCount: Number,
      cardFields: [{
        type: String, // e.g., 'productTitle', 'productImage', 'productPrice'
      }],
    },
  },
  // Email template
  email: {
    enabled: {
      type: Boolean,
      default: false,
    },
    subject: {
      type: String,
      required: false,
    },
    template: {
      type: String,
      required: false,
    },
    htmlTemplate: {
      type: String,
      required: false,
    },
  },
  // Variables that can be used in templates
  variables: [{
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    required: {
      type: Boolean,
      default: false,
    },
  }],
  // Template status
  active: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

module.exports = mongoose.models.NotificationTemplate || mongoose.model('NotificationTemplate', NotificationTemplateSchema);
