# Funnel Tracking Implementation Plan

## 1. Objectives & Success Criteria
- Capture the full user funnel from first-page visit through purchase and post-purchase revisits with high-granularity event data.
- Support step attribution for the following milestones: `visit`, `view_product`, `add_to_cart`, `view_cart_drawer`, `open_order_form`, `address_tab_open`, `initiate_checkout`, `purchase`, `session_return`.
- Store page-to-page journeys including both category and slug, even when an intermediate step is rendered via drawer or modal (e.g., cart drawer, order form dialog).
- Enable fast aggregation for “most added to cart” products, drop-off points, revisit frequency, and UTM attribution without impacting customer UX or serverless cold starts.
- Ensure the solution is asynchronous, resilient to network issues, and reuses MongoDB connections effectively.

- **Client trackers**: GA4 (`GoogleAnalyticsGA4`), Google Ads, Meta Pixel, Clarity, Razorpay script.
- **Existing helpers**: `gaAddToCart`, `gaPurchase`, etc. in `src/lib/metadata/googleAds.js`; rich Meta Pixel helpers in `src/lib/metadata/facebookPixels.js`.
- **Meta Pixel touchpoints**:
  - Page flow: `FacebookPageViewTracker` fires `pageView` on route changes, `ProductIdPage` emits `viewContent` once per product, `SearchCategoryDialog` fires `Search` on suggestion/product clicks.
  - Conversion path: `AddToCartButton` / `AddToCartButtonWithOrder` trigger `AddToCart`; `ViewCart` fires `initiateCheckout`; `OrderForm` sends `contactInfoProvided`, `paymentInitiated`, and `purchase` after order creation.
  - Lead gen: `SubscribeDialog`, `Footer` newsletter form, and `NotifyMeDialog` all invoke `lead` with contextual metadata.
  - Additional hooks (commented/imported): `ContactUs` and `PriceAndChat` prepared for `contactFbq` style events.
- **Behavior state**: `userBehaviorSlice` tracks time on site, pathnames, and scroll depth; `UTMCapture` saves UTM parameters into Redux and cookies.
- **Data backend**: MongoDB connection via `connectToDb.js`; tracking models exist for searches (`SearchQuery`), UTM history, etc., but no implemented funnel event ingestion in `src/app/api/analytics/*` yet.
- **Cart & checkout UI flow**:
  - `AddToCartButton` / `AddToCartButtonWithOrder` mutate cart state.
  - `CartDrawer` renders `ViewCart` inside a MUI `Drawer`.
  - `ViewCart` manages order form dialog (`dlgOrder`) and “Pay Now”/"Order Now" actions.
  - `OrderForm` handles tab navigation (contact/ address / payment) and final submission.

## 3. Proposed Architecture Overview
- **Client Event Orchestrator**: New module `src/lib/analytics/funnelClient.ts` (or `.js`) responsible for generating visitor/session IDs, standardizing event payloads, queuing, and dispatching to the backend.
- **Event Pipeline**: Capture events from UI components, enrich with context (visitor IDs, session IDs, UTM snapshot, cart/product metadata), queue locally (IndexedDB/localStorage), and flush using `navigator.sendBeacon` or idle-time `fetch`.
- **Server Ingestion API**: Implement a single POST endpoint (`/api/analytics/track-funnel`) that accepts batched events, deduplicates, and stores them in MongoDB via new models. Reuse cached mongoose connection to avoid per-request overhead.
- **Data Model**:
  - `FunnelSession`: Stores visitor/session identity, first/last activity, device/UA, UTM attribution.
  - `FunnelEvent`: Stores granular events linked to `FunnelSession`, includes step, timestamp, page context, product/context payload, and ordering metadata.
  - `DailyFunnelSummary` (optional, Phase 3): Precomputed aggregates for dashboards.
- **Analytics Jobs**: Optional scheduled jobs (existing cron folder) to compute aggregations (top products added, conversion rates, revisit cohorts) and cache results.

## 4. Client-Side Instrumentation Plan

### 4.1 Identity & State Management
- Generate persistent `visitorId` (UUID) stored in cookie/localStorage.
- Maintain `sessionId` rolling every 30 minutes of inactivity; persist in sessionStorage and extend on activity.
- Mirror `userId` when available (logged-in or recognized returning customer) from Redux or API responses.
- Snapshot current UTM details, device info, referrer, and timezone per session.

