// src/components/utils/getStockStatus.js
// Central utility for robust stock status logic

/**
 * Returns { outOfStock: boolean } for a product or option, considering inventoryMode and availability.
 * @param {Object} product - The product object (with .category, .inventoryData, .available, etc.)
 * @param {Object} [option] - Option object (optional)
 * @returns {{ outOfStock: boolean }}
 */
export function getStockStatus(product, option = null) {
  // 1. Check if product itself is marked as unavailable
  if (product?.available === false) {
    return { outOfStock: true };
  }

  // 2. Check if variant/category is not available
  if (product?.variantDetails?.available === false || product?.category?.available === false) {
    return { outOfStock: true };
  }

  // Defensive: always check for category and inventoryMode
  const inventoryMode = product?.category?.inventoryMode || 'on-demand';

  // 3. Print-on-demand: always in stock (if available)
  if (inventoryMode === 'on-demand') {
    return { outOfStock: false };
  }

  // 4. Inventory-based: check availableQuantity
  // Option-level inventory takes precedence if provided
  if (option && option.inventoryData && typeof option.inventoryData.availableQuantity === 'number') {
    return { outOfStock: option.inventoryData.availableQuantity <= 0 };
  }
  // Product-level inventory
  if (product.inventoryData && typeof product.inventoryData.availableQuantity === 'number') {
    return { outOfStock: product.inventoryData.availableQuantity <= 0 };
  }

  // 5. If no inventory info, fallback to not out of stock (conservative)
  return { outOfStock: false };
}
