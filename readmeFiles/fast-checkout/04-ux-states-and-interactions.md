# Fast Checkout: UX States & Interactions

## Goals
- "Place Order" opens `OrderForm` instantly with no blocking spinner.
- Only the "Next" button (to move from Contact -> Address -> Payment) is gated by readiness.
- Prefetch runs as soon as cart UI is visible; most users see "Next" enabled immediately.

## Cart Drawer/Page
- On open: start prefetch.
- Small, unobtrusive indicator (optional): "Pre-checking stock and offers…" with a subtle shimmer.
- No blocking on pressing "Place Order".

## OrderForm
- Header loads instantly.
- Section footers include a compact status chip for prefetch readiness:
  - Ready: green tick "Fast-checked".
  - Pending: grey spinner chip; "Next" disabled with a tooltip "Getting things ready…".
  - Failed: red chip with retry link (does not close dialog).
- If partial (e.g., coupon failed but inventory ready): allow Next but show inline warning that coupon will be re-evaluated at payment.

## Errors & Edge cases
- If inventory changes during prefill: show a mini sheet highlighting removed items and updated totals; keep "Next" disabled until acknowledged.
- Offline: show offline banner; allow filling form but gate "Next" until back online or until cache is present and not expired.

## Accessibility
- All status chips include `aria-live="polite"` updates.
- Disable buttons with `aria-disabled` and explicit tooltip text.

## Microcopy
- Pending: "We’re getting your order ready…"
- Ready: "Fast-checked"
- Updated: "Stock and offers refreshed"
