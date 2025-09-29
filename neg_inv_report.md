# Negative Inventory Investigation Report

Last updated: 2025-09-25

This report documents where and how inventory quantities are updated, why `a- Sample a few product flows where the UI shows "in stock" for items that have `availableQuantity = 0` to confirm classification mismatch.

---

## Detailed recommendations for small ecom (1-10 stock per product, variable traffic)

### Executive Summary for Small Ecom Context

Given your constraints:
- **Low stock quantities**: 1-10 units per product
- **Variable traffic**: 0 to very high with vast differences
- **Small operation**: Need simple, reliable solutions

**Critical insight**: With such low stock levels, even 2-3 concurrent orders can cause oversells. Your current system is particularly vulnerable during traffic spikes when multiple customers might simultaneously purchase your last few items.

### Priority 1: Immediate Inventory Protection (Critical - Implement First)

#### A. Atomic Inventory Reservation at Order Creation
**Why critical for you**: With only 1-10 items, you can't afford any oversells. Reserve stock immediately when order is placed, not after payment.

**Implementation approach**:
1. **Modify `src/app/api/checkout/order/create/route.js`**:
   ```javascript
   // Add before order creation
   async function reserveInventoryForOrder(items, session) {
     for (const item of items) {
       const inventoryId = await getInventoryId(item); // option or product level
       if (inventoryId) {
         const result = await Inventory.updateOne(
           { 
             _id: inventoryId, 
             availableQuantity: { $gte: item.quantity } // Only if enough stock
           },
           { 
             $inc: { 
               availableQuantity: -item.quantity,
               reservedQuantity: item.quantity 
             }
           },
           { session }
         );
         
         if (result.modifiedCount === 0) {
           throw new Error(`Insufficient stock for ${item.productName}. Please reduce quantity.`);
         }
       }
     }
   }
   ```

2. **Benefits**:
   - Prevents oversells completely
   - Gives clear "out of stock" message to customers
   - Works even during high traffic spikes

#### B. Conditional Inventory Updates in Webhooks
**Modify `src/app/api/webhooks/razorpay/verify-payment/route.js`**:
```javascript
async function updateInventory(inventoryId, delta, session) {
  // For negative delta (deduction), ensure we don't go below zero
  if (delta < 0) {
    const result = await mongoose.model('Inventory').updateOne(
      { 
        _id: inventoryId,
        availableQuantity: { $gte: Math.abs(delta) }
      },
      { $inc: { availableQuantity: delta, reservedQuantity: -delta } },
      { session }
    );
    
    if (result.modifiedCount === 0) {
      console.error(`Cannot deduct inventory ${inventoryId}: insufficient stock`);
      // Log for investigation but don't fail the payment
    }
    return result;
  }
  
  // For positive delta (restoration), proceed normally
  return await mongoose.model('Inventory').updateOne(
    { _id: inventoryId },
    { $inc: { availableQuantity: delta, reservedQuantity: -delta } },
    { session }
  );
}
```

### Priority 2: Enhanced Stock Validation (Implement Second)

#### A. Server-Side Stock Validation
**Add to order creation process**:
```javascript
// In src/app/api/checkout/order/create/route.js
async function validateStockAvailability(cartItems) {
  const validationErrors = [];
  
  for (const item of cartItems) {
    const inventoryData = await getInventoryForItem(item);
    if (inventoryData && inventoryData.availableQuantity < item.quantity) {
      validationErrors.push({
        productId: item.productId,
        requested: item.quantity,
        available: inventoryData.availableQuantity,
        productName: item.productName
      });
    }
  }
  
  if (validationErrors.length > 0) {
    return {
      valid: false,
      errors: validationErrors,
      message: "Some items in your cart have insufficient stock. Please update quantities."
    };
  }
  
  return { valid: true };
}
```

#### B. Real-time Stock Updates for UI
**For handling traffic spikes**:
1. Add WebSocket or polling for live stock updates during checkout
2. Show "Only X left" warnings when stock is low (≤ 3 items)
3. Auto-refresh cart when stock changes during checkout process

### Priority 3: Traffic Spike Management

#### A. Rate Limiting for High Traffic
**Implement in `src/middleware.js`**:
```javascript
import { NextRequest } from 'next/server';

const rateLimitMap = new Map();

