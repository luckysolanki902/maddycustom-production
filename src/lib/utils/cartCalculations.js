// lib/utils/cartCalculations.js

export const calculateTotalQuantity = (cartItems) =>
  cartItems.reduce((acc, item) => acc + item.quantity, 0);

export const calculateUniqueItems = (cartItems) => cartItems.length;

export const calculateTotalCostBeforeDiscount = (cartItems) =>
  cartItems.reduce((acc, item) => {
    const price = item.productDetails.price;
    return acc + price * item.quantity;
  }, 0);

export const calculateDiscountAmount = (totalCost, couponState) => {
  if (!couponState.couponApplied) return 0;
  const { discountType, couponDiscount } = couponState;
  return discountType === 'percentage'
    ? Math.floor(Math.min((totalCost * couponDiscount) / 100,couponState.offer.discountCap))
    : couponDiscount;
};

export const calculateTotalCostAfterDiscount = (totalCost, discountAmount) => {
  return totalCost - discountAmount;
}