# Funnel Tracking Overview

**Last Updated**: October 1, 2025

This document captures the end-to-end funnel tracking stack that now ships with the storefront. It covers the data model, ingestion flow, tracked events (including offer applications), and the recommended admin-facing analyses such as stage counts, conversion ratios, and abandoned-cart surfaces.

> **💡 Important**: For comprehensive implementation details, see:
> - `IDEMPOTENCY_AND_DEDUPLICATION.md` - Complete 5-layer idempotency strategy
> - `FUNNEL_TRACKING_IMPROVEMENTS.md` - All system improvements and technical changes
> - `FUNNEL_TRACKING_QUICK_GUIDE.md` - Developer quick reference
> - `IDEMPOTENCY_IMPLEMENTATION_SUMMARY.md` - Implementation summary
> - `TRACKING_FLOW_DIAGRAM.md` - Visual flow diagram
> - `funnel_tracking_update.md` - Latest model + enum deltas (this update)

---

## Architecture at a Glance

- **Client Orchestrator**: `src/lib/analytics/funnelClient.js`
  - Manages visitor/session IDs, batching, sendBeacon fallback, page context, and includes a **5-layer deduplication system** to guarantee zero duplicate events.
  - **Deterministic Event IDs**: Auto-generates unique IDs based on event characteristics (step, visitorId, sessionId, timestamp, productId, orderId).
  - **Content Hashing**: Additional verification layer for critical events (purchase, payment).
  - **Smart Dedupe Cache**: In-memory cache with intelligent time windows (5 seconds for critical events like purchase/payment, 30 minutes for others).
  - **localStorage Backup**: Events survive page refresh/close with automatic restoration.
  - **Retry Logic**: 3 attempts with exponential backoff before backing up to localStorage.
  - **Auto Visit Coverage**: Built-in page classifier now tracks `visit` for every navigation (home, product-list, product-id, and other pages) while waiting ~200ms so page components can enrich metadata before dispatch.
  - New helpers `identifyUser()` and `getIdentifiers()` let UI flows tag funnel sessions with user/contact info when it becomes available.
  - Debug mode can be toggled with the `?debugFunnel` query param (or automatically in non-production builds) to log queued/flush activity to the console.
- **Bridge Component**: `components/analytics/FunnelClientBridge.js`
  - Hydrates the client with UTM + Redux state, keeps metadata in sync while users navigate.
  - Auto-links funnel sessions with user data when contact information becomes available.
- **API Ingestion Route**: `app/api/analytics/track-funnel/route.js`
  - Validates payloads (Zod), connects to Mongo, and delegates to the funnel service.
  - Returns detailed response including accepted, duplicates, and errors counts.
- **Service Layer**: `src/lib/analytics/funnelService.js`
  - Normalizes steps, upserts `FunnelSession`, persists `FunnelEvent`, applies server-side validation.
  - **Pre-insert duplicate detection**: Checks for existing eventId and eventHash before saving.
  - Exposes `attachUserToFunnel()` for retroactive linkage.
- **Persistence Models**: `src/models/analytics/FunnelSession.js` & `FunnelEvent.js`
  - Schemas outlined below, including new `metadata.contact` fields on sessions and events.
  - **Unique indexes** enforce database-level duplicate prevention.
  - **Partial indexes** optimize queries for critical events.

---

## 🛡️ Idempotency & Deduplication (5-Layer Defense)

The system implements a **comprehensive 5-layer strategy** to guarantee **absolute idempotency** and **zero duplicate events**:

### Layer 1: Client-Side Dedupe Cache
- In-memory Map tracking recent events
- **5-second window** for critical events (purchase, payment, checkout, add_to_cart, apply_offer)
- **30-minute window** for non-critical events (visit, view_product, etc.)
- Prevents React StrictMode duplicates, rapid clicks, and component re-renders

### Layer 2: Deterministic Event IDs
- Auto-generated unique IDs based on event characteristics
- Format: `{step}_{timestamp_rounded_to_second}_{hash}`
- Same event = Same ID (guaranteed)
- Components: step, visitorId, sessionId, timestamp, productId, orderId, pagePath, couponCode