export function rateLimitMiddleware(req: NextRequest) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = req.nextUrl.pathname.includes('/api/checkout') ? 5 : 30;
  
  const requestLog = rateLimitMap.get(ip) || [];
  const recentRequests = requestLog.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return new Response('Too many requests', { status: 429 });
  }
  
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
}
```

#### B. Queue System for Checkout During High Traffic
**Simple Redis-based queue** (optional but recommended for traffic spikes):
```javascript
// Queue checkout requests during high traffic
const checkoutQueue = new Queue('checkout', {
  redis: { host: 'localhost', port: 6379 },
  defaultJobOptions: {
    removeOnComplete: 5,
    removeOnFail: 5,
  }
});

// Process checkouts sequentially during high traffic
checkoutQueue.process(async (job) => {
  const { cartItems, userDetails } = job.data;
  return await processCheckoutSequentially(cartItems, userDetails);
});
```

### Priority 4: Inventory Management System Architecture

#### Recommended Architecture for Your Scale

**Option A: Enhanced Current System (Recommended)**
- **Best for**: Your current traffic patterns and stock levels
- **Implementation**:
  1. Keep MongoDB with atomic operations
  2. Add inventory reservation at order creation
  3. Implement the conditional updates above
  4. Add stock alerts when inventory ≤ 2

**Option B: Hybrid System with Redis Cache**
- **Best for**: If traffic spikes become frequent
- **Implementation**:
  ```javascript
  // Cache frequently accessed inventory in Redis
  const inventoryCache = {
    async getStock(productId) {
      const cached = await redis.get(`stock:${productId}`);
      if (cached !== null) return parseInt(cached);
      
      const dbStock = await Inventory.findById(productId).select('availableQuantity');
      await redis.setex(`stock:${productId}`, 300, dbStock?.availableQuantity || 0); // 5 min cache
      return dbStock?.availableQuantity || 0;
    },
    
    async reserveStock(productId, quantity) {
      // Atomic reservation in Redis first, then sync to DB
      const newStock = await redis.decrby(`stock:${productId}`, quantity);
      if (newStock < 0) {
        await redis.incrby(`stock:${productId}`, quantity); // Rollback
        throw new Error('Insufficient stock');
      }
      // Sync to DB asynchronously
      syncToDatabase(productId, quantity);
    }
  };
  ```

### Priority 5: Monitoring and Alerts

#### A. Low Stock Alerts
```javascript
// Add to inventory update functions
async function checkLowStockAlert(inventoryId, newQuantity) {
  const thresholds = { critical: 1, warning: 3 };
  
  if (newQuantity <= thresholds.critical) {
    await sendAlert('CRITICAL', `Product ${inventoryId} has ${newQuantity} items left`);
  } else if (newQuantity <= thresholds.warning) {
    await sendAlert('WARNING', `Product ${inventoryId} has ${newQuantity} items left`);
  }
}
```

#### B. Oversell Detection
```javascript
// Daily script to detect and fix negatives
async function detectOversells() {
  const negativeInventory = await Inventory.find({ availableQuantity: { $lt: 0 } });
  
  if (negativeInventory.length > 0) {
    await sendAlert('OVERSELL_DETECTED', {
      count: negativeInventory.length,
      items: negativeInventory.map(inv => ({ id: inv._id, qty: inv.availableQuantity }))
    });
  }
}
```

### Implementation Timeline (Recommended Order)

**Week 1 (Critical)**:
- [ ] Implement atomic inventory reservation at order creation
- [ ] Add conditional updates in payment webhook
- [ ] Test with 2-3 concurrent orders

**Week 2 (Important)**:
- [ ] Add server-side stock validation
- [ ] Implement low stock alerts (≤ 3 items)
- [ ] Add "Only X left" UI indicators

**Week 3 (Enhancement)**:
- [ ] Add rate limiting for checkout endpoints
- [ ] Implement daily oversell detection script
- [ ] Add real-time stock updates for active checkout sessions

**Week 4 (Optimization)**:
- [ ] Add Redis caching if traffic patterns show need
- [ ] Implement checkout queue for traffic spikes
- [ ] Add comprehensive monitoring dashboard

### Configuration for Your Scale

**Inventory Thresholds**:
- Critical alert: ≤ 1 item
- Warning alert: ≤ 3 items
- Hide from catalog: = 0 items
- Show urgency: ≤ 2 items ("Only X left!")

**Rate Limits**:
- Checkout API: 5 requests/minute per IP
- Add to cart: 20 requests/minute per IP
- General browsing: 100 requests/minute per IP

**Cache TTL**:
- Stock levels: 5 minutes (balance freshness vs performance)
- Product data: 1 hour
- Category data: 6 hours

### Cost-Benefit Analysis

**Implementation costs** (developer time):
- Week 1 changes: ~20-25 hours
- Week 2-4 changes: ~30-35 hours
- Total: ~50-60 hours

**Benefits**:
- Eliminates oversells (saves customer service time, reputation)
- Handles traffic spikes gracefully
- Provides inventory visibility for business decisions
- Scales with growth

**ROI**: Even preventing 2-3 oversells per month pays for the implementation through saved customer service time and retained customers.

---

## High-level recommendations (for future fixes; no changes made now)

1) Prevent negative decrements atomically
- In `updateInventory()`, use a conditional update that only decrements if `availableQuantity >= qty`, e.g. with a filter and `$inc`, or `$expr` checks.
- Consider reserving inventory at order creation (and releasing on payment failure/cancel) to reduce oversell windows.

2) Unify classification
- Use `SpecificCategory.inventoryMode` as the single source of truth throughout (server and client). Ensure the product payload includes this in places where `getStockStatus` is used, or refactor `getStockStatus` to read from `specificCategory.inventoryMode`.
- Keep the "has `inventoryData` reference" heuristic only for splitting logistics, not for customer-facing availability decisions.

3) Server-side validation
- During order creation, verify requested quantities against authoritative `availableQuantity` and reject or adjust before creating the order.

4) Validation on `$inc`
- If `$inc` remains, add a precondition or use transactions with a read-check + guarded write, and/or a DB-side rule to clamp at zero.

5) COD flow
- Ensure COD orders also reserve or deduct inventory via a server-side path not dependent on Razorpay webhooks.ailableQuantity` can become negative, how products are classified as inventory-managed vs print-on-demand, and how we currently define “out of stock”. All findings reference concrete files/paths in this repository.

