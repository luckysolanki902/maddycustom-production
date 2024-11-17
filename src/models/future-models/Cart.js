/**
 * Cart Schema
 * Represents a user's shopping cart.
 */

const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema(
  {
    // Reference to User
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    // Array of cart items
    items: [
      {
        // Reference to Product
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        // Quantity of the product
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
        // Custom fields for additional information optional not necessary right now
        customFields: {
          bikeModel: String,
          carModel: String,
          helmetSize: String,
        },
      },
    ],
    // Calculated total amount of the cart
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Cart || mongoose.model('Cart', CartSchema);
