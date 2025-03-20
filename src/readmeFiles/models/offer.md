```markdown
# Offer Schema Documentation and Implementation Guide

This document provides a comprehensive overview of the Offer (Promotion) schema designed for an e-commerce platform. The schema is built using MongoDB and Mongoose and is intended to support a wide variety of promotions including automatic MRP discounts, coupon-based offers, cart-level discounts, BOGO deals, combo offers, free items, first-order or loyalty-based promotions, and more.

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Detailed Explanation of Schema Fields](#detailed-explanation-of-schema-fields)
   - [Basic Offer Information](#basic-offer-information)
   - [Validity & Activation](#validity--activation)
   - [Coupon vs. Auto-Apply](#coupon-vs-auto-apply)
   - [Conditions](#conditions)
   - [Actions](#actions)
   - [Applicability Fields](#applicability-fields)
   - [Stacking & Priority](#stacking--priority)
   - [Usage Limits](#usage-limits)
   - [Special Flags](#special-flags)
3. [Creating & Managing Offers](#creating--managing-offers)
   - [Creating an Auto-Applied Offer](#creating-an-auto-applied-offer)
   - [Creating a Coupon-Based Offer](#creating-a-coupon-based-offer)
4. [Evaluating & Applying Offers – Algorithm Overview](#evaluating--applying-offers--algorithm-overview)
   - [Step 1: Fetch Relevant Offers](#step-1-fetch-relevant-offers)
   - [Step 2: Check Conditions](#step-2-check-conditions)
   - [Step 3: Check Applicability Fields](#step-3-check-applicability-fields)
   - [Step 4: Determine the Actions to Apply](#step-4-determine-the-actions-to-apply)
   - [Step 5: Handling Multiple Offers (Stacking & Priority)](#step-5-handling-multiple-offers-stacking--priority)
   - [Step 6: Update Usage Counts](#step-6-update-usage-counts)
5. [Examples of Common Promotions](#examples-of-common-promotions)
6. [Performance & Implementation Tips](#performance--implementation-tips)
7. [Conclusion](#conclusion)

---

## Schema Overview

The Offer schema is designed to store all the necessary information to create and evaluate promotions on your e-commerce platform. It is highly modular, consisting of several key parts:

- **Basic Offer Information:** Name, description, display options, and marketing captions.
- **Validity & Activation:** Fields to control when an offer is valid and whether it is active.
- **Coupon vs. Auto-Apply:** Offers can be triggered either by a coupon code or automatically if conditions are met.
- **Conditions:** An array of rules that determine *when* the offer applies.
- **Actions:** An array of actions that define *what benefits* (discounts, freebies, etc.) are provided when an offer is applied.
- **Applicability Fields:** Quick reference arrays for including or excluding specific products, categories, or variants.
- **Stacking & Priority:** Fields to control the order and combination of multiple offers.
- **Usage Limits:** To restrict how many times an offer can be redeemed overall or per user.
- **Special Flags:** For first-order promotions or loyalty-based discounts.

---

## Detailed Explanation of Schema Fields

### Basic Offer Information

- **`name`**:  
  - *Type*: String  
  - *Description*: A short name or title for the offer.  
  - *Example*: `"Diwali Special 10% Off"`

- **`description`**:  
  - *Type*: String  
  - *Description*: Detailed marketing or explanatory text about the offer.

- **`showAsCard`**:  
  - *Type*: Boolean  
  - *Description*: When set to true, the offer can be displayed as an “offer card” in the UI.

- **`captions`**:  
  - *Type*: Array of Strings  
  - *Description*: Short marketing texts or highlights to be shown alongside the offer.

### Validity & Activation

- **`isActive`**:  
  - *Type*: Boolean  
  - *Description*: Determines if the offer is currently active. If false, the offer is not applied regardless of other fields.

- **`validFrom` & `validUntil`**:  
  - *Type*: Date  
  - *Description*: Define the time window during which the offer is valid. The current date must fall between these dates for the offer to be applied.  
  - *Validation*: `validUntil` must be after `validFrom`.

### Coupon vs. Auto-Apply

- **`couponCodes`**:  
  - *Type*: Array of Strings  
  - *Description*: Contains coupon codes that users must enter at checkout to redeem the offer.  
  - *Note*: If this array is empty, the offer is typically auto-applied.

- **`autoApply`**:  
  - *Type*: Boolean  
  - *Description*: When true, the system will attempt to automatically apply the offer if the conditions are met, without requiring a coupon code.

### Conditions

The `conditions` array is a list of rules that determine when an offer applies. Each condition has the following structure:

- **`conditionType`**:  
  - *Type*: String  
  - *Description*: Defines the type of condition.  
  - *Possible Values*:  
    - `cart_value` (total cart price)  
    - `item_count` (number of items in the cart)  
    - `product_in` (a list of product IDs that must be present)  
    - `product_not_in` (a list of product IDs that must not be present)  
    - `category_in` (requires items from specific categories)  
    - `category_not_in`  
    - `variant_in` / `variant_not_in`  
    - `first_order` (checks if it is the user’s first order)  
    - `loyalty_level` (checks user’s loyalty level)

- **`operator`**:  
  - *Type*: String  
  - *Description*: The comparison operator used in conjunction with `value`.  
  - *Possible Values*: `>=`, `<=`, `==`, `!=`, `>`, `<`, `in`, `not_in`

- **`value`**:  
  - *Type*: Mixed (Number, Boolean, or Array)  
  - *Description*: The value against which the cart or user data is compared.  
  - *Example*: For `cart_value >= 500`, the value is `500`.

- **`message`** (optional):  
  - *Type*: String  
  - *Description*: A custom message that can be displayed if the condition is not met.

### Actions

The `actions` array defines what happens when the conditions are met. Each action includes:

- **`actionType`**:  
  - *Type*: String  
  - *Description*: Specifies the type of discount or reward.  
  - *Possible Values*:  
    - `discount_percent` (e.g., 10% off)  
    - `discount_fixed` (e.g., ₹300 off)  
    - `bogo` (Buy One, Get One free, or similar)  
    - `free_item` (add a free item)  
    - `set_special_price` (override the price with a special price)  
    - `combo_deal` (apply a combo or bundled discount)

- **`discountValue`**:  
  - *Type*: Number  
  - *Description*: Used for `discount_percent` or `discount_fixed` actions.

- **`newPrice`**:  
  - *Type*: Number  
  - *Description*: For `set_special_price` actions, the new price to apply.

- **`buyQuantity` & `getQuantity`**:  
  - *Type*: Number  
  - *Description*: For BOGO or combo offers, specify the quantity required to buy and the quantity given free.

- **`scope`**:  
  - *Type*: String  
  - *Description*: Determines if the action is limited to a particular scope such as `product`, `category`, or `variant`.

- **`scopeValue`**:  
  - *Type*: Array of ObjectIds  
  - *Description*: List of IDs corresponding to the `scope` (e.g., specific product IDs).

- **`freeProductId` & `freeQuantity`**:  
  - *Type*: ObjectId and Number  
  - *Description*: For `free_item` actions, specify which product is free and in what quantity.

- **`comboDetails`**:  
  - *Type*: Mixed  
  - *Description*: For complex combo deals, this field can store additional data to define the combo logic.

### Applicability Fields

These fields allow for quick whitelisting or blacklisting of certain products, categories, or variants:

- **`applicableProducts`** & **`excludedProducts`**:  
  - *Type*: Array of ObjectIds  
  - *Description*: Lists of products that are either explicitly included or excluded from the offer.

- **`applicableCategories`** & **`excludedCategories`**:  
  - *Type*: Array of Strings (or ObjectIds if referencing a Category model)  
  - *Description*: Specifies categories that are either eligible or ineligible for the offer.

- **`applicableVariants`** & **`excludedVariants`**:  
  - *Type*: Array of ObjectIds  
  - *Description*: Specifies variants that are eligible or not eligible for the offer.

### Stacking & Priority

- **`priority`**:  
  - *Type*: Number  
  - *Description*: Determines the order in which offers are evaluated. Higher priority offers can override or be applied before lower priority ones.

- **`allowStacking`**:  
  - *Type*: Boolean  
  - *Description*: Indicates whether this offer can be combined (stacked) with other offers.

### Usage Limits

- **`usageLimitPerUser`**:  
  - *Type*: Number  
  - *Description*: Maximum number of times a single user can redeem this offer. A value of `0` indicates no limit.

- **`usageLimitOverall`**:  
  - *Type*: Number  
  - *Description*: Total number of times the offer can be redeemed across all users. A value of `0` indicates no limit.

- **`usedCount`**:  
  - *Type*: Number  
  - *Description*: Tracks the total number of times the offer has been used. This is incremented each time the offer is successfully applied.

### Special Flags

- **`onlyFirstOrder`**:  
  - *Type*: Boolean  
  - *Description*: If true, the offer applies only to the user’s first order.

- **`minUserLoyaltyPoints`**:  
  - *Type*: Number  
  - *Description*: Specifies the minimum number of loyalty points a user must have for the offer to be applicable.

---

## Creating & Managing Offers

### Creating an Auto-Applied Offer

For example, to create a Diwali sale offer that automatically applies a 10% discount on orders of ₹999 or more:

```js
await Offer.create({
  name: "Diwali Special 10% Off",
  description: "Grab a 10% discount on orders above ₹999 during Diwali!",
  isActive: true,
  validFrom: new Date("2025-10-15T00:00:00Z"),
  validUntil: new Date("2025-11-01T23:59:59Z"),
  autoApply: true,
  conditions: [
    {
      conditionType: "cart_value",
      operator: ">=",
      value: 999
    }
  ],
  actions: [
    {
      actionType: "discount_percent",
      discountValue: 10
    }
  ],
  priority: 5,
  allowStacking: false
});
```

### Creating a Coupon-Based Offer

For a coupon code offer (e.g., “FESTIVE500” for ₹500 off on orders above ₹2000):

```js
await Offer.create({
  name: "FESTIVE500 Coupon",
  description: "Use code FESTIVE500 at checkout to get ₹500 off orders above ₹2000.",
  isActive: true,
  validFrom: new Date("2025-10-15T00:00:00Z"),
  validUntil: new Date("2025-11-01T23:59:59Z"),
  couponCodes: ["FESTIVE500"],
  autoApply: false,
  conditions: [
    {
      conditionType: "cart_value",
      operator: ">=",
      value: 2000
    }
  ],
  actions: [
    {
      actionType: "discount_fixed",
      discountValue: 500
    }
  ],
  usageLimitPerUser: 2,
  allowStacking: false
});
```

---

## Evaluating & Applying Offers – Algorithm Overview

### Step 1: Fetch Relevant Offers

- **Query** for offers where:
  - `isActive` is true.
  - The current date falls between `validFrom` and `validUntil`.
  - If a coupon code is entered, filter for offers with matching `couponCodes`; otherwise, consider offers with `autoApply = true`.
- **Filter by Usage Limits**:
  - Ensure `usedCount` is less than `usageLimitOverall` (if a limit is set).
  - Confirm that the user’s usage for this offer is below `usageLimitPerUser`.

### Step 2: Check Conditions

For each candidate offer, evaluate every condition:

- **Cart-Based Conditions**:
  - E.g., if `conditionType` is `cart_value`, verify that `cart.total >= value`.
- **Product or Category-Based Conditions**:
  - For `product_in`, ensure the cart contains one of the listed product IDs.
- **User-Specific Conditions**:
  - E.g., if `conditionType` is `first_order`, confirm this is the user’s first order.
  - If `conditionType` is `loyalty_level`, check if the user's loyalty level meets the requirement.
- If any condition fails, the offer is not applicable.

### Step 3: Check Applicability Fields

- **Direct Scoping**:
  - If `applicableProducts` is defined, ensure that the cart contains at least one of these products.
  - If `excludedProducts` is defined, verify that none of these products are present in the cart.
- Similar checks apply for `applicableCategories` and `applicableVariants`.

### Step 4: Determine the Actions to Apply

If an offer passes all conditions:

- **Discount Actions**:
  - For `discount_percent`, calculate a percentage discount.
  - For `discount_fixed`, subtract a fixed amount.
- **BOGO / Combo Actions**:
  - Evaluate `buyQuantity` and `getQuantity` based on the scope and the quantity of items in the cart.
- **Free Item**:
  - Add the specified free product (from `freeProductId`) in the defined quantity.
- **Special Price**:
  - Override the item’s price with `newPrice` if applicable.
- The logic may vary depending on whether the discount applies to individual items or the entire cart.

### Step 5: Handling Multiple Offers (Stacking & Priority)

- **Sort Offers**:
  - Sort the valid offers by `priority` (higher first) or another defined metric.
- **Stacking Rules**:
  - If an offer has `allowStacking` set to false, you may choose to apply only that offer.
  - If stacking is allowed, decide whether discounts should be combined or if the best discount should be selected.
- **Resolve Conflicts**:
  - Ensure that the same cart item is not discounted multiple times unless explicitly allowed.

### Step 6: Update Usage Counts

After successful order placement:

- Increment the offer's `usedCount`.
- Update the user’s redemption count for that offer to enforce `usageLimitPerUser`.

---

## Examples of Common Promotions

1. **Auto MRP Discount on Specific Products**  
   - **Setup**:  
     - `autoApply = true`
     - Conditions using `product_in` or via `applicableProducts`
     - Action: `{ actionType: 'discount_fixed', discountValue: 200 }`
   - **Effect**: Shows a ₹200 discount on specified products.

2. **Buy One, Get One (BOGO)**  
   - **Setup**:  
     - Conditions may be minimal.
     - Action: `{ actionType: 'bogo', buyQuantity: 1, getQuantity: 1, scope: 'product', scopeValue: [PRODUCT_ID] }`
   - **Effect**: When the cart contains one qualifying product, one additional product is given free (or discounted).

3. **Category-Level Combo Offer**  
   - **Setup**:  
     - Conditions: Check if the cart contains items from a specific category (e.g., "Wraps") and meets a quantity threshold.
     - Action: `{ actionType: 'discount_percent', discountValue: 10, scope: 'category', scopeValue: [CATEGORY_IDENTIFIER] }`
   - **Effect**: Applies a 10% discount to items in the specified category.

4. **First-Order Discount**  
   - **Setup**:  
     - Use `onlyFirstOrder = true` or add a condition: `{ conditionType: 'first_order', operator: '==', value: true }`
     - Action: E.g., a percentage or fixed discount.
   - **Effect**: The offer applies only to the user's first purchase.

5. **Coupon for Loyalty Customers**  
   - **Setup**:  
     - Define `couponCodes` (e.g., `["LOYAL5"]`)
     - Condition: `{ conditionType: 'loyalty_level', operator: '>=', value: 5 }`
     - Action: Can include discounts or free items.
   - **Effect**: Only users with a loyalty level of 5 or above can redeem this coupon.

---

## Performance & Implementation Tips

1. **Indexing**:
   - Ensure fields like `isActive`, `priority`, and `couponCodes` are indexed to improve query performance.
2. **Pre-Filtering**:
   - Use the applicability fields (`applicableProducts`, `applicableCategories`, etc.) for early filtering of offers that cannot possibly apply.
3. **Concurrency**:
   - Handle concurrency carefully when updating `usedCount` to prevent over-redemption.
4. **Testing**:
   - Build a robust test suite to cover all edge cases including overlapping offers, stacking scenarios, and usage limit enforcement.
5. **Admin UI**:
   - Develop a user-friendly admin interface to allow non-technical staff to create and manage offers by populating conditions and actions using intuitive forms.

---

## Conclusion

The Offer schema outlined in this document provides a unified, flexible approach to managing promotions across an e-commerce platform. By separating **conditions** (defining when an offer applies) from **actions** (defining what discount or benefit is given), the schema supports a wide range of promotional scenarios similar to those seen on major e-commerce sites.

Implementing the evaluation logic involves:
- Fetching active and valid offers,
- Checking detailed conditions and applicability,
- Determining applicable actions based on priority and stacking rules, and
- Finally updating usage counts to enforce limits.

This system is designed to be scalable, maintainable, and highly adaptable to evolving business requirements.

Happy coding and best of luck with your e-commerce promotions!
```