## TL;DR
- Negative `availableQuantity` is possible because inventory is decremented with an unconditional `$inc` during payment webhook processing without a guard to prevent going below zero. No reservation occurs at order creation time, so concurrent paid orders can oversell.
- Mongoose `min: 0` constraints don’t apply to `$inc` updates unless validation is explicitly enforced, which we aren’t doing on those updates.
- Frontend has client-side checks (max = availableQuantity) but server-side order creation doesn’t validate stock; deduction happens later in the Razorpay webhook.
- Classification into “inventory” vs “on-demand” is inconsistent in places:
  - For order splitting, we treat “inventory-managed” simply as “has an `inventoryData` reference`.
  - For stock status in the UI, we read `category.inventoryMode` (but `Product.category` is a string by schema; the correct source is `SpecificCategory.inventoryMode`). Some code uses heuristics like `wraps` to decide on-demand.
- “Out of stock” for inventory items is defined as `availableQuantity <= 0` at the option-level if present, else product-level.

---

## Inventory data model and constraints

- Model: `src/models/Inventory.js`
  - Fields: `availableQuantity` (Number, default 0, min 0), `reservedQuantity` (Number, default 0, min 0), `reorderLevel`, `lastAvailableQuantity`.
  - Hooks maintain `lastAvailableQuantity` on updates.
  - Important: The `min: 0` constraint is a Mongoose validation that applies on document validation (e.g., `save()` with validations). It does not automatically protect `$inc` updates in `updateOne()` unless using `runValidators` and modeling the operation accordingly.

Conclusion: Schema alone does not prevent negative values when using `$inc` via `updateOne()` without guards.

---

## Where inventory is mutated

1) Razorpay verify-payment webhook
- File: `src/app/api/webhooks/razorpay/verify-payment/route.js`
- Helper: `updateInventory(inventoryId, delta, session)` performs:
  - `$inc: { availableQuantity: delta, reservedQuantity: -delta }`
- On captured payment, code sets `unitDelta = -1` and applies `delta = unitDelta * item.quantity`:
  - availableQuantity decreases by `quantity` (delta negative)
  - reservedQuantity increases by `quantity` (-delta positive)
- There is no pre-check that `availableQuantity >= quantity` before decrementing, nor a conditional update to prevent negatives.
- Idempotency: an `ord.inventoryDeducted` flag prevents double-deduction for the same order.

Implication: Multiple orders paid concurrently can each decrement available stock even if total exceeds what’s available, causing `availableQuantity` to go negative.

2) Delivery status webhook (Shiprocket)
- File: `src/app/api/webhooks/delivery/update-status/route.js`
- For cancellations: `restoreInventory()` does `$inc: { availableQuantity: +qty, reservedQuantity: -qty }` (with a clamp to not overdraw `reservedQuantity`).
- For delivered: `clearReservedInventory()` does `$inc: { reservedQuantity: -qty }` (also clamps to avoid negative reserved).
- These adjust `reservedQuantity` carefully but do not affect the original oversell scenario; the negative `availableQuantity` originates earlier at payment-capture time.

3) No reservation at order creation
- File: `src/app/api/checkout/order/create/route.js`
- We group items by inventory presence (see classification section) and create orders, but do not decrement or reserve inventory at this stage.
- For COD orders, inventory reservation/deduction does not happen here, and COD flows won’t trigger Razorpay webhooks. Shiprocket order creation (also in the Razorpay webhook) may not run for COD orders, depending on whether that webhook is invoked. Net effect: COD reservations may be delayed or absent until other flows, increasing oversell risk.

---

## Why `availableQuantity` can become negative

- The decrement happens via `$inc` in the Razorpay webhook without constraints:
  - No guard like “only update if `availableQuantity >= qty`”.
  - No atomic reservation at order creation (pre-payment) to hold stock.
  - No validation or `runValidators` ensuring non-negativity for `$inc` ops.
- Concurrency scenario:
  1. Inventory shows `availableQuantity = 1`.
  2. Two customers place and pay for the same item at the same time.
  3. Both Razorpay webhooks run; each does `$inc: { availableQuantity: -1 }`.
  4. Final `availableQuantity = -1`.
- Evidence of dealing with fallout: scripts exist to detect and normalize negatives:
  - `scripts/debug-inventory-issues.js` logs negative quantities.
  - `scripts/fix-inventory-references.js` has `normalizeInventoryQuantities()` to zero-out negative `availableQuantity`/`reservedQuantity`.

---

## Product classification: Inventory vs Print-on-demand

There are multiple, partially overlapping mechanisms.

1) Order-splitting classification
- File: `src/lib/utils/orderSplitting.js`
- `itemHasInventory(item)` returns true iff the Option or Product referenced by the item has an `inventoryData` ObjectId.
- `groupItemsByInventory(items)` uses this to split orders into inventory and non-inventory groups.
- This is purely based on existence of an `inventoryData` reference, not on category or variant settings.

2) Frontend stock status classification
- File: `src/components/utils/getStockStatus.js`
  - Computes `inventoryMode = product?.category?.inventoryMode || 'on-demand'`.
  - If `inventoryMode === 'on-demand'`, it returns `{ outOfStock: false }` (always in stock).
  - For inventory-mode, out-of-stock is based on `availableQuantity <= 0` (option-level takes precedence over product-level).
- Note: Per `src/models/Product.js`, `product.category` is a String. The canonical flag for inventory vs on-demand lives in `src/models/SpecificCategory.js` as `inventoryMode: 'inventory' | 'on-demand'`.
- Other UI code (e.g., `src/components/full-page-comps/ProductIdPage.js`) uses a heuristic:
  - `isOnDemand` if `category?.inventoryMode === 'on-demand'` OR if `product.category.toLowerCase() === 'wraps'` OR if `product.subCategory` contains `'wrap'`.

3) Search filtering logic
- File: `src/lib/assistant/productSearch.js`
  - Uses `p.productSource === 'inventory'` to gate inventory, but `Product.productSource` is defined as `'inhouse' | 'marketplace'`. This likely doesn’t do what’s intended and is inconsistent with both (1) and (2).

Summary: We effectively have two intended sources of truth:
- Presence of `inventoryData` (used for splitting and some availability logic)
- `SpecificCategory.inventoryMode` (the domain model’s explicit flag)

In practice, some UI paths use heuristics or mismatched fields (string `category`, `productSource`) which can desynchronize behavior.

---

## Definition of “Out of Stock” (inventory-managed)

- Central utility: `src/components/utils/getStockStatus.js`
  - For inventory-mode products:
    - If an Option is being considered and it has `inventoryData.availableQuantity`, OOS = `availableQuantity <= 0`.
    - Else if Product has `inventoryData.availableQuantity`, OOS = `availableQuantity <= 0`.
    - Else fallback: not OOS.
  - For on-demand products: never OOS (always in stock).

- Other occurrences:
  - UI components like Add-to-cart compute `maxAllowed` from `inventoryData.availableQuantity` and disable increment beyond it on the client. However, if classification erroneously treats a product as on-demand, the UI will show it as in-stock even with zero availability.
  - Feeds (e.g., `src/app/api/cron/aisensy/generate-catalogue/route.js`) set `availability = 'out of stock'` when `availableQuantity <= 0`.

Note: All of the above are client/UI or catalog signals; server-side order creation does not enforce stock limits before the webhook.

---

## Concrete code paths enabling oversell

- `src/app/api/webhooks/razorpay/verify-payment/route.js`
  - `updateInventory()` uses `$inc` without a non-negative guard on `availableQuantity`.
  - Deduction happens post-payment, so multiple captured payments can oversell concurrently.

- `src/app/api/checkout/order/create/route.js`
  - Orders are created without reserving inventory. There’s no atomic decrement or reserve at checkout.

- `src/app/api/webhooks/delivery/update-status/route.js`
  - Adjusts reserved vs available post-facto for cancels/deliveries but does not prevent the initial negative.

- `src/models/Inventory.js`
  - Mongoose `min: 0` is not sufficient for `$inc` updates. No guard/validator on the `$inc` path.

---

## Secondary inconsistencies and edge cases

- UI classification may default to on-demand because it reads `product.category.inventoryMode` (object) while schema defines `category` as String. If the product object in a given UI path lacks `category.inventoryMode`, the function defaults to `'on-demand'`, thereby always returning `outOfStock: false`.
- `src/lib/assistant/productSearch.js` uses `p.productSource === 'inventory'` which doesn’t match the `Product.productSource` enum and likely never evaluates true.
- COD orders won’t trigger Razorpay webhooks; if Shiprocket order creation is also only within the Razorpay webhook, COD orders might neither reserve nor deduct inventory until later (or ever), further increasing oversell windows.

---

## Suggested verification steps (non-invasive)

- Query recent orders where `inventoryDeducted = true` and check corresponding `Inventory` documents for negatives to correlate timing with webhooks.
- Inspect logs from `scripts/debug-inventory-issues.js` and optionally run it in a read-only mode in staging to enumerate current negatives and duplicates.
- Sample a few product flows where the UI shows “in stock” for items that have `availableQuantity = 0` to confirm classification mismatch.

---

## High-level recommendations (for future fixes; no changes made now)

1) Prevent negative decrements atomically
- In `updateInventory()`, use a conditional update that only decrements if `availableQuantity >= qty`, e.g. with a filter and `$inc`, or `$expr` checks.
- Consider reserving inventory at order creation (and releasing on payment failure/cancel) to reduce oversell windows.

2) Unify classification
- Use `SpecificCategory.inventoryMode` as the single source of truth throughout (server and client). Ensure the product payload includes this in places where `getStockStatus` is used, or refactor `getStockStatus` to read from `specificCategory.inventoryMode`.
- Keep the “has `inventoryData` reference” heuristic only for splitting logistics, not for customer-facing availability decisions.

3) Server-side validation
- During order creation, verify requested quantities against authoritative `availableQuantity` and reject or adjust before creating the order.

4) Validation on `$inc`
- If `$inc` remains, add a precondition or use transactions with a read-check + guarded write, and/or a DB-side rule to clamp at zero.

5) COD flow
- Ensure COD orders also reserve or deduct inventory via a server-side path not dependent on Razorpay webhooks.

---

## File references (overview)
- Inventory model and constraints: `src/models/Inventory.js`
- Payment webhook (deduct/reserve): `src/app/api/webhooks/razorpay/verify-payment/route.js`
- Delivery webhook (restore/clear reserved): `src/app/api/webhooks/delivery/update-status/route.js`
- Order creation (no reservation): `src/app/api/checkout/order/create/route.js`
- Order splitting & inventory presence check: `src/lib/utils/orderSplitting.js`
- UI stock status utility: `src/components/utils/getStockStatus.js`
- Product detail heuristics: `src/components/full-page-comps/ProductIdPage.js`
- Search gating (inconsistent): `src/lib/assistant/productSearch.js`
- Cleanup/diagnostic scripts: `scripts/debug-inventory-issues.js`, `scripts/fix-inventory-references.js`

---

If you want, I can follow up with a precise checklist of minimal code edits to close these gaps with low risk, plus optional telemetry hooks to monitor oversell attempts in real-time.
