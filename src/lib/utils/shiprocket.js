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
  if (productDoc?.specificCategoryVariant) {
    const variantId =
      typeof productDoc.specificCategoryVariant === 'object'
        ? productDoc.specificCategoryVariant._id
        : productDoc.specificCategoryVariant;

    variantDoc = await SpecificCategoryVariant.findById(variantId).populate({
      path: 'packagingDetails.boxId',
      model: 'PackagingBox'
    });
  }

  /* Variant‑level packaging */
  if (variantDoc?.packagingDetails?.boxId) {
    const hasFreebie = variantDoc.freebies?.available === true;
    return {
      box: variantDoc.packagingDetails.boxId,
      productWeight: variantDoc.packagingDetails.productWeight || 0,
      hasFreebie,
      freebieWeight: hasFreebie ? parseFloat(variantDoc.freebies.weight || 0) : 0,
      itemName: variantDoc.name
    };
  }

  /* Product‑level packaging */
  if (productDoc?.packagingDetails?.boxId) {
    const box =
      typeof productDoc.packagingDetails.boxId === 'object'
        ? productDoc.packagingDetails.boxId
        : await PackagingBox.findById(productDoc.packagingDetails.boxId);

    return {
      box,
      productWeight: productDoc.packagingDetails.productWeight || 0,
      hasFreebie: false,
      freebieWeight: 0,
      itemName: productDoc.name
    };
  }

  throw new Error(`No packaging details found for item: ${item?._id}`);
}

/* ───────────────────────────────────────────────────────────────────────────
 * 3. GREEDY PACKER FOR A SINGLE BOX TYPE
 * ───────────────────────────────────────────────────────────────────────── */
function packItemsInSingleBoxType({ itemsForThisBox, boxDoc }) {
  const { length, breadth, height } = boxDoc.dimensions;
  const { capacity, weight: boxWeight } = boxDoc;

  const openBoxes = [];
  const createBox = () => ({
    leftoverCapacity: capacity,
    totalProductWeight: 0,
    freebieWeights: []
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

  return {
    singleBoxDimensions: { length, breadth, height },
    boxesUsed,
    totalWeight: +(
      boxesUsed * boxWeight +
      totalProductWeight +
      totalFreebieWeight
    ).toFixed(3),
    totalFreebieWeight,
    boxName: boxDoc.name
  };
}

/* ───────────────────────────────────────────────────────────────────────────
 * 4. DIMENSION & WEIGHT AGGREGATOR WITH PRIORITY MERGING
 * ───────────────────────────────────────────────────────────────────────── */
const tagsIntersect = (a = [], b = []) => a.some(t => b.includes(t));

export const getDimensionsAndWeight = async items => {
  /* Build initial groups in one pass */
  const rawGroups = {};

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
  }

  /* Sort by ascending priority (1 = highest) */
  const orderedGroups = Object.values(rawGroups).sort(
    (a, b) => (a.boxDoc.priority ?? 99) - (b.boxDoc.priority ?? 99)
  );

  /* Merge compatible lower‑priority groups into higher‑priority ones */
  const mergedGroups = [];
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
    if (mergedInto) mergedInto.items.push(...grp.items);
    else mergedGroups.push(grp);
  }

  /* Pack each final group */
  const resultsPerBoxId = {};
  let maxLength = 0,
    maxBreadth = 0,
    totalHeight = 0,
    overallWeight = 0,
    overallFreebieWeight = 0,
    overallBoxesUsed = 0;

  for (const grp of mergedGroups) {
    const result = packItemsInSingleBoxType({
      itemsForThisBox: grp.items,
      boxDoc: grp.boxDoc
    });

    resultsPerBoxId[grp.boxDoc._id.toString()] = result;

    const { length, breadth, height } = result.singleBoxDimensions;
    maxLength = Math.max(maxLength, length);
    maxBreadth = Math.max(maxBreadth, breadth);
    totalHeight += height * result.boxesUsed;

    overallWeight += result.totalWeight;
    overallFreebieWeight += result.totalFreebieWeight;
    overallBoxesUsed += result.boxesUsed;
  }

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
};
