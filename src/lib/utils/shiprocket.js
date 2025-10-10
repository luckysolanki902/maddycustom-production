// lib/utils/shiprocket.js
import axios from 'axios';
const SpecificCategoryVariant = require('@/models/SpecificCategoryVariant');
const Product = require('@/models/Product');
const PackagingBox = require('@/models/PackagingBox');

/* ───────────────────────────────────────────────────────────────────────────
 * 1. SHIPROCKET HELPERS
 * ───────────────────────────────────────────────────────────────────────── */
export async function getShiprocketToken() {
  const res = await axios.post(
    'https://apiv2.shiprocket.in/v1/external/auth/login',
    {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD
    }
  );
  return res.data.token;
}

export async function createShiprocketOrder(orderData) {
  const token = await getShiprocketToken();
  const res = await axios.post(
    'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
    orderData,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    }
  );
  return res.data;
}

export async function trackShiprocketOrder(orderId) {
  const token = await getShiprocketToken();
  const res = await axios.get(
    'https://apiv2.shiprocket.in/v1/external/courier/track',
    {
      params: { order_id: orderId },
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return res.data;
}

export async function checkServiceability(pickupPostcode, deliveryPostcode) {
  const token = await getShiprocketToken();
  const res = await axios.get(
    'https://apiv2.shiprocket.in/v1/external/courier/serviceability/',
    {
      params: {
        pickup_postcode: pickupPostcode,
        delivery_postcode: deliveryPostcode,
        weight: 1,
        cod: 0
      },
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return res.data;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 2. PACKAGING LOOKUP
 * ───────────────────────────────────────────────────────────────────────── */
async function getPackagingDetailsForItem(item) {
  /* Resolve product */
  const productDoc =
    item?.product && typeof item.product === 'object' && item.product._id
      ? item.product
      : await Product.findById(item.product);

  /* Resolve variant */
  let variantDoc = null;
  const selectionTrace = [];
  let selectionSource = null;
  let selectionWarnings = [];
  if (productDoc?.specificCategoryVariant) {
    const variantId =
      typeof productDoc.specificCategoryVariant === 'object'
        ? productDoc.specificCategoryVariant._id
        : productDoc.specificCategoryVariant;

    variantDoc = await SpecificCategoryVariant.findById(variantId).populate({
      path: 'packagingDetails.boxId',
      model: 'PackagingBox'
    });
    selectionTrace.push({ step: 'resolveVariant', variantId: variantId?.toString?.() });
  }

  /* Variant‑level packaging */
  if (variantDoc?.packagingDetails?.boxId) {
    const hasFreebie = variantDoc.freebies?.available === true;
    selectionSource = 'variant';
    const box = variantDoc.packagingDetails.boxId;

    // Heuristic: infer expected tag from variant name by slugifying
    const expectedTag = (variantDoc?.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '') // remove spaces and punctuation
      .trim();
    if (
      expectedTag &&
      Array.isArray(box.compatibleTags) &&
      !box.compatibleTags.includes(expectedTag)
    ) {
      selectionWarnings.push(
        `Box compatibleTags ${JSON.stringify(
          box.compatibleTags
        )} do not include inferred tag '${expectedTag}' from variant name.`
      );
    }

    selectionTrace.push({
      step: 'selectBox.variant',
      reason: 'variant.packagingDetails.boxId present',
      boxId: box?._id?.toString?.()
    });
    return {
      box,
      productWeight: variantDoc.packagingDetails.productWeight || 0,
      hasFreebie,
      freebieWeight: hasFreebie ? parseFloat(variantDoc.freebies.weight || 0) : 0,
      itemName: variantDoc.name,
      debugMeta: {
        selectionSource,
        selectionTrace,
        selectionWarnings,
        ids: {
          productId: productDoc?._id?.toString?.(),
          variantId: variantDoc?._id?.toString?.(),
          specCategoryId:
            typeof productDoc?.specificCategory === 'object'
              ? productDoc.specificCategory?._id?.toString?.()
              : productDoc?.specificCategory?.toString?.()
        }
      }
    };
  }

  /* Product‑level packaging */
  if (productDoc?.packagingDetails?.boxId) {
    const box =
      typeof productDoc.packagingDetails.boxId === 'object'
        ? productDoc.packagingDetails.boxId
        : await PackagingBox.findById(productDoc.packagingDetails.boxId);

    selectionSource = 'product';
    selectionTrace.push({
      step: 'selectBox.product',
      reason: 'product.packagingDetails.boxId present',
      boxId: box?._id?.toString?.()
    });

    return {
      box,
      productWeight: productDoc.packagingDetails.productWeight || 0,
      hasFreebie: false,
      freebieWeight: 0,
      itemName: productDoc.name,
      debugMeta: {
        selectionSource,
        selectionTrace,
        selectionWarnings,
        ids: {
          productId: productDoc?._id?.toString?.(),
          variantId: variantDoc?._id?.toString?.(),
          specCategoryId:
            typeof productDoc?.specificCategory === 'object'
              ? productDoc.specificCategory?._id?.toString?.()
              : productDoc?.specificCategory?.toString?.()
        }
      }
    };
  }

  throw new Error(`No packaging details found for item: ${item?._id}`);
}

/* ───────────────────────────────────────────────────────────────────────────
 * 3. GREEDY PACKER FOR A SINGLE BOX TYPE
 * ───────────────────────────────────────────────────────────────────────── */
function packItemsInSingleBoxType({ itemsForThisBox, boxDoc, debug = false }) {
  const { length, breadth, height } = boxDoc.dimensions;
  const { capacity, weight: boxWeight } = boxDoc;

  const volumetricDivisor = 5000; // Common e-comm divisor (L*B*H)/5000 kg
  const perBoxVolumetricKg = +((length * breadth * height) / volumetricDivisor).toFixed(3);

  const openBoxes = [];
  const createBox = () => ({
    index: openBoxes.length + 1,
    leftoverCapacity: capacity,
    totalProductWeight: 0,
    freebieWeights: [],
    itemsPlaced: [] // { itemName, placedQty, unitWeight, subtotalWeight }
  });

  let freebieAssigned = false;

  for (const entry of itemsForThisBox) {
    let remaining = entry.quantity;

    while (remaining > 0) {
      let box = openBoxes.find(b => b.leftoverCapacity > 0);
      if (!box) {
        box = createBox();
        openBoxes.push(box);
      }

      const fit = Math.min(box.leftoverCapacity, remaining);
      box.leftoverCapacity -= fit;
      box.totalProductWeight += entry.productWeight * fit;

      if (debug) {
        box.itemsPlaced.push({
          itemName: entry.itemName,
          placedQty: fit,
          unitWeight: entry.productWeight,
          subtotalWeight: +(entry.productWeight * fit).toFixed(3)
        });
      }

      if (entry.hasFreebie && !freebieAssigned && entry.freebieWeight > 0) {
        box.freebieWeights.push(entry.freebieWeight);
        freebieAssigned = true;
      }

      remaining -= fit;
    }
  }

  const boxesUsed = openBoxes.length;
  const totalProductWeight = openBoxes.reduce(
    (sum, b) => sum + b.totalProductWeight,
    0
  );
  const totalFreebieWeight = openBoxes.reduce(
    (sum, b) => sum + b.freebieWeights.reduce((a, w) => a + w, 0),
    0
  );
  const totalTareWeight = boxesUsed * boxWeight;
  const totalVolumetricWeightKg = +(perBoxVolumetricKg * boxesUsed).toFixed(3);
  const grossWeight = +(totalTareWeight + totalProductWeight + totalFreebieWeight).toFixed(3);

  return {
    singleBoxDimensions: { length, breadth, height },
    boxesUsed,
    totalWeight: grossWeight,
    totalFreebieWeight,
    boxName: boxDoc.name,
    totals: {
      tareWeight: +totalTareWeight.toFixed(3),
      productWeight: +totalProductWeight.toFixed(3),
      freebieWeight: +totalFreebieWeight.toFixed(3),
      volumetricWeightKg: totalVolumetricWeightKg,
      grossWeight
    },
    debug: debug
      ? {
          boxSpec: {
            name: boxDoc.name,
            capacity,
            tareWeight: boxWeight,
            dimensions: { length, breadth, height },
            perBoxVolumetricKg
          },
          boxes: openBoxes.map(b => ({
            index: b.index,
            leftoverCapacityEnd: b.leftoverCapacity,
            productWeight: +b.totalProductWeight.toFixed(3),
            freebieWeight: +b.freebieWeights.reduce((a, w) => a + w, 0).toFixed(3),
            tareWeight: boxWeight,
            grossWeight: +(boxWeight + b.totalProductWeight + b.freebieWeights.reduce((a, w) => a + w, 0)).toFixed(3),
            volumetricWeightKg: perBoxVolumetricKg,
            itemsPlaced: b.itemsPlaced
          }))
        }
      : undefined
  };
}

/* ───────────────────────────────────────────────────────────────────────────
 * 4. DIMENSION & WEIGHT AGGREGATOR WITH PRIORITY MERGING
 * ───────────────────────────────────────────────────────────────────────── */
const tagsIntersect = (a = [], b = []) => a.some(t => b.includes(t));

export const getDimensionsAndWeight = async (items, options = {}) => {
  const debugRequested = options.debug === true;
  /* Build initial groups in one pass */
  const rawGroups = {};
  const packagingByItem = [];

  for (const item of items) {
    const pkg = await getPackagingDetailsForItem(item);
    const boxId = pkg.box._id.toString();

    if (!rawGroups[boxId]) rawGroups[boxId] = { boxDoc: pkg.box, items: [] };

    rawGroups[boxId].items.push({
      quantity: item.quantity,
      productWeight: pkg.productWeight,
      hasFreebie: pkg.hasFreebie,
      freebieWeight: pkg.freebieWeight,
      itemName: pkg.itemName
    });

    if (debugRequested) {
      packagingByItem.push({
        itemName: pkg.itemName,
        quantity: item.quantity,
        productWeight: pkg.productWeight,
        hasFreebie: pkg.hasFreebie,
        freebieWeight: pkg.freebieWeight,
        selectionSource: pkg.debugMeta?.selectionSource,
        selectionTrace: pkg.debugMeta?.selectionTrace,
        selectionWarnings: pkg.debugMeta?.selectionWarnings,
        ids: pkg.debugMeta?.ids,
        box: {
          id: pkg.box._id?.toString?.() || null,
          name: pkg.box.name,
          capacity: pkg.box.capacity,
          tareWeight: pkg.box.weight,
          dimensions: pkg.box.dimensions,
          priority: pkg.box.priority,
          compatibleTags: pkg.box.compatibleTags
        }
      });
    }
  }

  /* Sort by ascending priority (1 = highest) */
  const orderedGroups = Object.values(rawGroups).sort(
    (a, b) => (a.boxDoc.priority ?? 99) - (b.boxDoc.priority ?? 99)
  );

  /* Merge compatible lower‑priority groups into higher‑priority ones */
  const mergedGroups = [];
  const groupMergeDecisions = [];
  for (const grp of orderedGroups) {
    let mergedInto = null;
    for (const target of mergedGroups) {
      if (
        (target.boxDoc.priority ?? 99) <= (grp.boxDoc.priority ?? 99) &&
        tagsIntersect(target.boxDoc.compatibleTags, grp.boxDoc.compatibleTags)
      ) {
        mergedInto = target;
        break;
      }
    }
    if (mergedInto) {
      mergedInto.items.push(...grp.items);
      if (debugRequested) {
        groupMergeDecisions.push({
          action: 'merged',
          source: {
            boxId: grp.boxDoc._id?.toString?.(),
            name: grp.boxDoc.name,
            priority: grp.boxDoc.priority,
            compatibleTags: grp.boxDoc.compatibleTags
          },
          target: {
            boxId: mergedInto.boxDoc._id?.toString?.(),
            name: mergedInto.boxDoc.name,
            priority: mergedInto.boxDoc.priority,
            compatibleTags: mergedInto.boxDoc.compatibleTags
          },
          reason: 'compatibleTags intersect and target priority <= source priority'
        });
      }
    } else {
      mergedGroups.push(grp);
      if (debugRequested) {
        groupMergeDecisions.push({
          action: 'standalone',
          group: {
            boxId: grp.boxDoc._id?.toString?.(),
            name: grp.boxDoc.name,
            priority: grp.boxDoc.priority,
            compatibleTags: grp.boxDoc.compatibleTags
          }
        });
      }
    }
  }

  /* Pack each final group */
  const resultsPerBoxId = {};
  let maxLength = 0,
    maxBreadth = 0,
    totalHeight = 0,
    overallWeight = 0,
    overallFreebieWeight = 0,
    overallBoxesUsed = 0,
    overallTareWeight = 0,
    overallProductWeight = 0,
    overallVolumetricWeight = 0;

  const packingDetailsByBoxId = {};

  for (const grp of mergedGroups) {
    const result = packItemsInSingleBoxType({
      itemsForThisBox: grp.items,
      boxDoc: grp.boxDoc,
      debug: debugRequested
    });

    resultsPerBoxId[grp.boxDoc._id.toString()] = result;
    if (debugRequested) {
      packingDetailsByBoxId[grp.boxDoc._id.toString()] = result.debug;
    }

    const { length, breadth, height } = result.singleBoxDimensions;
    maxLength = Math.max(maxLength, length);
    maxBreadth = Math.max(maxBreadth, breadth);
    totalHeight += height * result.boxesUsed;

    overallWeight += result.totalWeight;
    overallFreebieWeight += result.totalFreebieWeight;
    overallBoxesUsed += result.boxesUsed;
    if (result.totals) {
      overallTareWeight += result.totals.tareWeight || 0;
      overallProductWeight += result.totals.productWeight || 0;
      overallVolumetricWeight += result.totals.volumetricWeightKg || 0;
    }
  }

  const response = {
    success: true,
    perBoxId: resultsPerBoxId,
    length: maxLength,
    breadth: maxBreadth,
    height: totalHeight,
    weight: +overallWeight.toFixed(3),
    freebieWeight: +overallFreebieWeight.toFixed(3),
    boxesUsed: overallBoxesUsed,
    totals: {
      tareWeight: +overallTareWeight.toFixed(3),
      productWeight: +overallProductWeight.toFixed(3),
      freebieWeight: +overallFreebieWeight.toFixed(3),
      volumetricWeightKg: +overallVolumetricWeight.toFixed(3),
      grossWeight: +overallWeight.toFixed(3)
    }
  };
  if (debugRequested) {
    response.debug = {
      packagingByItem,
      groupMergeDecisions,
      packingDetailsByBoxId,
      finalDimensionAggregation: {
        length: maxLength,
        breadth: maxBreadth,
        height: totalHeight,
        rule: 'max length/breadth across groups; height summed across boxes'
      }
    };
  }
  return response;
};
