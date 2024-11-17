/**
 * Order Schema
 * Represents an order placed by a user.
 */

const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema(
  {
    // Reference to User
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Index added for efficient querying by user
    },
    // Array of order items
    items: [
      {
        // Reference to Product
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
          index: true,
        },
        // Quantity of the product
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
        // Price of the product at the time of purchase
        priceAtPurchase: {
          type: Number,
          required: true,
          min: 0,
        },
        // Selected variant
        variant: {
          type: String,
        },
        // Selected color
        color: {
          type: String,
        },
        // Custom fields for additional information
        customFields: {
          // Example: "Hero Splendor Plus"
          bikeModel: {
            type: String,
          },
          // Example: "Honda City"
          carModel: {
            type: String,
          },
          // Helmet size
          // Example: "M"
          size: {
            type: String,
            enum: ['S', 'M', 'L', 'XL'],
          },
        },
      },
    ],
    // Total order amount
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Payment details
    paymentDetails: {
      // Payment mode
      // Example: "fifty"
      mode: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ModeOfPayment',
        required: true,
      },
      // Amount paid online
      amountPaid: {
        type: Number,
        required: true,
        min: 0,
      },
      // Amount to be paid on delivery
      amountDue: {
        type: Number,
        required: true,
        min: 0,
      },
      // Payment gateway details
      razorpayDetails: {
        paymentId: String,
        orderId: String,
        signature: String,
      },
    },
    // Shipping address
    address: {
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
    // Current status of the order
    status: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
      index: true, // Index added for efficient querying by status
    },
    // Purchase verification statuses
    purchaseStatus: {
      paymentVerified: {
        type: Boolean,
        default: false,
      },
      shiprocketOrderCreated: {
        type: Boolean,
        default: false,
      },
    },
    // Offers applied to this order
    offersApplied: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Offer',
      },
    ],
    // Coupon applied to this order
    couponApplied: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Order || mongoose.model('Order', OrderSchema);
