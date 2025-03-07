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
 * A small helper to extract a "tag" from an item’s product or variant.
 * Adjust this based on how you store your tags. 
 * For example, if you always keep one main tag in `product.mainTags[0]`, use that.
 */
function getItemTag(item) {
  const productTags = item?.product?.mainTags || [];
  return productTags[0] || 'default-tag'; // fallback if no tags
}


/**
 * Get packaging details from a variant or fallback to product-level packaging
 * 
 * @param {Object} item The cart item
 * @returns {Object} {boxId, productWeight, freebies}
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
        box: variant.packagingDetails.boxId,
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
 * Performs the packing logic for a *single tag group* of items with the given boxes.
 *
 * Returns { length, breadth, height, weight, freebieWeight, boxesUsed, boxesUsedNames, boxDetails }
 */
function packItemsForTag({ itemsForTag, boxesForTag }) {
  // Sort boxes by volume descending
  const getVolume = (box) => {
    const { length, breadth, height } = box.dimensions;
    return length * breadth * height;
  };
  boxesForTag.sort((a, b) => getVolume(b) - getVolume(a));

  // Build lookup from boxId => boxIdx
  const boxIdToIndex = {};
  boxesForTag.forEach((box, idx) => {
    boxIdToIndex[box._id.toString()] = idx;
  });

  // Convert items to "item entries"
  // itemsForTag is already guaranteed to be for a single tag,
  // so we just track minBoxIdx from the item’s box details.
  const itemEntries = [];

  for (const entry of itemsForTag) {
    const { quantity, packagingData } = entry;
    const { box, productWeight, hasFreebie, freebieWeight, itemName } = packagingData;

    if (!box) {
      throw new Error(`Box details missing for itemName=${itemName}.`);
    }
    const minBoxIdx = boxIdToIndex[box._id.toString()];

    itemEntries.push({
      itemName,
      quantity,
      productWeight,
      hasFreebie,
      freebieWeight,
      minBoxIdx
    });
  }

  // Group item entries by minBoxIdx
  const groupedByMinBoxIdx = {};
  for (const e of itemEntries) {
    if (!groupedByMinBoxIdx[e.minBoxIdx]) {
      groupedByMinBoxIdx[e.minBoxIdx] = [];
    }
    groupedByMinBoxIdx[e.minBoxIdx].push(e);
  }

  // Sort group keys so largest dimension first
  const sortedKeys = Object.keys(groupedByMinBoxIdx)
    .map((n) => parseInt(n, 10))
    .sort((a, b) => a - b);

  // We maintain an array of "open boxes"
  const openBoxes = [];
  const createNewBox = (boxIdx) => ({
    boxIdx,
    leftoverCapacity: boxesForTag[boxIdx].capacity,
    totalProductWeight: 0,
    freebieWeights: [],
    packedItems: []
  });

  let freebieAssigned = false; // track if we allow only ONE freebie total for this entire group

  // Allocation
  for (const minBoxIdx of sortedKeys) {
    const currentGroup = groupedByMinBoxIdx[minBoxIdx];
    for (const entry of currentGroup) {
      let remainingQty = entry.quantity;

      while (remainingQty > 0) {
        // find an open box that is big enough => boxIdx <= minBoxIdx && leftoverCapacity>0
        let suitable = openBoxes.find(
          (ob) => ob.boxIdx <= minBoxIdx && ob.leftoverCapacity > 0
        );
        if (!suitable) {
          // open a new one
          suitable = createNewBox(minBoxIdx);
          openBoxes.push(suitable);
        }

        const canFit = Math.min(suitable.leftoverCapacity, remainingQty);
        suitable.leftoverCapacity -= canFit;
        suitable.totalProductWeight += entry.productWeight * canFit;

        if (entry.hasFreebie && !freebieAssigned) {
          if (entry.freebieWeight > 0) {
            suitable.freebieWeights.push(entry.freebieWeight);
            freebieAssigned = true; 
          }
        }

        suitable.packedItems.push({
          itemName: entry.itemName,
          variantBoxName: boxesForTag[minBoxIdx].name,
          quantity: canFit,
        });

        remainingQty -= canFit;
      }
    }
  }

  // Summarize results
  const boxUsageMap = {};
  for (let i = 0; i < boxesForTag.length; i++) {
    boxUsageMap[i] = [];
  }
  for (const ob of openBoxes) {
    boxUsageMap[ob.boxIdx].push(ob);
  }

  let totalWrapWeight = 0;
  let totalBoxWeight = 0;
  let totalFreebieWeight = 0;
  let totalLength = 0;
  let totalBreadth = 0;
  let totalHeight = 0;

  const boxDetails = [];

  Object.keys(boxUsageMap).forEach((idxStr) => {
    const idx = parseInt(idxStr, 10);
    const usedBoxes = boxUsageMap[idx];
    if (!usedBoxes.length) return;

    const boxInfo = boxesForTag[idx];
    const count = usedBoxes.length;

    totalLength += boxInfo.dimensions.length * count;
    totalBreadth += boxInfo.dimensions.breadth * count;
    totalHeight += boxInfo.dimensions.height * count;
    totalBoxWeight += boxInfo.weight * count;

    usedBoxes.forEach((ub) => {
      totalWrapWeight += ub.totalProductWeight;
      if (ub.freebieWeights.length > 0) {
        totalFreebieWeight += ub.freebieWeights[0];
      }
      boxDetails.push({
        boxName: boxInfo.name,
        leftoverCapacity: ub.leftoverCapacity,
        productWeightInBox: ub.totalProductWeight,
        freebiesInBox: ub.freebieWeights,
        packedItems: ub.packedItems,
      });
    });
  });

  const finalWeight = totalWrapWeight + totalBoxWeight + totalFreebieWeight;

  const usedBoxNames = [];
  Object.keys(boxUsageMap).forEach((idxStr) => {
    const idx = parseInt(idxStr, 10);
    if (boxUsageMap[idx].length) {
      usedBoxNames.push(boxesForTag[idx].name);
    }
  });

  return {
    length: totalLength,
    breadth: totalBreadth,
    height: totalHeight,
    weight: +finalWeight.toFixed(3),
    freebieWeight: totalFreebieWeight,
    boxesUsed: openBoxes.length,
    boxesUsedNames: usedBoxNames,
    boxDetails
  };
}


