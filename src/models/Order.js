// models/Order.js

const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema(
  {
    // Reference to User
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Index for efficient querying
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
        name:{
          type: String,
          required: true
        },
        sku: {
          type: String,
          required: true,
        },
        // Quantity of the product
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
        // Price at purchase time
        priceAtPurchase: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    // Total order amount to be paid after discount and before extra charges
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Extra charges at the order level, like payment charges
    extraCharges: [
      {
        chargesName: {
          type: String,
        },
        chargesAmount: {
          type: Number,
          min: 0,
          default: 0,
        },
      },
    ],
    // Coupon applied to this order
    couponsApplied: {
      couponCode: {
        type: String,
        uppercase: true,
        maxlength: 20,
      },
      discountAmount: {
        type: Number,
        min: 0,
        default: 0,
      },
    },
    // Payment details
    paymentDetails: {
      // Payment mode (Reference to ModeOfPayment)
      mode: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ModeOfPayment',
        required: true,
      },
      // Amount paid online
      amountPaidOnline: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      // Amount due online
      amountDueOnline: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      // Amount due via COD
      amountDueCod: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      // Amount paid via COD
      amountPaidCod: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
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
        match: /^\d{10}$/,
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
    // Current status of the payment and order
    paymentStatus: {
      type: String,
      required: true,
      enum: ['pending', 'failed', 'paidPartially', 'allPaid', 'allToBePaidCod'],
      default: 'pending',
      index: true, // Index for efficient querying
    },
    deliveryStatus: {
      type: String,
      required: true,
      enum: ['pending', 'orderCreated', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
      index: true, // Index for efficient querying
    },
  },
  { timestamps: true }
);


module.exports = mongoose.models.Order || mongoose.model('Order', OrderSchema);
