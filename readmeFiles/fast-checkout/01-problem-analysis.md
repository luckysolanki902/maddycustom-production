# Fast Checkout: Problem Analysis

This document analyzes the current "Preparing" delay before the order form opens and defines what must change to enable instant UI with safe, background prechecks.

## Observed behavior
- Pressing "Place Order" sometimes shows a long "Preparing" state before opening the `OrderForm`.
- Inventory checks, payment mode discovery, and coupon validation likely happen synchronously during this phase.
- The cart uses an `inventoryGate` with TTL and a `lastCartSignature` to exclude unavailable items from totals (good foundation), but triggering verification near the click causes UX delay.

## Likely sources of latency (client side)
- Inventory verification API call for every cart item (or a batched endpoint) executed only when the user initiates checkout.
- Coupon validation and recalculation occurs on dialog open.
- Payment modes and configuration fetched just-in-time.
- Pincode/geo serviceability check on form open.
- Possible duplicated requests on quick cart edits.

## Requirements (from ask)
- Order form should open instantly on "Place Order" with zero perceived delay.
- Start heavy checks in the background as soon as the cart dialog/screen opens (or earlier on cart interaction) and cache for ~2 minutes.
- Do not block the initial "Place Order" button.
- Inside `OrderForm`, disable the "Next" button until core validations are complete, but those validations must already be running from prefetch so it becomes ready quickly.
- No extra fetch after "Next"; we prefetch everything needed to proceed.
- Maintain strong guarantees to avoid negative inventory and failed orders; final server-side validation remains the source of truth.

## Constraints and existing structure
- Next.js (App Router) + React/Redux.
- `cartSlice.inventoryGate` already manages excluded items with TTL and remembers `lastCartSignature`.
- `ViewCart` and `OrderForm` perform coupon and mode checks today.

## Success criteria
- P95 time-to-open `OrderForm` < 100ms (UI only; no blocking network).
- P95 time-to-enable "Next" in `OrderForm` < 600ms with warm cache, < 1500ms with cold cache.
- No increase in server-side order failures due to stock; ideally a reduction.
- No fetch storms on small cart edits (dedupe + cancellation).
- Telemetry exists to track the above.

## Core idea in one line
Shift expensive validations to a background "Checkout Prefetch Orchestrator" that starts when the cart UI is shown, caches results for 2 minutes keyed by a stable `cartSignature`, and gates only the "Next" action while keeping "Place Order" instant.

## What the current "Preparing" likely does
- Verifies inventory and excludes OOS items (aligns with `inventoryGate`).
- Validates any applied coupon against the latest cart and user context.
- Fetches payment modes and config, possibly conditioned on pincode or geo.

All of these can be done earlier and cached.

## Risks and mitigations
- Stale cache vs accuracy: With 2-min TTL, divergence risk is low; final server validation prevents negative inventory.
- Cart churn: Frequent edits can bust cache; we mitigate with a stable `cartSignature` and debounce/merge requests.
- Connectivity errors: Background failures should surface compact, retryable states but not block the dialog open.
- Privacy: Cache only non-sensitive results in localStorage with short TTL.
