# Meta Event QA Checklist

Use this checklist after implementing tracking improvements to ensure Meta Pixel + Conversions API parity.

## Pre-requisites
- Browser events send `eventID` matching server `event_id`.
- `fbp`, `fbc`, hashed `external_ids`, `emails`, `phones` present when available.
- Pixel helper enabled in browser (Meta Pixel Helper extension) for debugging.

## Test Procedure
1. **Local smoke test**
   - Start dev environment, open site in a fresh profile.
   - Confirm console shows `fbPixelLoaded` event once.
   - Navigate across multiple pages quickly; ensure PageView events fire (check network requests to `https://www.facebook.com/tr/`).
2. **Meta Test Events tool**
   - In Events Manager, open Test Events, copy test code.
   - Add `?fbclid=TESTCODE` to URL or set test event token in headers if required.
   - Perform the following actions:
     - Page load + navigation.
     - Add to cart.
     - Initiate checkout (open payment modal/order form).
     - Complete mock purchase (if sandbox available).
   - Verify each event appears twice (Pixel + Server) with identical event IDs and "Deduplicated" status.
3. **Event coverage monitoring**
   - After deploy, monitor Event Coverage tab for PageView, InitiateCheckout, Purchase.
   - Expect coverage ≥75% within 24h.
   - Investigate missing dedupe keys if warning persists.

## Debug Tips
- If server payload missing `fbp`, inspect `getFacebookTrackingParamsAsync` logic.
- If event IDs mismatch, ensure same UUID passed to both pixel + server call.
- For hashed identifiers, confirm 64-char SHA-256 strings; avoid double hashing on server.

## Reporting
- Capture screenshots of Test Events showing deduped pairs.
- Record coverage metrics after 24h and 72h; update `meta-event-quality-plan.md` with findings.
