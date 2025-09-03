// src/components/utils/getStockStatus.js
// Central utility for robust stock status logic

/**
 * Returns { outOfStock: boolean } for a product or option, considering inventoryMode.
 * @param {Object} product - The product object (with .category, .inventoryData, .options, etc.)
 * @param {Object} [option] - Option object (optional)
 * @returns {{ outOfStock: boolean }}
 */
export function getStockStatus(product, option = null) {
  // Defensive: always check for category and inventoryMode
  const inventoryMode = product?.category?.inventoryMode || 'on-demand';

  // 1. Print-on-demand: always in stock
  if (inventoryMode === 'on-demand') {
    return { outOfStock: false };
  }

  // 2. Inventory-based: check availableQuantity
  // Option-level inventory takes precedence if provided
  if (option && option.inventoryData && typeof option.inventoryData.availableQuantity === 'number') {
    return { outOfStock: option.inventoryData.availableQuantity <= 0 };
  }
  // Product-level inventory
  if (product.inventoryData && typeof product.inventoryData.availableQuantity === 'number') {
    return { outOfStock: product.inventoryData.availableQuantity <= 0 };
  }

  // 3. If no inventory info, fallback to not out of stock (conservative)
  return { outOfStock: false };
}