### 4.2 Event Schema
```json
{
  "visitorId": "uuid",
  "sessionId": "uuid",
  "userId": "...",           // optional
  "step": "add_to_cart",    // enumerated string
  "timestamp": "ISO",
  "page": {
    "path": "/shop/...",
    "name": "product-list",
    "category": "wraps",
    "slug": "bonnet-strip-wraps"
  },
  "product": {
    "id": "...",
    "name": "...",
    "price": 999,
    "quantity": 1,
    "variantId": "..."
  },
  "cart": {
    "items": 3,
    "value": 2499
  },
  "order": {
    "orderId": "...",
    "value": 3499,
    "coupon": "..."
  },
  "utm": {
    "source": "google",
    "medium": "cpc",
    "campaign": "..."
  },
  "metadata": {
    "component": "AddToCartButton",
    "source": "recommendationDrawer"
  }
}
```
- Keep optional blocks sparse to reduce payload size; send only relevant sections per event.

### 4.3 Event Capture Touchpoints
| Funnel Step | Component / Hook | Instrumentation Notes |
|-------------|------------------|-----------------------|
| `visit` | New hook `useFunnelPageView` invoked in `RootLayout` (after `NavigationListener`) to listen to `router.events` & `userBehaviorSlice.pathnamesVisited` | Enrich with category & slug via helper that maps Next.js route segments and product/category metadata from Redux or page props. Capture referrer, UTM snapshot, and align timing with existing `pageView` tracker to avoid double counting. |
| `view_product` | `ProductIdPage`, `ProductCard` hover/expand components | Fire when landing on product detail or when product quick view is opened. Include `productId`, `category`, `variant`. Leverage the same guard (`hasTracked`) used by `viewContent` to prevent duplicate events. |
| `add_to_cart` | `AddToCartButton`, `AddToCartButtonWithOrder` success handlers | Already dispatching GA/FB events; piggyback on the existing try/catch blocks for Meta/GA to call funnel client with product, quantity, price, origin (pageType, recommendation, etc.). |
| `view_cart_drawer` | `CartDrawer` `useEffect` watching `isCartDrawerOpen` | Fire once per open, include cart snapshot. Respect current drawer analytics (none yet) so funnel event becomes the primary signal. |
| `open_order_form` | `ViewCart` when `setDlgOrder(true)` | Fire when order dialog transitions from closed to open. Bundle context used by `contactInfoProvided` where possible to minimize extra data work. |
| `address_tab_open` | `OrderForm` hook monitoring `tabIndex === addressTabIndex` | Trigger when address tab first activated; include address completeness flags. Coordinate with `contactInfoProvided` so each step is a distinct funnel milestone. |
| `initiate_checkout` | `ViewCart` `handleCheckout` path (already firing `initiateCheckout`) and OOS dialog continuation | Fire when user clicks pay/submit; include payment mode. Ensure dedupe with Meta helper by reusing generated `eventID`. |
| `purchase` | Existing order completion pipeline (likely in `/api/order`) | Emit server-side event after successful order creation with order total, items. Can reuse payload prepared for Meta `purchase`. |
| `session_return` | `useFunnelPageView` when `visit` occurs with returning `visitorId` and `lastSeenAt` > 24h | Mark revisit event.

### 4.4 Queueing & Dispatch Strategy
- Use lightweight queue with `navigator.sendBeacon` fallback to `fetch` with `keepalive` for reliability.
- Batch events (e.g., flush every 5 events or 2 seconds idle) to reduce network chatter.
- Persist unsent events to IndexedDB via `idb-keyval` (small dependency) for offline/slow network.
- Guard calls with feature flag in `process.env.NEXT_PUBLIC_ENABLE_FUNNEL_TRACKING` to allow gradual rollout.

### 4.5 Additional Client Concerns
- Ensure event emission is non-blocking; wrap heavy computations in `requestIdleCallback` or `setTimeout`.
- Tie into Redux store updates to avoid duplicate events (e.g., track add-to-cart only on state change success).
- Provide debug mode (`?debugFunnel=true`) to log events in console for QA.
- Where Meta/GA helpers already construct payloads (e.g., `trackAddToCart`, `contactInfoProvided`), reuse the same normalized objects to keep cross-channel metrics aligned and minimize extra serialization cost.

## 5. Server-Side Ingestion & Storage

### 5.1 API Route `/api/analytics/track-funnel`
- Accepts POST JSON body `{ events: FunnelEvent[] }` with max 50 events per request.
- Validate schema (use `zod` or `yup`).
- Apply per-IP rate limiting (leverage existing middleware or simple in-memory limit for now).
- Normalize timestamps to UTC, attach server receipt time.
- Upsert `FunnelSession` by `{ visitorId, sessionId }`, increment counters, update `lastActivityAt`.
- Persist each `FunnelEvent` with reference to session `_id` and sanitized metadata.
- Return `{ success: true, accepted: n, rejected: m }`.

