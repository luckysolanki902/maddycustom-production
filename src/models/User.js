const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    // Phone number used for login
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      match: /^\+\d{10,15}$/,
    },
    // Optional email address
    email: {
      type: String,
      unique: true,
      sparse: true,
      match: /^\S+@\S+\.\S+$/,
    },
    // User's name
    name: {
      type: String,
      maxlength: 100,
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
          match: /^\+\d{10,15}$/,
        },
        addressLine1: {
          type: String,
          required: true,
          maxlength: 200,
        },
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
    // References to products in the user's wishlist
    wishlists: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    // Reference to the user's cart
    cart: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cart',
    },
    // References to user's orders
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
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

