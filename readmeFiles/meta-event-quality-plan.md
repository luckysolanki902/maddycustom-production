# Meta Event Tracking Improvement Plan

_Last updated: 2025-10-17_

## Context
- Events in Meta Events Manager report low coverage and deduplication (PageView ~34%, InitiateCheckout ~39%).
- Screenshots show: high server coverage but lower browser dedupe keys (eventID, fbp) leading to undercounted conversions and warnings about 355 missing events.
- Goal: reach ≥75% coverage and robust deduplication per [Meta CAPI best practices](https://developers.facebook.com/docs/marketing-api/conversions-api/best-practices) and [deduplication guide](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/).

## Root Causes (hypothesis)
- Browser events lack stable `eventID` / hashed identifiers leading to failed pairing with CAPI payloads.
- `fbp`/`fbc` not consistently attached to server-side events.
- `InitiateCheckout` triggered only server-side, missing matching pixel call.
- Pre-hashing mismatches (server hashing twice) reduce dedupe success.
- PageView tracker not firing on rapid route changes (Next.js), contributing to low coverage.

## Objectives
1. Align browser + server payloads for PageView, InitiateCheckout, Purchase.
2. Ensure stable event IDs (UUID) reused between pixel + CAPI.
3. Hash customer identifiers client side before sending to CAPI.
4. Improve event emission reliability (router transitions, idle fallback).
5. Validate via `npm run build` and prepare for Test Events verification.

## Workstreams
- **Client instrumentation**
  - Review `FacebookPixel.js`, `FacebookPageViewTracker.js`, `facebookPixels.js` utilities.
  - Synchronize event triggers (PageView on route change, InitiateCheckout on checkout entry, Purchase in order flow).
- **Identifier hygiene**
  - Implement SHA-256 hashing in browser (Web Crypto API) before sending to server.
  - Guard server route to avoid double-hashing.
- **Deduplication**
  - Store and reuse event IDs per event instance via refs or payload.
  - Ensure pixel `fbq` command includes `eventID` option.
  - Guarantee `external_ids` set on both sides when user logged in/identified.
- **Docs & testing**
  - Document trigger points and data parity requirements.
  - Outline QA steps (Meta Test Events, event coverage monitoring).

## Next Steps
1. Update client utilities to pre-hash identifiers, include event IDs, and send `fbp/fbc` consistently.
2. Update `conversion-api` route to detect already hashed values (avoid double hashing).
3. Emit `InitiateCheckout` from cart view with stable dedupe keys.
4. Harden PageView tracker with idle callbacks + fallback (already partly done).
5. Run `npm run build` to confirm compile success.
6. Share QA checklist in follow-up doc if needed.
