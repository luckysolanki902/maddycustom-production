const mongoose = require('mongoose');

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
      minLength: 3,
      required: true,
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
  },
  { timestamps: true }
);

module.exports =  mongoose.models.User ||mongoose.model('User', UserSchema);

