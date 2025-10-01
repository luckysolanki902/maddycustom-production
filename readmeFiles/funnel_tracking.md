# Funnel Tracking Overview

This document captures the end-to-end funnel tracking stack that now ships with the storefront. It covers the data model, ingestion flow, tracked events (including offer applications), and the recommended admin-facing analyses such as stage counts, conversion ratios, and abandoned-cart surfaces.

---

## Architecture at a Glance

- **Client Orchestrator**: `src/lib/analytics/funnelClient.js`
  - Manages visitor/session IDs, batching, sendBeacon fallback, page context, and now includes an in-memory dedupe cache so duplicate events (e.g., React StrictMode double-mounts) are dropped per session.
  - New helpers `identifyUser()` and `getIdentifiers()` let UI flows tag funnel sessions with user/contact info when it becomes available.
  - Debug mode can be toggled with the `?debugFunnel` query param (or automatically in non-production builds) to log queued/flush activity to the console.
- **Bridge Component**: `components/analytics/FunnelClientBridge.js`
  - Hydrates the client with UTM + Redux state, keeps metadata in sync while users navigate.
- **API Ingestion Route**: `app/api/analytics/track-funnel/route.js`
  - Validates payloads (Zod), connects to Mongo, and delegates to the funnel service.
- **Service Layer**: `src/lib/analytics/funnelService.js`
  - Normalizes steps, upserts `FunnelSession`, persists `FunnelEvent`, applies server-side validation, and exposes `attachUserToFunnel()` for retroactive linkage.
- **Persistence Models**: `src/models/analytics/FunnelSession.js` & `FunnelEvent.js`
  - Schemas outlined below, including new `metadata.contact` fields on sessions and events.

---

## Data Model Cheat Sheet

| Model | Purpose | Key Fields |
| --- | --- | --- |
| `FunnelSession` | Represents a visitor-session pair. | `visitorId`, `sessionId`, `userId`, `utm`, `device`, `geo`, `landingPage`, `flags`, `firstActivityAt`, `lastActivityAt`, `metadata.contact` (`phoneNumber`, `email`, `name`), `metadata.tags`, `metadata.lastLinkedAt`, `revisits` |
| `FunnelEvent` | Immutable events tied to a session. | `session` (ref), `visitorId`, `sessionId`, `userId`, `step`, `timestamp`, `eventId/eventHash` (dedupe), optional `page`, `product`, `cart`, `order`, `utm`, and a flexible `metadata` Mixed type receiving contact snapshots, offer info, etc. |

Both models are indexed to support:
- Lookups by `(visitorId, sessionId)`
- Filtering by `utm` / `device.platform`
- Step-based chronological reads
- Contact-driven queries (new index on `metadata.contact.phoneNumber`)

`attachUserToFunnel()` updates both collections once a user authenticates or provides contact details, ensuring future analytics can pivot by user ID/phone/email.

---

## Event Catalogue

Current normalized `step` values (as enforced by `STEP_MAP` and `STEP_ENUM`):

| Step | Trigger Source | Payload Highlights |
| --- | --- | --- |
| `visit` | Auto on first page load for a session, via layout bridge | Page path/title, UTM, device info |
| `view_product` | Product detail pages, view effects | Product ID, price, category |
| `apply_offer` | **New:** fires when a coupon/offer is applied (manual or auto) in cart | Coupon code, discount amount/type, source (`manual`/`auto`), offer ID, cart totals |
| `add_to_cart` | Product cards, PDP add-to-cart buttons | Product details, cart snapshot |
| `view_cart_drawer` | Cart drawer open | Cart size/value |
| `open_order_form` | Checkout/order form launched | Cart + payment context |
| `address_tab_open` | Address tab activated in order form | Address metadata |
| `contact_info` | Order form contact submission | Contact presence flags, cart totals |
| `initiate_checkout` | Checkout initiated (analytics parity with Meta/GA) | Cart contents |
| `payment_initiated` | Payment attempt started | Payment mode & gateway info |
| `purchase` | Order completion | Order ID, value, payment status |
| `session_return` | Returning session ping | Flags.increment |