### 5.2 MongoDB Models
- **`FunnelSession`**
  ```js
  {
    visitorId: String, // index
    sessionId: String, // unique compound index with visitorId
    userId: ObjectId?,
    utm: { source, medium, campaign, term, content },
    referrer: String,
    device: { userAgent, platform, language },
    firstActivityAt: Date,
    lastActivityAt: Date,
    revisits: Number,
    flags: { isReturning: Boolean }
  }
  ```
- **`FunnelEvent`**
  ```js
  {
    session: ObjectId, // ref FunnelSession
    step: String, // enum
    timestamp: Date,
    page: { path, name, category, slug },
    product: { id, name, price, quantity, variantId },
    cart: { items, value },
    order: { orderId, value, coupon },
    metadata: { component, source, experimentId },
    createdAt: Date
  }
  ```
- Indexes: `{ step: 1, timestamp: -1 }`, `{ "page.category": 1, timestamp: -1 }`, full-text on `product.name`.
- Optional: TTL index to purge raw events after 180 days (while keeping aggregates).

### 5.3 Aggregation Layer
- Create aggregation scripts (under `scripts/` or `src/app/api/analytics/dashboard`) to compute metrics:
  - Conversion funnel per UTM campaign.
  - Drop-off percentage between steps.
  - Top `add_to_cart` products per day/week.
  - Revisit cohorts (time between `visit` and `session_return`).
- Cache results in Redis (if available) or persist to `DailyFunnelSummary` documents to be surfaced in admin dashboard.

## 6. Reporting & Visualization Hooks
- Extend existing admin tooling (`/api/analytics/dashboard`) to query new collections.
- Provide endpoints for:
  - `/api/analytics/funnel/summary?range=7d`
  - `/api/analytics/funnel/path?sessionId=...` for diagnostic trails.
  - `/api/analytics/funnel/top-products?range=30d`.
- Future: integrate with BI tools (Metabase) by exposing collections.

## 7. Implementation Roadmap

### Phase 1 – Foundations
1. Build client `funnelClient` with identity, queue, schema validation, batching.
2. Instrument global page visits (`useFunnelPageView`) and add-to-cart events.
3. Implement `/api/analytics/track-funnel` with schema validation and basic persistence.
4. Seed database indexes and environment flags.
5. QA with debug mode; verify events in MongoDB.

### Phase 2 – Full Funnel Coverage
1. Instrument cart drawer, order form opening, tab navigation, initiate checkout click.
2. Add purchase event emission server-side (hook into order creation success path).
3. Track revisit sessions (client + server flagging).
4. Introduce optional experiment IDs/feature flags for A/B tracking.

### Phase 3 – Analytics & Optimizations
1. Build aggregation endpoints/dashboards for funnel drop-off, top products, revisit metrics.
2. Add retention policies (TTL) and backfills for historical data if possible.
3. Implement background job to compute daily summaries.
4. Add alerting hooks (e.g., Slack webhook) for sudden drop-offs or anomalies.

## 8. Validation & QA Strategy
- Unit tests for `funnelClient` (queueing, flushing, schema validation) using Jest.
- Integration tests for API route: send event batches, assert DB state.
- Cypress/Playwright journey tests to ensure each UI interaction triggers expected events.
- Load tests for ingestion endpoint (artillery/k6) to validate throughput.
- Monitoring: log aggregation stats (request count, error rate) to existing logging infrastructure.

## 9. Risks & Mitigations
- **Duplicate events**: Use client-side guards (emit once per action) and server dedupe by `(sessionId, step, timestampHash)`.
- **Network failures**: Offline queue + retry with exponential backoff; discard after max retries.
- **Payload PII**: Avoid capturing sensitive fields (mask address/phone); enforce server-side sanitization.
- **Performance impact**: Run event enrichment in `requestIdleCallback`; keep payloads < 5 KB; reuse MongoDB cached connection.
- **Compliance**: Respect consent (future integration with cookie banner to disable tracking when opted out).

## 10. File & Module Impact Summary
- `src/lib/analytics/funnelClient.(ts|js)` (new).
- `src/hooks/useFunnelPageView.js` (new).
- Modify: `RootLayout`, `CartDrawer`, `ViewCart`, `AddToCartButton`, `AddToCartButtonWithOrder`, `OrderForm`, `ProductIdPage`, `AnalyticsHead` (to bootstrap tracker).
- API: new route `src/app/api/analytics/track-funnel/route.js`.
- Models: `src/models/analytics/FunnelSession.js`, `src/models/analytics/FunnelEvent.js`, optional `DailyFunnelSummary.js`.
- Scripts/tests: Jest tests under `tests/analytics/`.

## 11. Open Questions / Follow-ups
- Confirm retention policy (how long to keep raw events?).
- Should “visit” include scroll depth or time spent as event metadata? (Currently tracked separately.)
- Do we need real-time dashboards or is daily batching sufficient?
- Decide on visualization tooling (in-house dashboard vs. external BI).