### Layer 3: Content Hash (eventHash)
- Additional content-based verification
- Used for critical events (purchase, payment_initiated, initiate_checkout)
- Hash based on: step, IDs, cart data, order data
- Catches duplicates even if eventId differs

### Layer 4: Pre-Insert Database Lookup
- Two-phase check before saving:
  1. Check existing `eventId` (all events)
  2. Check existing `eventHash` (critical events only)
- Fast indexed queries (2-5ms)
- Prevents duplicate writes proactively

### Layer 5: Unique Database Index
- Compound unique index: `(sessionId, step, eventId)`
- Additional partial index: `(sessionId, step, eventHash)` for critical events
- Database-level enforcement (MongoDB E11000 duplicate key error)
- Handles race conditions and concurrent writes

**Result**: Mathematically impossible for duplicate events to persist in database.

For detailed documentation, see `IDEMPOTENCY_AND_DEDUPLICATION.md`.

---

## Data Model Cheat Sheet

| Model | Purpose | Key Fields |
| --- | --- | --- |
| `FunnelSession` | Represents a visitor-session pair. | `visitorId`, `sessionId`, `userId`, `utm`, `device`, `geo`, `landingPage` (**path**, **name**, **pageCategory**, category, slug, title), `flags`, `firstActivityAt`, `lastActivityAt`, `metadata.contact` (`phoneNumber`, `email`, `name`, `localUserId`), `metadata.tags`, `metadata.lastLinkedAt`, `revisits` |
| `FunnelEvent` | Immutable events tied to a session. | `session` (ref), `visitorId`, `sessionId`, `userId`, `step`, `timestamp`, **`eventId`** (deterministic unique ID), **`eventHash`** (content-based hash), optional `page` (**path**, **name**, **pageCategory**, slug, title), `product`, `cart`, `order`, `utm`, and a flexible `metadata` Mixed type receiving contact snapshots (`metadata.user.localUserId`, phone, email), offer info, etc. |

**Indexes for Performance & Deduplication**:
- `(visitorId, sessionId)` - Fast session lookups
- `(step, timestamp)` - Chronological event queries
- `(sessionId, step, eventId)` - **Unique index** (primary deduplication)
- `(sessionId, step, eventHash)` - **Partial index** for critical events (purchase, payment_initiated, initiate_checkout)
- `('landingPage.pageCategory', lastActivityAt)` - Landing page segmentation
- `('page.pageCategory', timestamp)` - Event-level page classification pivots
- `(metadata.contact.phoneNumber)` - Contact-driven queries
- `(utm.source, utm.medium)` - UTM analysis
- `(device.platform)` - Device segmentation

`attachUserToFunnel()` updates both collections once a user authenticates or provides contact details, ensuring future analytics can pivot by user ID/phone/email.

---

## Page Classification Enum

Every navigation now maps to one of four canonical page categories, shared by the client classifier, session metadata, and server validation (`PAGE_CATEGORY_VALUES` in `src/lib/analytics/pageClassifier.js`):

| Value | Description | Captured In |
| --- | --- | --- |
| `home` | Root landing page (`/`) | `FunnelSession.landingPage.pageCategory`, `FunnelEvent.page.pageCategory`, `visit` metadata |
| `product-list-page` | Category/variant listings under `/shop/...` with ≤1 slug after `shop` | Same as above |
| `product-id-page` | SKU detail pages under `/shop/...` with ≥2 slugs | Same as above + includes product snapshot |
| `other` | All remaining routes (about, terms, viewcart, user flows, etc.) | Same as above |

The classifier runs inside `funnelClient` for auto `visit` events and inside `funnelService` (via Zod) to enforce that only the enum values above are persisted.

---

## Local Identity Fallback (`localUserId`)

To correlate multi-session browsers that never share contact info:

- `orderForm.userDetails.localUserId` is generated via UUID on first session and stored in redux-persist.
- `funnelClient.identifyUser()` forwards `localUserId` into event metadata (`metadata.user.localUserId`) and session metadata (`metadata.contact.localUserId`).
- When a real `userId` arrives, the placeholder is cleared automatically to avoid ambiguity.
- Use this field to identify repeat visitors who abandon before checkout.

---

## Event Catalogue

Current normalized `step` values (as enforced by `STEP_MAP` and `STEP_ENUM`):

