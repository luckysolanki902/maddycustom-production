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
        // Discount applied
        discount: {
          type: Number,
          min: 0,
          default: 0,
        },
        // Extra charges, if any
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
      // Amount due via COD
      amountDueCod: {
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
    // Current status of the order
    status: {
      type: String,
      required: true,
      enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
      index: true, // Index for efficient querying
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
    // Coupon applied to this order
    couponApplied: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Order || mongoose.model('Order', OrderSchema);
