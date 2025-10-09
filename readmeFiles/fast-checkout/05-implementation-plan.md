# Fast Checkout: Implementation Plan (No Code Yet)

> This is a step-by-step plan. We will implement only after review.

## 0) Guardrails
- Add feature flag `fastCheckoutPrefetch` (env + Redux).
- Ship behind flag and enable for small traffic first.

## 1) Utilities
- `cartSignature.ts`: stable sort + JSON + hash.
- `prefetchCache.ts`: read/write localStorage, TTL 120s, versioned schema.
- `dedupe.ts`: in-flight map + abort controllers per signature+endpoint.

## 2) Redux slice
- New `checkoutPrefetch` slice with minimal state: `status`, `signature`, `lastUpdated`, `errors`.
- Actions: `start`, `partial`, `ready`, `failed`, `refreshing`, `reset`.

## 3) Orchestrator
- Hook or service `useCheckoutPrefetch({ trigger, couponCode })` that:
  - Computes `signature` from Redux `cart.items`.
  - If cache warm -> dispatch `ready` + optionally refresh in background.
  - Else -> fire parallel requests: inventory, coupon, payment modes, serviceability.
  - On success -> write cache; dispatch `setInventoryGate` with aligned TTL; then `ready`.
  - On error -> `partial` or `failed` with reasons; expose retry.

## 4) Integration points
- `ViewCart`/Cart drawer: `useCheckoutPrefetch` on open (debounced); do NOT block UI.
- `OrderForm`:
  - Read `checkoutPrefetch.status` and `signature`.
  - Disable only "Next" until `status === 'ready'` or `partial` with acceptable minimums (inventory+payment ready).
  - Do not trigger new fetch on Next; only use cached data.

## 5) Server alignment
- Inventory endpoint supports batched check; returns excluded keys + reasons.
- Final order submission performs atomic stock validation and coupon recheck to avoid negative inventory; return actionable errors if mismatch.
- Optional: short-lived stock reservation on payment intent creation (nice-to-have).

## 6) Telemetry
- Emit: `cpo_start`, `cpo_ready`, `cpo_partial`, `cpo_failed`, with `signature`, durations, and error tags.
- Track UI timings: time-to-open, time-to-enable-next.

## 7) Tests
- Unit: signature generation, cache read/write/invalidation, orchestrator state machine.
- Integration: cold cache, warm cache, cart change, offline, error recovery.

## 8) Rollout
- Flag -> 5% -> 25% -> 100%.
- Watch error rates and TTI metrics.

## 9) Cleanup
- Remove legacy synchronous "Preparing" path; keep OOS dialog path intact but sourced from inventoryGate set by CPO.