### Adding More Steps
Extend `STEP_MAP`, `STEP_ENUM`, and the `enum` array in `FunnelEvent` to introduce new milestones. The client orchestrator will accept anything in `STEP_ENUM` and auto-normalize synonyms defined in `STEP_MAP`.

### Idempotency & Deduplication

- The client orchestrator now keeps a session-scoped dedupe cache. It automatically drops repeated `visit` events for the same path within a session, preventing double-counting during hydration or StrictMode remounts.
- Any producer can pass a custom `dedupeKey` when calling `funnelClient.track(step, payload)` to enforce idempotency. Keys should be deterministic per logical event (e.g., `purchase:${orderId}`) and will be skipped if already seen for the active session.
- Server-side validation still guards against malformed payloads; however, duplicate payloads are best suppressed client-side using `dedupeKey` to avoid unnecessary writes.

---

## Admin Funnel Widgets & Queries

Use the steps above to power staged conversion views. Suggested workflow for a **Funnel Tracking Admin** dashboard covering the path _visit → add-to-cart → open order form → address tab → initiate checkout → purchase_.

1. **Stage Counts (per day/week)**
   - Filter `FunnelEvent` by `timestamp` and `step` and compute unique session counts.
   - Sample Mongo aggregation skeleton:
     ```javascript
     db.funnelevents.aggregate([
       { $match: { timestamp: { $gte: ISODate('2025-10-01') }, step: { $in: ['visit','add_to_cart','open_order_form','address_tab_open','initiate_checkout','purchase'] } } },
       { $group: { _id: { step: '$step', sessionId: '$sessionId' }, lastEvent: { $max: '$timestamp' } } },
       { $group: { _id: '$_id.step', sessions: { $sum: 1 } } }
     ])
     ```
   - Join with `FunnelSession` if you need UTM/device/geo pivots.

2. **Key Ratios**
   - **Visit → Purchase (Overall Conversion):** `purchase_sessions / visit_sessions`
   - **Cart-to-Purchase (C2P):** `purchase_sessions / add_to_cart_sessions`
   - **Cart-to-Checkout:** `initiate_checkout_sessions / add_to_cart_sessions`
   - **Checkout Completion:** `purchase_sessions / initiate_checkout_sessions`
   - **Order-Form Engagement:** `open_order_form_sessions / visit_sessions`
   - Calculate per cohort (channel/device) by grouping on session metadata.

3. **Multi-Step Cohort Table**
   - Build a pipeline that pivots each session into columns:
     ```javascript
     db.funnelevents.aggregate([
       { $match: { timestamp: { $gte: twoDaysAgo } } },
       { $group: {
           _id: '$sessionId',
           visitorId: { $first: '$visitorId' },
           userId: { $first: '$userId' },
           steps: { $addToSet: '$step' },
           lastEventAt: { $max: '$timestamp' }
       } },
       { $project: {
           visitorId: 1,
           userId: 1,
           lastEventAt: 1,
           hasVisit: { $in: ['visit', '$steps'] },
           hasCart: { $in: ['add_to_cart', '$steps'] },
           hasOrderForm: { $in: ['open_order_form', '$steps'] },
           hasAddress: { $in: ['address_tab_open', '$steps'] },
           hasCheckout: { $in: ['initiate_checkout', '$steps'] },
           hasPurchase: { $in: ['purchase', '$steps'] }
       } }
     ])
     ```
   - Feed into UI to show funnel drop-offs visually.

4. **Abandoned Cart Surfaces**
   - Define abandonment as sessions with `add_to_cart` but no `purchase` within a window (e.g., last 48 hours).
   - Example query:
     ```javascript
     const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
     db.funnelSessions.aggregate([
       { $match: { lastActivityAt: { $gte: cutoff } } },
       { $lookup: {
           from: 'funnelEvents',
           localField: '_id',
           foreignField: 'session',
           as: 'events'
       } },
       { $match: {
           'events.step': 'add_to_cart',
           'events.step': { $ne: 'purchase' }
       } },
       { $project: {
           visitorId: 1,
           userId: 1,
           contact: '$metadata.contact',
           utm: 1,
           lastActivityAt: 1
       } }
     ])
     ```
   - Use `metadata.contact.phoneNumber` to power WhatsApp/SMS win-back flows.

