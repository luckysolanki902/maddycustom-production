# Multi-Order Splitting & Grouped Payments

This document explains the new grouped order architecture enabling a single checkout to produce multiple physical Orders (e.g. inventory vs non-inventory) while preserving unified payment and proportional financial allocations.

## Overview
A single logical cart can now be partitioned into N order partitions. Each partition produces an `Order` document sharing a common `groupId`. One primary order holds the Razorpay order reference for the entire online payable portion. Amounts, discounts, and charges are allocated proportionally and deterministically across partitions.

## New Schema Fields (Order)
- `groupId` : ObjectId linking siblings.
- `partitionKey` : Classifier label (e.g. `inventory`, `nonInventory`).
- `isGroupPrimary` : Primary order in group (only one true).
- `linkedOrders` : Denormalized sibling ids.
- `parentPaymentOrder` : Reference to primary from non-primary orders.
- `groupPaymentLocked` : Idempotency for payment distribution.
- `groupAllocation` : Per-order allocation snapshot.
- `originalGroupSnapshot` : Stored only on primary; enables future recalculation on cancellation.

## Partitioning Logic
Defined in `src/lib/utils/orderPartitioning.js`:
- `partitionCartItems` uses ordered classifiers. Default classifier splits by inventory presence (`product.inventoryData` or `option.inventoryData`).
- Extend by adding classifier objects `{ key, test(item) }`.

## Financial Allocation
1. Compute global subtotal, discount, extra charges.
2. Allocate discount & charges proportionally with `proportionalAllocate` (fair rounding).
3. Final per-partition total = (subtotal - discountShare) + chargesShare.
4. Online percentage is applied to total group final; partition online shares allocated proportionally.
5. COD portion = final - online portion.

All intermediate results stored in each order's `groupAllocation`.

## Payment Flow
1. Primary creates a single Razorpay order for total online amount of the group.
2. After capture (webhook) or client verify route:
   - Distribute online paid amount across all sibling orders.
   - Update each order's `paymentStatus` (allPaid or paidPartially).
   - Set `groupPaymentLocked` to prevent duplicate distribution.
3. Coupon usage increments only once (primary).

Partial captures proportionally reduce each order's `amountDueOnline` based on their remaining share.

## Inventory & Shiprocket
Inventory deduction remains per order (idempotent) once status reaches `paidPartially` or `allPaid`.
Shiprocket creation unchanged but executes per order individually.

## Tracking & UI
- `/api/order/track` now includes a `group` object if the order belongs to a group:
```
{
  group: {
    groupId,
    orders: [{ _id, partitionKey, paymentStatus, deliveryStatus, shiprocketOrderId, ... }],
    aggregate: { total, dueCod, dueOnline }
  }
}
```
- `TrackPage` displays grouped summary section and list of partitions.

## Adding Future Partitions
Add classifier entries in `DEFAULT_CLASSIFIERS` (order matters). No backend structural changes required.

## Cancellation (Future Work)
Not yet implemented. Primary snapshot (`originalGroupSnapshot`) allows future recalculation after removing a partition. A future hook would recompute discounts and issue adjustments.

## Idempotency Safeguards
- `groupPaymentLocked` prevents double application of payment distribution.
- Webhook + verify route both safe to run in any order.

## Rounding Guarantees
`proportionalAllocate` guarantees allocations sum to intended total by assigning leftover units to largest fractional remainders.

## Touchpoints Modified
- `models/Order.js`
- `api/checkout/order/create/route.js`
- `api/checkout/order/payment/verify/route.js`
- `api/webhooks/razorpay/verify-payment/route.js`
- `api/order/track/route.js`
- `components/full-page-comps/TrackPage.js`
- `lib/utils/orderPartitioning.js` (new)

## Testing Recommendations
| Scenario | Expectation |
|----------|-------------|
| Single partition | Behavior unchanged, no group fields set. |
| Two partitions 30% online | Razorpay order for 30% of combined, allocated per order. |
| COD only | No Razorpay order, each order `allToBePaidCod`, online portions 0. |
| Partial capture (simulate) | Proportional reduction; remaining amounts persist. |
| Webhook replay | No double increment / distribution due to `groupPaymentLocked`. |

## Migration
No migration required; legacy orders simply have null `groupId` and default grouping fields.

## Error Handling
- On Razorpay creation failure for group: all group orders marked `failed`.
- Allocation functions guard zero totals / weights.

## Extending Discount Logic
Currently still trusts client discount after validation. A follow-up should port robust server-side offer evaluation (mirroring `/api/checkout/coupons/apply`) inside order creation for tamper-proofing.

---
For any further enhancements (cancellation adjustments, per-partition shipping strategies, progressive payment), this architecture isolates concerns cleanly.
