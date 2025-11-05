// lib/utils/orderSplitting.js

import Product from '@/models/Product';
import Option from '@/models/Option';
import shortid from 'shortid';

/**
 * Determines if an order item has inventory management
 * @param {Object} item - Order item with product and optional option
 * @returns {boolean} - True if item has inventory management
 */
export async function itemHasInventory(item) {
  try {
    // If item has an option, check option's inventoryData
    if (item.option) {
      const option = await Option.findById(item.option).select('inventoryData').lean();
      if (option && option.inventoryData) {
        return true;
      }
    }

    // Otherwise, check product's inventoryData
    const product = await Product.findById(item.product).select('inventoryData').lean();
    return !!(product && product.inventoryData);
  } catch (error) {
    console.error('Error checking inventory for item:', error);
    return false; // Default to no inventory on error
  }
}

/**
 * Groups order items based on inventory management
 * @param {Array} items - Array of order items
 * @returns {Object} - Object with inventoryItems and nonInventoryItems arrays
 */
export async function groupItemsByInventory(items) {
  const inventoryItems = [];
  const nonInventoryItems = [];

  for (const item of items) {
    const hasInventory = await itemHasInventory(item);
    if (hasInventory) {
      inventoryItems.push(item);
    } else {
      nonInventoryItems.push(item);
    }
  }

  return { inventoryItems, nonInventoryItems };
}

/**
 * Distributes payment amounts proportionally across order groups
 * @param {Array} groups - Array of item groups with their totals
 * @param {Number} totalAmount - Total amount to distribute (after all calculations)
 * @param {Number} amountDueOnline - Online amount to distribute
 * @param {Number} amountDueCod - COD amount to distribute
 * @returns {Array} - Array of payment distributions for each group
 */
export function distributePaymentAmounts(groups, totalAmount, amountDueOnline, amountDueCod) {
  if (groups.length === 0) return [];
  if (groups.length === 1) {
    return [{
      totalAmount: totalAmount,
      amountDueOnline: amountDueOnline,
      amountDueCod: amountDueCod
    }];
  }

  const distributions = [];
  const totalGroupAmount = groups.reduce((sum, group) => sum + group.groupTotal, 0);
  let distributedTotal = 0;
  let distributedOnline = 0;
  let distributedCod = 0;
  
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    
    if (i === groups.length - 1) {
      // Last group gets remaining amounts to handle rounding
      distributions.push({
        totalAmount: totalAmount - distributedTotal,
        amountDueOnline: amountDueOnline - distributedOnline,
        amountDueCod: amountDueCod - distributedCod
      });
    } else {
      const ratio = group.groupTotal / totalGroupAmount;
      const groupTotalAmount = Math.round(totalAmount * ratio);
      const groupAmountDueOnline = Math.round(amountDueOnline * ratio);
      const groupAmountDueCod = Math.round(amountDueCod * ratio);

      distributions.push({
        totalAmount: groupTotalAmount,
        amountDueOnline: groupAmountDueOnline,
        amountDueCod: groupAmountDueCod
      });

      distributedTotal += groupTotalAmount;
      distributedOnline += groupAmountDueOnline;
      distributedCod += groupAmountDueCod;
    }
  }

  return distributions;
}

/**
 * Distributes discount proportionally across groups
 * @param {Array} groups - Array of item groups with their totals
 * @param {Number} totalDiscount - Total discount to distribute
 * @returns {Array} - Array of discount amounts for each group
 */
export function distributeDiscount(groups, totalDiscount) {
  if (groups.length === 0) return [];
  if (groups.length === 1) return [totalDiscount];

  const totalGroupAmount = groups.reduce((sum, group) => sum + group.groupTotal, 0);
  const discountDistributions = [];
  let distributedDiscount = 0;

  for (let i = 0; i < groups.length; i++) {
    if (i === groups.length - 1) {
      // Last group gets remaining discount
      discountDistributions.push(totalDiscount - distributedDiscount);
    } else {
      const groupDiscount = Math.round((totalDiscount * groups[i].groupTotal) / totalGroupAmount);
      discountDistributions.push(groupDiscount);
      distributedDiscount += groupDiscount;
    }
  }

  return discountDistributions;
}