| Step | Trigger Source | Payload Highlights | Auto-tracked |
| --- | --- | --- | --- |
| `visit` | Auto on first page load + every navigation via classifier | Page path/title, UTM, device info, `page.pageCategory` (`home`/`product-list-page`/`product-id-page`/`other`) | ✅ |
| `view_product` | Product detail pages, view effects | Product ID, price, category | ✅ |
| `add_to_cart` | Product cards, PDP add-to-cart buttons | Product details, cart snapshot | ✅ |
| `apply_offer` | **New:** fires when a coupon/offer is applied (manual or auto) in cart | Coupon code, discount amount/type, source (`manual`/`auto`), offer ID, cart totals | ✅ |
| `view_cart_drawer` | **New:** Cart drawer open (CartDrawer component) | Cart size/value, source (top/bottom) | ✅ |
| `open_order_form` | Checkout/order form launched | Cart + payment context | ✅ |
| `address_tab_open` | Address tab activated in order form | Address metadata | ✅ |
| `contact_info` | Order form contact submission, footer, login, subscribe | Contact presence flags, cart totals | ✅ |
| `initiate_checkout` | Checkout initiated (analytics parity with Meta/GA) | Cart contents, payment mode | ✅ |
| `payment_initiated` | Payment attempt started | Payment mode & gateway info, order ID | ✅ |
| `purchase` | Order completion | Order ID, value, payment status | ✅ |
| `session_return` | Returning session ping | Flags.increment | ✅ |

**All events are now auto-tracked** - no manual duplicate prevention needed by developers!

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

### **Pre-Deployment Checklist**
- [ ] Review the QA Checklist (below) to ensure all tracking events are firing correctly
- [ ] Verify idempotency layer is active: check for `eventId` and `eventHash` in payloads
- [ ] Confirm auto visit classification: ensure `page.pageCategory` is present (`home`, `product-list-page`, `product-id-page`, `other`)
- [ ] Test localStorage backup: check Application > Local Storage > `maddy_funnel_backup`
- [ ] Verify indexes exist on FunnelEvent: `eventId` (unique), `sessionId_step_eventHash` (partial)
- [ ] Confirm event catalog matches `STEP_ENUM` in funnelClient.js
- [ ] Test in multiple browsers (Chrome, Firefox, Safari) and devices (mobile, desktop)

### **Monitoring & Health Checks**
- **Real-time Dashboard**: Use `?debugFunnel=true` in URL to see event logs in browser console
- **Database Queries**:
  ```javascript
  // Check for duplicate events (should return 0)
  db.funnelevents.aggregate([
    { $group: { _id: "$eventId", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  
  // View event distribution
  db.funnelevents.aggregate([
    { $group: { _id: "$step", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  // Check recent events
  db.funnelevents.find({ step: "purchase" }).sort({ timestamp: -1 }).limit(10);
  db.funnelsessions.find({ flags: { $exists: true } }).limit(10);
  ```
- **localStorage Inspection**: Check `maddy_funnel_backup` size (should be < 5MB)
- **Retry Failures**: Monitor API logs for events that failed after 3 retries

### **Common Issues & Fixes**
| Issue | Symptom | Fix |
| --- | --- | --- |
| Events not firing | No logs in console with `?debugFunnel=true` | Check component imports `funnelClient`, verify tracking calls |
| Duplicate events | Multiple DB entries with same `eventId` | Verify indexes exist, check for race conditions in tracking code |
| localStorage full | Events failing to backup | Run `localStorage.removeItem('maddy_funnel_backup')` or clear old data |
| Missing critical events | Gaps in funnel (e.g., no `purchase` after payment) | Check event priority in queue, verify API responses, review server logs |
| Session not resuming | New `sessionId` on page reload | Check `sessionStorage` for session persistence, verify bridge initialization |
| Cart snapshot inaccurate | Cart totals in events don't match actual cart | Ensure Redux state is updated before tracking, check timing of track() calls |

### **Debugging Commands**
```javascript
// In browser console
window.funnelClient.flush(); // Force send queued events
localStorage.getItem('maddy_funnel_backup'); // View backup queue
window.funnelClient.track('test_event', { test: true }); // Manual test event
sessionStorage.getItem('funnelSessionId'); // Check current session ID
```