5. **Offer Performance (New `apply_offer` Step)**
   - Track how many sessions apply an offer before purchasing.
   - Suggested KPI: `apply_offer_sessions / add_to_cart_sessions` and `purchase_sessions_with_offer / apply_offer_sessions`.
   - Filter events via `metadata.source` (`manual`, `auto`) to compare auto vs manual redemptions.

---

## Operational Playbook

- **Linking Funnel to Users**: Both `/api/user/check` and `/api/user/create` now accept `funnelVisitorId` and `funnelSessionId` and call `attachUserToFunnel()`. That populates session + event records with `userId` and contact metadata immediately after the user shares details.
- **Order Form Tracking**: When contact info is submitted, the form triggers a `contact_info` funnel event and refreshes the client identity. Address, payment, and purchase steps now emit their respective events with deterministic `dedupeKey`s tied to session/order identifiers.
- **Applying Offers**: `ViewCart` emits an `apply_offer` event whenever coupons are applied (manual or auto). Metadata captures the code, discount, source, and cart value, allowing offer-performance analytics downstream.
- **UTM & Device Glue**: The bridge keeps `utm`, referrer, device, and geo snapshots aligned between session metadata and each event. When overriding `utm`, send `session: { utm: { override: true, ... } }` with the event.
- **Debug Mode**: Append `?debugFunnel` to any page URL (or run in non-production) to enable verbose console logs (`[Funnel] queued event`, `[Funnel] flushing events`, etc.). Use this during QA to verify dedupe and batching behavior.

---

## QA & Verification Checklist

1. **Run the inspection script after any funnel walkthrough**:

  ```powershell
  node scripts/inspect-funnel-events.mjs
  ```

  - Lists the five most recent sessions (masking contact info) and prints the chronological event timeline for the latest session.
  - Highlights which canonical steps were observed and which are missing, helping QA confirm complete coverage (e.g., `visit → add_to_cart → open_order_form → contact_info → address_tab_open → initiate_checkout → payment_initiated → purchase`).

2. **Check for unexpected duplicates**:
  - With `debugFunnel` enabled, ensure only a single `[Funnel] queued event` appears for each intended action. If duplicates show up, add or adjust the `dedupeKey` used when tracking that step.

3. **Validate payload integrity**:
  - Watch server logs for `[Funnel] API received events` and `[Funnel] API persisted events` lines. Any validation failure (status 200 with `success: false`) will surface as console errors in development.

4. **Confirm contact linkage**:
  - After providing a phone or email, re-run the inspection script and confirm the session summary shows masked contact info (`hasContact: true`).

5. **Exercise optional steps periodically**:
  - Not every QA pass covers `view_product`, `apply_offer`, or `view_cart_drawer`. Schedule dedicated runs for those flows to prevent regressions in analytics downstream.

---

## Future Enhancements

- **Cart Drawer & Offer Coverage**: Ensure QA flows regularly hit `view_cart_drawer` and `apply_offer` so dashboards always have fresh data; add automated smoke tests if feasible.
- **Admin UI**: Build a Next.js dashboard that consumes the aggregations above, providing charts for stage counts, conversion funnels, and abandoned-cart queues.
- **Alerting**: Schedule a CRON job (e.g., Vercel Cron + serverless function) that queries abandoned carts and pings the CX team when threshold breaches occur.
- **Data Warehouse Sync**: Consider exporting funnel events to a warehouse (BigQuery/Snowflake) for long-term retention and advanced modeling once the production volume increases.

---

## Glossary

- **C2P (Cart-to-Purchase) Ratio**: `# of sessions with purchase / # of sessions with add_to_cart`
- **Visit-to-Purchase Conversion**: `# of sessions with purchase / # of sessions with visit`
- **Apply Offer Adoption**: `# of sessions with apply_offer / total sessions`
- **Abandoned Cart**: Session with `add_to_cart` but no `purchase` within the alerting window.

Keep this document close when iterating on analytics touchpoints or building downstream dashboards—the structure above ensures both engineering and growth teams speak the same language.
