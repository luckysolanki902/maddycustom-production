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
    
    // Computed fields
    itemsCount: {
      type: Number,
      default: 0,
      index: true, // If you need to query based on itemsCount
    },
    
    itemsTotal: {
      type: Number,
      default: 0,
      index: true, // If you need to query based on itemsTotal
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
        name: {
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

    // Final amount paid by user or to be paid (if he's paying some part)... So it is the exact total of the amount that has to be finally paid for an order
    // i.e. Final bill
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Inludes delivery charges, MOP Charges (charges if you pay some part of the amount online and rest on cod)
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
    couponApplied: [
      {
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
        incrementedCouponUsage: {
          type: Boolean,
          default: false,
        }
      }
    ],
    // Total discount applied to the order
    totalDiscount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
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

    // Extra fields like bike model:
    extraFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed, // Allows both String and Number
      default: {},
    },

    customFields: {
      croppedImage: {
        type: String
      }
    },

    // UTM details
    utmDetails: {
      source: {
        type: String,
        default: 'direct',
        maxlength: 100,
        index: true,
      },
      medium: {
        type: String,
        maxlength: 100,
      },
      campaign: {
        type: String,
        maxlength: 100,
      },
      term: {
        type: String,
        maxlength: 100,
      },
      content: {
        type: String,
        maxlength: 100,
      },
    },
  },
  { timestamps: true }
);

// Pre-save middleware to compute itemsCount and itemsTotal
OrderSchema.pre('save', function(next) {
  // Calculate itemsCount as the total quantity of all items
  this.itemsCount = this.items.reduce((count, item) => count + item.quantity, 0);
  
  // Calculate itemsTotal as the sum of (priceAtPurchase * quantity) for all items
  this.itemsTotal = this.items.reduce((total, item) => total + (item.priceAtPurchase * item.quantity), 0);
  
  next();
});

// Pre middleware for findOneAndUpdate to compute itemsCount and itemsTotal if items are updated
OrderSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  // Check if 'items' field is being updated
  if (update.items) {
    const items = update.items;
    const itemsCount = items.reduce((count, item) => count + (item.quantity || 1), 0);
    const itemsTotal = items.reduce((total, item) => total + ((item.priceAtPurchase || 0) * (item.quantity || 1)), 0);
    
    // Update the fields in the update object
    this.setUpdate({
      ...update,
      itemsCount,
      itemsTotal,
    });
  }
  
  next();
});

module.exports = mongoose.models.Order || mongoose.model('Order', OrderSchema);
