# Fast Checkout: Open Questions / Decisions

- Inventory API: can we batch-check by `{ productId, optionId, quantity }` with a single call? Current UI suggests yes but confirm contract.
- Reservation: do we want a short-lived stock reservation on payment intent to minimize race? If so, API changes needed.
- Coupon policy: should we soft-apply coupon in UI even if validation is pending, or always wait for validation to enable discounts?
- Payment modes: are modes conditioned on pincode or user tier? Ensure prefetch uses enough context.
- Serviceability: do we need early pincode capture? We currently validate pincode in `OrderForm`—prefetch can run with last known pincode or user profile.
- TTL length: default 120s; acceptable window? Any SKUs with very volatile stock require lower TTL?
- Signature scope: include price/version for SKUs that can change offer eligibility?
- Error UX: when partial, what minimum is acceptable to enable Next? Proposal: inventory + payment ready, coupon optional.
- Dedup: unify with existing request managers (e.g., variants) vs build a scoped one for checkout.
- Persistence: localStorage is fine; any SSR constraints for App Router pages?