/**
 * Calculates total dimensions and weight for an array of items that might
 * belong to different "tag" groups. We separate them by tag, pack them
 * individually, and then either combine or store separate results.
 *
 * @param {Array} items - The list of cart items. Each item must have {product, quantity}.
 * @returns {Object} - Summaries per tag group and optional total summary.
 */
export const getDimensionsAndWeight = async (items) => {
  try {
    // 1) Group items by their tag
    const groups = {}; 
    for (const item of items) {
      const currentTag = getItemTag(item);
      if (!groups[currentTag]) {
        groups[currentTag] = [];
      }
      groups[currentTag].push(item);
    }

    // 2) For each item, gather packaging details (variant or product).
    //    We'll store the result in an object so we only do the DB lookups once.
    //    Example structure: {
    //        itemId -> { box, productWeight, hasFreebie, freebieWeight, itemName }
    //    }
    const packagingMap = {};
    for (const item of items) {
      packagingMap[item._id] = await getPackagingDetailsForItem(item);
    }

    // 3) For each tag group, filter boxes that have "compatibleTags" containing this tag
    //    Then run the packing logic.
    const resultsPerTag = {};
    const allBoxes = await PackagingBox.find(); // or you might have them in memory
    let overallLength = 0, overallBreadth = 0, overallHeight = 0;
    let overallWeight = 0, overallFreebieWeight = 0, overallBoxesUsed = 0;

    for (const tag of Object.keys(groups)) {
      // which boxes can handle this tag?
      const boxesForTag = allBoxes.filter((b) => b.compatibleTags.includes(tag));

      if (!boxesForTag.length) {
        throw new Error(`No boxes found for tag='${tag}'. Consider adding boxes in DB.`);
      }

      const itemsForTag = groups[tag].map((itm) => ({
        quantity: itm.quantity,
        packagingData: packagingMap[itm._id] // from DB
      }));

      // pack them
      const result = packItemsForTag({ itemsForTag, boxesForTag });
      resultsPerTag[tag] = result;

      // Optionally accumulate overall totals across all tags
      overallLength += result.length;
      overallBreadth += result.breadth;
      overallHeight += result.height;
      overallWeight += result.weight;
      overallFreebieWeight += result.freebieWeight; // or you might handle freebies differently
      overallBoxesUsed += result.boxesUsed;
    }

    // 4) Return results. 
    // You can either return them as separate group results
    // or also return one "grand total" summary. 
    return {
      success: true,
      perTag: resultsPerTag,
      grandTotal: {
        length: overallLength,
        breadth: overallBreadth,
        height: overallHeight,
        weight: +overallWeight.toFixed(3),
        freebieWeight: overallFreebieWeight,
        boxesUsed: overallBoxesUsed,
      }
    };
  } catch (error) {
    console.error('Error calculating dimensions and weight:', error.message);
    throw error;
  }
};
