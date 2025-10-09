# Fast Checkout: Architecture & Flow

## Components
- Checkout Prefetch Orchestrator (CPO): coordinates background fetches and caching.
- Cart Signature Generator: creates a stable hash of cart items (productId, optionId, quantity) + coupon code.
- Local Cache Layer: localStorage with 2-min TTL, namespaced by signature.
- Redux Bridge: minimal state to reflect readiness and errors; aligns with `cartSlice.inventoryGate`.
- UI Gates: enable instant dialog open; disable only `Next` until ready.

## Data fetched in parallel
- Inventory verification (batched) -> produces `excludedKeys`, `itemsInfo`, `expiresAt`.
- Coupon validation -> normalized coupon result (validity, discount, reason).
- Payment modes/config -> preferred/default mode, COD/split constraints, extra charges.
- Serviceability (pincode/geo) -> estimated delivery, carrier constraints.

## Sequence (cold cache)
1. User opens Cart drawer/page.
2. CPO starts immediately (debounced ~100–200ms) and computes `cartSignature`.
3. In parallel, CPO calls inventory, coupon validation, payment modes, and serviceability.
4. Results are normalized and written to localStorage under the signature with `expiresAt = now + 120s`.
5. Redux bridge updates `status=ready` and references `signature`.
6. User presses "Place Order" -> `OrderForm` opens instantly.
7. Inside form, `Next` checks CPO status; if ready, button enables; if still pending, shows inline spinner and enables within target SLA.

## Sequence (warm cache)
- Steps 2–5 read from localStorage if `expiresAt > now` and signature matches. CPO may refresh in the background but UI is instantly ready.

## State machine (CPO)
- idle -> pending (start requests)
- pending -> ready (all required results present) | partial (some success, others retrying) | failed (retry with backoff)
- ready -> refreshing (optional background refresh) -> ready

## Dedupe & cancellation
- In-flight calls keyed by signature and endpoint; newer signature cancels old (or marks it orphaned).
- Prevents storms during quick cart edits.

## Negative inventory prevention
- Client: precheck stock and exclude items via `inventoryGate` for UI totals.
- Server: final order submission performs atomic stock check and fail-fast if stock changed; consider short-lived stock reservations on pay intent to reduce race.

## Idempotency & safety
- Final submission uses idempotency keys (order creation + payment intent) to avoid double charges.
- CPO results are advisory; server remains authority.

## Feature flag & fallback
- Gate via `fastCheckoutPrefetch` flag.
- If disabled or errors occur, fall back to current behavior.