/**
 * Distributes extra charges proportionally across groups
 * @param {Array} groups - Array of item groups with their totals
 * @param {Array} extraCharges - Array of extra charges
 * @returns {Array} - Array of extra charges for each group
 */
export function distributeExtraCharges(groups, extraCharges) {
  if (groups.length === 0) return [];
  if (groups.length === 1) return [extraCharges];

  const totalGroupAmount = groups.reduce((sum, group) => sum + group.groupTotal, 0);
  const chargeDistributions = groups.map(() => []);

  for (const charge of extraCharges) {
    let distributedAmount = 0;
    
    for (let i = 0; i < groups.length; i++) {
      if (i === groups.length - 1) {
        // Last group gets remaining amount
        const remainingAmount = charge.chargesAmount - distributedAmount;
        if (remainingAmount > 0) {
          chargeDistributions[i].push({
            chargesName: charge.chargesName,
            chargesAmount: remainingAmount
          });
        }
      } else {
        const groupAmount = Math.round((charge.chargesAmount * groups[i].groupTotal) / totalGroupAmount);
        if (groupAmount > 0) {
          chargeDistributions[i].push({
            chargesName: charge.chargesName,
            chargesAmount: groupAmount
          });
          distributedAmount += groupAmount;
        }
      }
    }
  }

  return chargeDistributions;
}

/**
 * Generates a unique group ID for linked orders
 * @returns {String} - Unique group ID
 */
export function generateOrderGroupId() {
  return `GRP-${Date.now()}-${shortid.generate()}`;
}

/**
 * Creates order data objects for split orders
 * @param {Object} originalOrderData - Original order data
 * @param {Array} itemGroups - Array of item groups
 * @param {String} orderGroupId - Group ID for linking orders
 * @returns {Array} - Array of order data objects
 */
export function createSplitOrdersData(originalOrderData, itemGroups, orderGroupId) {
  const orders = [];
  
  // Calculate subtotals for each group (before discount and extra charges)
  // Items in itemGroups are already in the transformed format (from baseOrderData.items)
  const groups = itemGroups.map(group => ({
    groupTotal: group.items.reduce((sum, item) => sum + (item.priceAtPurchase * item.quantity), 0),
    items: group.items
  }));

  // Use the FINAL total amount (after discount and extra charges) from originalOrderData
  const finalTotalAmount = originalOrderData.totalAmount;
  const finalAmountDueOnline = originalOrderData.paymentDetails.amountDueOnline;
  const finalAmountDueCod = originalOrderData.paymentDetails.amountDueCod;

  console.log('🔍 Order Splitting Debug:', {
    originalTotal: finalTotalAmount,
    originalDiscount: originalOrderData.totalDiscount,
    groups: groups.map(g => ({ groupTotal: g.groupTotal, itemCount: g.items.length })),
    totalGroupsSubtotal: groups.reduce((sum, g) => sum + g.groupTotal, 0)
  });

  const paymentDistributions = distributePaymentAmounts(groups, finalTotalAmount, finalAmountDueOnline, finalAmountDueCod);
  const discountDistributions = distributeDiscount(groups, originalOrderData.totalDiscount);
  const chargeDistributions = distributeExtraCharges(groups, originalOrderData.extraCharges);

  console.log('🔍 Distribution Results:', {
    paymentDistributions,
    discountDistributions,
    chargeDistributions
  });

  for (let i = 0; i < itemGroups.length; i++) {
    const group = itemGroups[i];
    const paymentDist = paymentDistributions[i];
    const discount = discountDistributions[i];
    const charges = chargeDistributions[i];

    const orderData = {
      ...originalOrderData,
      items: group.items,
      totalAmount: paymentDist.totalAmount,
      totalDiscount: discount,
      extraCharges: charges,
      paymentDetails: {
        ...originalOrderData.paymentDetails,
        amountDueOnline: paymentDist.amountDueOnline,
        amountDueCod: paymentDist.amountDueCod,
      },
      orderGroupId: orderGroupId,
      isMainOrder: i === 0, // First order is main order for payment redirection
      linkedOrderIds: [], // Will be populated after all orders are created
    };

    orders.push(orderData);
  }

  return orders;
}