### **Operational Notes**
- **Linking Funnel to Users**: Both `/api/user/check` and `/api/user/create` accept `funnelVisitorId` and `funnelSessionId` and call `attachUserToFunnel()`. This populates session + event records with `userId` and contact metadata immediately after the user shares details.
- **Order Form Tracking**: When contact info is submitted, the form triggers a `contact_info` funnel event and refreshes the client identity. Address, payment, and purchase steps emit their respective events with deterministic `dedupeKey`s tied to session/order identifiers.
- **Applying Offers**: `ViewCart` emits an `apply_offer` event whenever coupons are applied (manual or auto). Metadata captures the code, discount, source, and cart value for offer-performance analytics.
- **UTM & Device Glue**: The bridge keeps `utm`, referrer, device, and geo snapshots aligned between session metadata and each event. When overriding `utm`, send `session: { utm: { override: true, ... } }` with the event.
- **Debug Mode**: Append `?debugFunnel=true` to any page URL to enable verbose console logs (`[Funnel] queued event`, `[Funnel] flushing events`, etc.). Use this during QA to verify dedupe and batching behavior.

---

## QA & Verification Checklist

### **Pre-QA Setup**
1. Enable debug mode: Add `?debugFunnel=true` to URL before testing
2. Clear previous session data (optional): Clear browser localStorage/sessionStorage for fresh session
3. Open browser console to monitor real-time event logs

### **Verification Steps**

#### **1. Run the inspection script after any funnel walkthrough**
```powershell
node scripts/inspect-funnel-events.mjs
```
- Lists the five most recent sessions (masking contact info)
- Prints chronological event timeline for the latest session
- Highlights which canonical steps were observed and which are missing
- Confirms complete coverage (e.g., `visit → add_to_cart → open_order_form → contact_info → address_tab_open → initiate_checkout → payment_initiated → purchase`)

#### **2. Check for unexpected duplicates**
- With `debugFunnel=true`, ensure only a single `[Funnel] queued event` appears for each intended action
- If duplicates show up, verify:
  - Event has proper `dedupeKey` or auto-generated `eventId`
  - Client-side cache is working (check console for "already tracked" messages)
  - No race conditions in component lifecycle
- Query database for duplicate `eventId`s (should return 0):
  ```javascript
  db.funnelevents.aggregate([
    { $group: { _id: "$eventId", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  ```

#### **3. Validate payload integrity**
- Watch server logs for `[Funnel] API received events` and `[Funnel] API persisted events` lines
- Any validation failure (status 200 with `success: false`) will surface as console errors in development
- Verify critical fields:
  - `eventId` is present and unique
  - `eventHash` exists for critical events
  - `step` matches STEP_ENUM values
  - Cart snapshots attached to cart-related events
  - UTM parameters preserved across session

#### **4. Confirm contact linkage**
- After providing a phone or email, re-run the inspection script
- Confirm the session summary shows masked contact info (`hasContact: true`)
- Verify `userId` is populated in subsequent events
- Check that contact metadata appears in session record

#### **5. Exercise optional steps periodically**
- Not every QA pass covers `view_product`, `apply_offer`, or `view_cart_drawer`
- Schedule dedicated runs for these flows:
  - Product detail page view
  - Cart drawer open (top and bottom buttons)
  - Coupon application (manual and auto)
  - Multiple offers applied in sequence
- Prevent regressions in analytics downstream

#### **6. Test idempotency & deduplication**
- Rapid-fire same action (e.g., click "Add to Cart" 5 times quickly)
- Verify only 1 event is queued (check console logs)
- Refresh page mid-checkout, continue process
- Verify events don't duplicate after page reload
- Check localStorage backup (`maddy_funnel_backup`) contains failed events
- Simulate network failure (DevTools > Network > Offline), trigger event
- Go back online and verify event is retried from backup

#### **7. Critical path validation**
Essential events that MUST fire for complete funnel:
- [ ] `visit` - First page load
- [ ] `view_product` - Product page view
- [ ] `add_to_cart` - Add item to cart
- [ ] `view_cart_drawer` - Open cart drawer
- [ ] `apply_offer` - Apply coupon (if using offers)
- [ ] `open_order_form` - Initiate checkout
- [ ] `contact_info` - Submit contact details
- [ ] `address_tab_open` - Fill address
- [ ] `initiate_checkout` - Confirm checkout
- [ ] `payment_initiated` - Start payment
- [ ] `purchase` - Complete order

