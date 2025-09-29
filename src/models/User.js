const mongoose = require('mongoose');

// Optional structured fields for addresses (UI-only helpers)
const AddressStructuredSchema = new mongoose.Schema(
  {
    areaLocality: { type: String },
    landmark: { type: String },
    // floor can be number or string ("Ground", "Mezzanine")
    floor: { type: mongoose.Schema.Types.Mixed },
    geo: {
      lat: { type: Number },
      lng: { type: Number },
    },
    // A convenience, concatenated address for admin display/search
    fullAddress: { type: String },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    // Phone number used for login
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{10}$/,
    },
    // User's name
    name: {
      type: String,
      maxlength: 100,
      required: false,
    },
    email:{
      type: String,
      required: false,
      unique: true,
      //validation for email:
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email address',
      ],
    },
    // Array of address objects
    addresses: [
      {
        receiverName: {
          type: String,
          required: true,
          maxlength: 100,
        },
        receiverPhoneNumber: {
          type: String,
          required: true,
          match: /^\d{10}$/,
        },
        addressLine1: {
          type: String,
          required: true,
          maxlength: 200,
        },
        // Optional
        addressLine2: {
          type: String,
          maxlength: 200,
        },
        city: {
          type: String,
          required: true,
          maxlength: 100,
        },
        state: {
          type: String,
          required: true,
          maxlength: 100,
        },
        country: {
          type: String,
          default: 'India',
          maxlength: 100,
        },
        pincode: {
          type: String,
          required: true,
          maxlength: 10,
        },
        // New, non-breaking structured fields for richer UI/UX
        structured: { type: AddressStructuredSchema, default: undefined },
      },
    ],
    // OTP for login/verification
    otp: {
      type: String,
      expireAfterSeconds: 600,
    },
    // Indicates if the user is verified
    isVerified: {
      type: Boolean,
      default: false,
    },
    // source from where user is created
    source: {
      type: String,
      default: 'unknown',
    },
  },
  { timestamps: true }
);

if (mongoose.models.User) {
  delete mongoose.models.User;
}

module.exports =  mongoose.models.User ||mongoose.model('User', UserSchema);

