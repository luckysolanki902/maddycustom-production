// lib/utils/shiprocket.js

import axios from 'axios';
const SpecificCategoryVariant = require('@/models/SpecificCategoryVariant');
const Product = require('@/models/Product');
const PackagingBox = require('@/models/PackagingBox');

/**
 * Function to get Shiprocket token
 */
export async function getShiprocketToken() {
  try {
    const response = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    });
    return response.data.token;
  } catch (error) {
    console.error('Error fetching Shiprocket token:', error.response ? error.response.data : error.message);
    throw new Error('Failed to retrieve Shiprocket token.');
  }
}

/**
 * Function to create a Shiprocket order
 */
export async function createShiprocketOrder(orderData) {
  try {
    const token = await getShiprocketToken();

    const response = await axios.post('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', orderData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error creating Shiprocket order:', error.response ? error.response.data : error.message);
    throw new Error('Failed to create Shiprocket order.');
  }
}

/**
 * Function to track a Shiprocket order by order ID
 */
export async function trackShiprocketOrder(orderId) {
  try {
    const token = await getShiprocketToken();

    const response = await axios.get(`https://apiv2.shiprocket.in/v1/external/courier/track`, {
      params: { order_id: orderId },
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error tracking Shiprocket order:', error.response ? error.response.data : error.message);
    throw new Error('Failed to track Shiprocket order.');
  }
}

/**
 * Calculates the total dimensions and weight for the order based on its items' variants.
 * Groups items by the same box ID and calculates the total dimensions and weight.
 *
 * @param {Array} items - Array of order items.
 * @returns {Object} - Total length, breadth, height, and weight.
 */
export const getDimensionsAndWeight = async (items) => {
  const variantIds = items.map(item => {
    if (item.product && item.product.specificCategoryVariant) {
      return item.product.specificCategoryVariant._id;
    }
    console.warn(`Skipping item due to missing Product or SpecificCategoryVariant: ${item._id}`);
    return null;
  }).filter(id => id !== null);

  try {
    // Fetch all variants with their packaging and freebie details using nested populate
    const variants = await SpecificCategoryVariant.find({ _id: { $in: variantIds } })
      .populate({
        path: 'packagingDetails.boxId',
        model: 'PackagingBox',
      });

    const variantMap = {};
    variants.forEach(variant => {
      const { boxId, productWeight } = variant.packagingDetails || {};
      const hasFreebie = variant.freebies && variant.freebies.available;
      const freebieWeight = hasFreebie ? variant.freebies.weight || 0 : 0;
      
      variantMap[variant._id.toString()] = {
        box: boxId,
        productWeight: productWeight || 0,
        hasFreebie,
        freebieWeight,
      };
    });

    const boxGroupMap = {};

    for (const item of items) {
      const variantId = item.product.specificCategoryVariant._id.toString();
      const variantData = variantMap[variantId];

      if (!variantData) {
        throw new Error(`Variant with ID ${variantId} not found.`);
      }

      const { box, productWeight, hasFreebie, freebieWeight } = variantData;

      if (!box) {
        throw new Error(`Box details missing for variant ID ${variantId}.`);
      }

      // Initialize box group if it doesn't exist
      if (!boxGroupMap[box._id]) {
        boxGroupMap[box._id] = {
          box,
          totalQuantity: 0,
          totalWeight: 0,
          freebieWeights: [], // To track freebie weights for the group
        };
      }

      // Accumulate quantities and weights for this box group
      boxGroupMap[box._id].totalQuantity += item.quantity;
      boxGroupMap[box._id].totalWeight += productWeight * item.quantity;

      // If the variant has a freebie, add its weight to the freebieWeights array
      if (hasFreebie) {
        boxGroupMap[box._id].freebieWeights.push(freebieWeight);
      }
    }

    let totalWrapWeight = 0;
    let totalBoxWeight = 0;
    let totalFreebieWeight = 0;
    let totalLength = 0;
    let totalBreadth = 0;
    let totalHeight = 0;

    Object.values(boxGroupMap).forEach(({ box, totalQuantity, totalWeight, freebieWeights }) => {
      const numberOfBoxes = Math.ceil(totalQuantity / box.capacity);

      // Calculate total box weight
      totalBoxWeight += box.weight * numberOfBoxes;

      // Accumulate dimensions (multiplied by the number of boxes)
      totalLength += box.dimensions.length * numberOfBoxes;
      totalBreadth += box.dimensions.breadth * numberOfBoxes;
      totalHeight += box.dimensions.height * numberOfBoxes;

      // Accumulate wrap weight (product weight)
      totalWrapWeight += totalWeight;

      // Calculate freebie weight: max one freebie per box
      if (freebieWeights.length > 0) {
        // Determine the freebie weight to add per box (e.g., the maximum freebie weight)
        const maxFreebieWeight = Math.max(...freebieWeights);
        totalFreebieWeight += maxFreebieWeight * numberOfBoxes;
      }
    });

    // Total weight is the sum of wrap weight, box weight, and freebie weight
    const totalWeight = totalWrapWeight + totalBoxWeight + totalFreebieWeight;

    return {
      length: totalLength,
      breadth: totalBreadth,
      height: totalHeight,
      weight: totalWeight.toFixed(3),
      freebieWeight: totalFreebieWeight, // Optional: to provide visibility on freebie weights
    };
  } catch (error) {
    console.error('Error calculating dimensions and weight:', error.message);
    throw error;
  }
};