### **Automated Testing**
Consider adding automated tests for critical flows:
```javascript
// Example Playwright/Cypress test
test('Complete funnel tracking', async () => {
  // Visit page
  await page.goto('/shop');
  await verifyEvent('visit');
  
  // View product
  await page.click('[data-product-id]');
  await verifyEvent('view_product');
  
  // Add to cart
  await page.click('[data-add-to-cart]');
  await verifyEvent('add_to_cart');
  
  // ... continue through checkout
});
```

### **Performance Monitoring**
- Monitor localStorage size (should stay under 5MB)
- Check API response times for `/api/funnel/track`
- Verify events batch correctly (not 1 request per event)
- Ensure no memory leaks from long-lived sessions

### **Documentation Cross-reference**
- See `IDEMPOTENCY_AND_DEDUPLICATION.md` for detailed deduplication strategy
- See `FUNNEL_TRACKING_IMPROVEMENTS.md` for all recent enhancements
- See `FUNNEL_TRACKING_QUICK_GUIDE.md` for developer quick reference
- See `TRACKING_FLOW_DIAGRAM.md` for visual flow diagram

---

## Future Enhancements

- **Cart Drawer & Offer Coverage**: Ensure QA flows regularly hit `view_cart_drawer` and `apply_offer` so dashboards always have fresh data; add automated smoke tests if feasible.
- **Admin UI**: Build a Next.js dashboard that consumes the aggregations above, providing charts for stage counts, conversion funnels, and abandoned-cart queues.
- **Alerting**: Schedule a CRON job (e.g., Vercel Cron + serverless function) that queries abandoned carts and pings the CX team when threshold breaches occur.
- **Data Warehouse Sync**: Consider exporting funnel events to a warehouse (BigQuery/Snowflake) for long-term retention and advanced modeling once the production volume increases.
- **Real-time Analytics Dashboard**: Build a live monitoring view showing events as they stream in with WebSocket/Server-Sent Events.
- **A/B Testing Integration**: Link funnel sessions to experiment variants for performance comparison.
- **Machine Learning**: Use event sequences to predict purchase likelihood and optimize retargeting.
- **Cross-device Tracking**: Enhance visitor fingerprinting to track users across multiple devices.
- **Historical Backfill Scripts**: Run `/api/admin/backfill-page-classification` periodically (include an `x-backfill-token` header if `BACKFILL_ADMIN_TOKEN` is configured) until legacy records all carry the new classification fields.

---

## Related Documentation

This document is part of a comprehensive funnel tracking system. See also:

- **`IDEMPOTENCY_AND_DEDUPLICATION.md`** - Deep dive into the 5-layer deduplication strategy
- **`FUNNEL_TRACKING_IMPROVEMENTS.md`** - Complete list of all 8 improvements made to the tracking system
- **`FUNNEL_TRACKING_QUICK_GUIDE.md`** - Developer quick reference for implementing tracking
- **`IDEMPOTENCY_IMPLEMENTATION_SUMMARY.md`** - High-level overview of idempotency implementation
- **`TRACKING_FLOW_DIAGRAM.md`** - Visual flow diagram of the tracking architecture
- **`NOTIFICATION_SYSTEM_SUMMARY.md`** - Notification system architecture (separate but related)

For webhook improvements and multi-order handling, see:
- `readmeFiles/webhook-improvements.md`
- `readmeFiles/multi-order-splitting.md`

---

## Glossary

- **C2P (Cart-to-Purchase) Ratio**: `# of sessions with purchase / # of sessions with add_to_cart`
- **Visit-to-Purchase Conversion**: `# of sessions with purchase / # of sessions with visit`
- **Apply Offer Adoption**: `# of sessions with apply_offer / total sessions`
- **Abandoned Cart**: Session with `add_to_cart` but no `purchase` within the alerting window.

Keep this document close when iterating on analytics touchpoints or building downstream dashboards—the structure above ensures both engineering and growth teams speak the same language.
