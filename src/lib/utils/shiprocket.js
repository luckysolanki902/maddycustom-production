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
    const response = await axios.post(
      'https://apiv2.shiprocket.in/v1/external/auth/login',
      {
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD,
      }
    );
    return response.data.token;
  } catch (error) {
    console.error(
      'Error fetching Shiprocket token:',
      error.response ? error.response.data : error.message
    );
    throw new Error('Failed to retrieve Shiprocket token.');
  }
}

/**
 * Function to create a Shiprocket order
 */
export async function createShiprocketOrder(orderData) {
  try {
    const token = await getShiprocketToken();

    const response = await axios.post(
      'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
      orderData,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error(
      'Error creating Shiprocket order:',
      error.response ? error.response.data : error.message
    );
    throw new Error('Failed to create Shiprocket order.');
  }
}

/**
 * Function to track a Shiprocket order by order ID
 */
export async function trackShiprocketOrder(orderId) {
  try {
    const token = await getShiprocketToken();

    const response = await axios.get(
      `https://apiv2.shiprocket.in/v1/external/courier/track`,
      {
        params: { order_id: orderId },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error(
      'Error tracking Shiprocket order:',
      error.response ? error.response.data : error.message
    );
    throw new Error('Failed to track Shiprocket order.');
  }
}

/**
 * Get packaging details from a variant or fallback to product-level packaging
 * 
 * @param {Object} item The cart item (with `product` property)
 * @returns {Object} { box, productWeight, hasFreebie, freebieWeight, itemName }
 */
async function getPackagingDetailsForItem(item) {
  // 1) If variant packaging is present:
  const variantId = item?.product?.specificCategoryVariant?._id;
  if (variantId) {
    const variant = await SpecificCategoryVariant.findById(variantId).populate({
      path: 'packagingDetails.boxId',
      model: 'PackagingBox'
    });
    if (variant?.packagingDetails?.boxId) {
      // Found packaging details on variant
      const hasFreebie = variant.freebies?.available === true;
      return {
        box: variant.packagingDetails.boxId, // entire box doc
        productWeight: variant.packagingDetails.productWeight || 0,
        hasFreebie,
        freebieWeight: hasFreebie ? variant.freebies.weight || 0 : 0,
        itemName: variant.name
      };
    }
  }

  // 2) Otherwise fallback to product-level packaging
  const productId = item?.product?._id;
  if (productId) {
    const product = await Product.findById(productId).populate({
      path: 'packagingDetails.boxId',
      model: 'PackagingBox'
    });
    if (product?.packagingDetails?.boxId) {
      // Found packaging details on product
      return {
        box: product.packagingDetails.boxId,
        productWeight: product.packagingDetails.productWeight || 0,
        hasFreebie: false,
        freebieWeight: 0,
        itemName: product.name
      };
    }
  }

  // 3) If no packaging details found at all, throw or handle gracefully
  throw new Error(`No packaging details found for item: ${item?._id}`);
}

/**
 * Packs items into as many boxes of a single box type as needed.
 * 
 * @param {Object} options
 * @param {Array} options.itemsForThisBox - Array of items that all share the same box doc
 * @param {Object} options.boxDoc         - The single PackagingBox document
 * 
 * @returns {Object} { length, breadth, height, weight, freebieWeight, boxesUsed, boxDetails }
 */
function packItemsInSingleBoxType({ itemsForThisBox, boxDoc }) {
  // We'll open multiple boxes of this type if needed
  const { length, breadth, height } = boxDoc.dimensions;
  const capacity = boxDoc.capacity;
  const boxWeight = boxDoc.weight;

  // Each "open box" is an object tracking how many items we can still fit, plus packing info
  const openBoxes = [];
  const createNewBox = () => ({
    leftoverCapacity: capacity,
    totalProductWeight: 0,
    freebieWeights: [],
    packedItems: []
  });

  // Optionally, we only assign one freebie across all boxes of this type:
  let freebieAssigned = false;

  // For each item, fill existing boxes or open a new one
  for (const entry of itemsForThisBox) {
    let remainingQty = entry.quantity;

    while (remainingQty > 0) {
      // find an open box that has leftover capacity
      let suitableBox = openBoxes.find((ob) => ob.leftoverCapacity > 0);
      if (!suitableBox) {
        // create a new box
        suitableBox = createNewBox();
        openBoxes.push(suitableBox);
      }

      // how many of this item can we fit?
      const canFit = Math.min(suitableBox.leftoverCapacity, remainingQty);
      suitableBox.leftoverCapacity -= canFit;
      suitableBox.totalProductWeight += entry.productWeight * canFit;

      // freebies
      if (entry.hasFreebie && !freebieAssigned) {
        if (entry.freebieWeight > 0) {
          suitableBox.freebieWeights.push(entry.freebieWeight);
          freebieAssigned = true;
        }
      }

      // record packed items
      suitableBox.packedItems.push({
        itemName: entry.itemName,
        quantity: canFit
      });

      remainingQty -= canFit;
    }
  }

  // Summarize the results
  const boxesUsed = openBoxes.length;
  const totalBoxWeight = boxWeight * boxesUsed; // sum of all box (carton) weights

  let totalProductWeight = 0;
  let totalFreebieWeight = 0;

  // Build a detailed breakdown
  const boxDetails = openBoxes.map((ob, idx) => {
    totalProductWeight += ob.totalProductWeight;
    if (ob.freebieWeights.length) {
      totalFreebieWeight += ob.freebieWeights.reduce((a, b) => a + b, 0);
    }
    return {
      boxIndex: idx + 1,
      leftoverCapacity: ob.leftoverCapacity,
      productWeightInBox: ob.totalProductWeight,
      freebiesInBox: ob.freebieWeights,
      packedItems: ob.packedItems
    };
  });

  const finalWeight = totalProductWeight + totalBoxWeight + totalFreebieWeight;

  // Return the dimension of a single box multiplied by how many we used
  // We'll figure out the overall dimension logic later in the aggregator.
  return {
    singleBoxDimensions: { length, breadth, height },
    boxesUsed,
    totalWeight: +finalWeight.toFixed(3),
    totalFreebieWeight,
    boxDetails,
    boxName: boxDoc.name
  };
}

/**
 * Calculates total dimensions and weight by grouping items by their box ID,
 * then combining them into an "imaginary" single dimension.
 * 
 * The final dimension is computed as:
 *   length = max length among all box types used
 *   breadth = max breadth among all box types used
 *   height = sum of (height × boxesUsed) for all box types
 *
 * @param {Array} items - The list of cart items. Each item must have {product, quantity}.
 * @returns {Object} - Summaries per boxId and a grandTotal for everything.
 */
export const getDimensionsAndWeight = async (items) => {
  try {
    // 1) For each item, gather packaging details (variant or product).
    // We'll store them in a map to avoid repeated DB lookups.
    const packagingMap = {};
    for (const item of items) {
      packagingMap[item._id] = await getPackagingDetailsForItem(item);
    }

    // 2) Group items by boxId
    const groups = {};
    for (const item of items) {
      const pkg = packagingMap[item._id];
      const boxId = pkg.box?._id.toString();
      if (!groups[boxId]) {
        groups[boxId] = {
          boxDoc: pkg.box,
          items: []
        };
      }
      groups[boxId].items.push({
        quantity: item.quantity,
        productWeight: pkg.productWeight,
        hasFreebie: pkg.hasFreebie,
        freebieWeight: pkg.freebieWeight,
        itemName: pkg.itemName
      });
    }

    // 3) For each boxId group, perform the packing
    const resultsPerBoxId = {};

    // We'll track the final dimension with this approach:
    let maxLength = 0;
    let maxBreadth = 0;
    let totalHeight = 0;

    let overallWeight = 0;
    let overallFreebieWeight = 0;
    let overallBoxesUsed = 0;

    for (const boxId of Object.keys(groups)) {
      const { boxDoc, items: groupItems } = groups[boxId];

      const result = packItemsInSingleBoxType({
        itemsForThisBox: groupItems,
        boxDoc
      });

      // Save result
      resultsPerBoxId[boxId] = result;

      // Update dimension aggregator
      const { length, breadth, height } = result.singleBoxDimensions;
      if (length > maxLength) maxLength = length;
      if (breadth > maxBreadth) maxBreadth = breadth;
      // we sum (height * boxesUsed) to get "stacked" height
      totalHeight += height * result.boxesUsed;

      // Weight aggregator
      overallWeight += result.totalWeight;
      overallFreebieWeight += result.totalFreebieWeight;
      overallBoxesUsed += result.boxesUsed;
    }

    // 4) Return the final response
    return {
      success: true,
      perBoxId: resultsPerBoxId,
      length: maxLength,
      breadth: maxBreadth,
      height: totalHeight,
      weight: +overallWeight.toFixed(3),
      freebieWeight: +overallFreebieWeight.toFixed(3),
      boxesUsed: overallBoxesUsed
    };
  } catch (error) {
    console.error('Error calculating dimensions and weight:', error.message);
    throw error;
  }
};
