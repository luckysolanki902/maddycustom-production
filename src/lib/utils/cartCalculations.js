// lib/utils/cartCalculations.js

export const calculateTotalQuantity = (cartItems) =>
  cartItems.reduce((acc, item) => acc + item.quantity, 0);

export const calculateUniqueItems = (cartItems) => cartItems.length;

export const calculateTotalCostBeforeDiscount = (cartItems) =>
  cartItems.reduce((acc, item) => {
    const price = item.productDetails.price;
    return acc + price * item.quantity;
  }, 0);

export const calcluateTotalMrp = (cartItems) =>
  cartItems.reduce((acc, item) => {
    const MRP = item.productDetails.MRP;
    return acc + MRP * item.quantity;
  }, 0);

export const calculateDiscountAmount = (totalCost, couponState) => {
  if (!couponState.couponApplied) return 0;
  const { discountType, couponDiscount, isDbCoupon, offer } = couponState;
  return Math.floor(couponDiscount);
};

export const calculateTotalCostAfterDiscount = (totalCost, discountAmount) => {
  return totalCost - discountAmount;
};

// Helper: Get count of items in cart by product id
const getCartItemCount = (cartItems, productId) => {
  const item = cartItems.find((i) => i.productDetails._id === productId);
  return item ? item.quantity : 0;
};

// Helper: Get price of a product in cart
const getCartItemPrice = (cartItems, productId) => {
  const item = cartItems.find((i) => i.productDetails._id === productId);
  return item ? item.productDetails.price : 0;
};

// Helper: Get count of items in cart by scope (product or category)
const getCartItemCountByScope = (cartItems, scope, scopeValue) => {
  if (scope === 'product') {
    return cartItems.filter(i => scopeValue.includes(i.productDetails._id)).reduce((a, b) => a + b.quantity, 0);
  } else if (scope === 'category') {
    // Use specificCategory (ObjectId) for category scope
    return cartItems.filter(i => scopeValue.map(String).includes(String(i.productDetails.specificCategory))).reduce((a, b) => a + b.quantity, 0);
  }
  return 0;
};

// Helper: Get price of items in cart by scope (product or category)
const getCartItemUnitPriceByScope = (cartItems, scope, scopeValue) => {
  if (scope === 'product') {
    const item = cartItems.find(i => scopeValue.includes(i.productDetails._id));
    return item ? item.productDetails.price : 0;
  } else if (scope === 'category') {
    // Use specificCategory (ObjectId) for category scope
    const items = cartItems.filter(i => scopeValue.map(String).includes(String(i.productDetails.specificCategory)));
    return items.length > 0 ? items[0].productDetails.price : 0;
  }
  return 0;
};

export function calculateBundleDiscount(cartItems, offer) {
  if (!offer || !offer.actions || !offer.actions.length) return 0;
  const action = offer.actions[0];
  if (action.type !== 'bundle') return 0;
  const bundleComponents = action.bundleComponents || action.bundleItems || [];
  const bundlePrice = action.bundlePrice;
  if (!bundleComponents.length || !bundlePrice) return 0;
  // Find how many full bundles can be made from cart
  let minBundles = Infinity;
  for (const comp of bundleComponents) {
    const countInCart = getCartItemCountByScope(cartItems, comp.scope, comp.scopeValue);
    const possibleBundles = Math.floor(countInCart / comp.quantity);
    minBundles = Math.min(minBundles, possibleBundles);
  }
  if (minBundles === 0 || minBundles === Infinity) return 0;
  // Calculate normal price for bundle items
  let normalPrice = 0;
  for (const comp of bundleComponents) {
    const unitPrice = getCartItemUnitPriceByScope(cartItems, comp.scope, comp.scopeValue);
    normalPrice += unitPrice * comp.quantity;
  }
  const totalNormalPrice = normalPrice * minBundles;
  const totalBundlePrice = bundlePrice * minBundles;
  const discount = totalNormalPrice - totalBundlePrice;
  return discount > 0 ? discount : 0;
}