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
 * Calculates total dimensions and weight based on optimized box assignments.
 * Also returns a breakdown of which items were packed into which boxes with variant names.
 *
 * @param {Array} items - The list of items to be packed.
 * @returns {Object} - Total dimensions, weight, and box usage details.
 */
export const getDimensionsAndWeight = async (items) => {
  // 1) Collect variant IDs
  const variantIds = items
    .map((item) => {
      if (item?.product?.specificCategoryVariant) {
        return item.product.specificCategoryVariant._id;
      }
      console.warn(
        `Skipping item due to missing Product or SpecificCategoryVariant: ${item?._id}`
      );
      return null;
    })
    .filter(Boolean);

  try {
    // 2) Fetch variants with packaging + freebies info
    const variants = await SpecificCategoryVariant.find({
      _id: { $in: variantIds },
    }).populate({
      path: 'packagingDetails.boxId',
      model: 'PackagingBox',
    });

    // 3) Build a map variantId -> { box, productWeight, freebies, name }
    //    Also gather all distinct boxes encountered.
    const variantMap = {};
    const allBoxesMap = new Map();

    for (const variant of variants) {
      const { boxId, productWeight } = variant.packagingDetails || {};
      const hasFreebie = variant.freebies && variant.freebies.available;
      const freebieWeight = hasFreebie ? variant.freebies.weight || 0 : 0;
      const variantName = variant.name || `Variant_${variant._id}`; // Adjust based on your schema

      if (boxId) {
        allBoxesMap.set(boxId._id.toString(), boxId);
      }

      variantMap[variant._id.toString()] = {
        box: boxId,
        productWeight: productWeight || 0,
        hasFreebie,
        freebieWeight,
        variantName, // Include the variant name
      };
    }

    // 4) Convert the boxes to an array and sort by (volume) descending
    const allBoxes = Array.from(allBoxesMap.values());

    const getVolume = (box) => {
      const { length, breadth, height } = box.dimensions;
      return length * breadth * height;
    };

    allBoxes.sort((a, b) => getVolume(b) - getVolume(a));
    // Now index=0 => largest box, index=1 => next largest, etc.

    // 5) Build a lookup from box._id -> index
    const boxIdToIndex = {};
    allBoxes.forEach((box, idx) => {
      boxIdToIndex[box._id.toString()] = idx;
    });

    // 6) Convert `items` into "item entries" => { minBoxIdx, quantity, weights, etc. }
    const itemEntries = [];
    for (const item of items) {
      const variantId = item?.product?.specificCategoryVariant?._id?.toString();
      if (!variantId || !variantMap[variantId]) {
        throw new Error(
          `Variant missing or not found for item _id=${item?._id}`
        );
      }

      const variantData = variantMap[variantId];
      const { box, productWeight, hasFreebie, freebieWeight, variantName } = variantData;
      if (!box) {
        throw new Error(`Box details missing for variant ID ${variantId}.`);
      }

      const minBoxIdx = boxIdToIndex[box._id.toString()]; // e.g. 0=largest, etc.

      itemEntries.push({
        variantId,
        variantName, // Include the variant name
        quantity: item.quantity,
        productWeight,
        hasFreebie,
        freebieWeight,
        minBoxIdx,
      });
    }

    // 7) Group item entries by minBoxIdx so we handle from largest dimension to smallest
    const groupedByMinBoxIdx = {};
    for (const entry of itemEntries) {
      if (!groupedByMinBoxIdx[entry.minBoxIdx]) {
        groupedByMinBoxIdx[entry.minBoxIdx] = [];
      }
      groupedByMinBoxIdx[entry.minBoxIdx].push(entry);
    }

    // Sort the group keys so we handle the largest dimension first
    const sortedKeys = Object.keys(groupedByMinBoxIdx)
      .map((n) => parseInt(n, 10))
      .sort((a, b) => a - b);

    // 8) We'll maintain an array of "open boxes"
    //    Each "open box" = {
    //       boxIdx,
    //       leftoverCapacity,
    //       totalProductWeight,
    //       freebieWeights: [],
    //       packedItems: []    <-- detail of which items/variants got placed
    //    }
    const openBoxes = [];

    // Helper to create a new box
    const createNewBox = (boxIdx) => {
      const boxRef = allBoxes[boxIdx];
      return {
        boxIdx,
        leftoverCapacity: boxRef.capacity, // e.g. "4" items
        totalProductWeight: 0,
        freebieWeights: [],
        packedItems: [],
      };
    };

    // 9) Allocation logic: largest minBoxIdx first => smaller minBoxIdx last
    let freebieAssigned = false; // Flag to ensure only one freebie per order

    for (const minBoxIdx of sortedKeys) {
      const currentGroup = groupedByMinBoxIdx[minBoxIdx];

      for (const entry of currentGroup) {
        let remainingQty = entry.quantity;

        while (remainingQty > 0) {
          // Look for an open box that is "big enough" => boxIdx <= minBoxIdx
          // AND has leftover capacity.
          let suitableBox = openBoxes.find(
            (ob) => ob.boxIdx <= minBoxIdx && ob.leftoverCapacity > 0
          );

          // If none found, open a new box of exactly `minBoxIdx` dimension
          if (!suitableBox) {
            suitableBox = createNewBox(minBoxIdx);
            openBoxes.push(suitableBox);
          }

          // Place as many items as possible
          const canFit = Math.min(suitableBox.leftoverCapacity, remainingQty);
          suitableBox.leftoverCapacity -= canFit;
          suitableBox.totalProductWeight += entry.productWeight * canFit;

          // Assign a freebie if applicable and not yet assigned
          if (entry.hasFreebie && !freebieAssigned) {
            if (entry.freebieWeight > 0) { // Ensure freebie has a positive weight
              suitableBox.freebieWeights.push(entry.freebieWeight);
              freebieAssigned = true;
            }
          }

          // Log which variant (or item) we placed, including the variant name and box name
          suitableBox.packedItems.push({
            variantName: entry.variantName,
            variantBoxName: allBoxes[minBoxIdx].name, // Include the variant's box name
            quantity: canFit,
          });

          remainingQty -= canFit;
        }
      }
    }

    // 10) Calculate total dimensions and weights
    const boxUsageMap = {};
    for (let i = 0; i < allBoxes.length; i++) {
      boxUsageMap[i] = []; // an array of openBoxes with that boxIdx
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

    // Prepare box details
    const boxDetails = []; // each entry => { boxName, items: [...], leftoverCapacity, ... }

    Object.keys(boxUsageMap).forEach((idxStr) => {
      const idx = parseInt(idxStr, 10);
      const usedBoxes = boxUsageMap[idx];
      if (!usedBoxes.length) return;

      const boxInfo = allBoxes[idx];
      const boxCount = usedBoxes.length;

      // Dimensional sums
      totalLength += boxInfo.dimensions.length * boxCount;
      totalBreadth += boxInfo.dimensions.breadth * boxCount;
      totalHeight += boxInfo.dimensions.height * boxCount;

      // Box weight sum
      totalBoxWeight += boxInfo.weight * boxCount;

      // For each open box of this type
      usedBoxes.forEach((ub) => {
        // Sum product weight
        totalWrapWeight += ub.totalProductWeight;

        // Sum freebie weight (only one freebie is assigned)
        if (ub.freebieWeights.length > 0) {
          // Assuming only one freebie is assigned across all boxes
          totalFreebieWeight += ub.freebieWeights[0];
        }

        // Detail the packed items in this box
        boxDetails.push({
          boxName: boxInfo.name,
          leftoverCapacity: ub.leftoverCapacity,
          productWeightInBox: ub.totalProductWeight,
          freebiesInBox: ub.freebieWeights,
          packedItems: ub.packedItems.map((pi) => ({
            variantName: pi.variantName,
            variantBoxName: pi.variantBoxName,
            quantity: pi.quantity,
          })),
        });
      });
    });

    const finalWeight = totalWrapWeight + totalBoxWeight + totalFreebieWeight;

    // 11) Summarize which box types were used
    const usedBoxNames = [];
    Object.keys(boxUsageMap).forEach((idxStr) => {
      const idx = parseInt(idxStr, 10);
      if (boxUsageMap[idx].length) {
        usedBoxNames.push(allBoxes[idx].name);
      }
    });

    const totalBoxCount = openBoxes.length;

    // Log a line about the box usage
    
    // console.log(
    //   `${totalBoxCount} boxes: ${usedBoxNames.join(', ')} are required.`
    // );

    // 12) Return the final data
    return {
      length: totalLength,
      breadth: totalBreadth,
      height: totalHeight,
      weight: finalWeight.toFixed(3),
      freebieWeight: totalFreebieWeight,
      boxesUsed: totalBoxCount,
      boxesUsedNames: usedBoxNames,
      boxDetails,
    };
  } catch (error) {
    console.error('Error calculating dimensions and weight:', error.message);
    throw error;
  }
};
