# Funnel Tracking Update — October 1, 2025

## ✅ Data Model Adjustments
- `FunnelSession.landingPage`
  - Added `name` to persist the canonical label for the landing screen.
  - Added `pageCategory` to capture our page classification (`home`, `product-list-page`, `product-id-page`, `other`).
  - New compound index: `{ 'landingPage.pageCategory': 1, lastActivityAt: -1 }` to accelerate landing-page level analytics.
- `FunnelEvent.page`
  - Added `pageCategory` to every event payload so downstream tools can pivot by the same classification.
  - Added supporting index `{ 'page.pageCategory': 1, timestamp: -1 }`.

## 🧭 Page Classification Enum
A shared enum now powers both client-side tagging and server-side validation:

```
home
product-list-page
product-id-page
other
```

- The enum lives in `src/lib/analytics/pageClassifier.js` and is exported as `PAGE_CATEGORY_ENUM` + `PAGE_CATEGORY_VALUES`.
- `funnelService` consumes `PAGE_CATEGORY_VALUES` to enforce the same set through Zod validation when events are ingested.
- `funnelClient` (and the auto visit scheduler) now attaches the enum value to both session landing metadata and every `visit` event.

## 👁️ Local Identity Fallback
- `orderForm.userDetails.localUserId` is now generated client-side (deterministic per browser via redux-persist) until a real `userId` is assigned.
- `funnelClient.identifyUser` forwards `localUserId` into event metadata (`metadata.user.localUserId`) and session metadata (`metadata.contact.localUserId`).
- Once a real `userId` lands, the local placeholder is cleared automatically so downstream systems pivot on the true identifier.

## 🛠️ Backfill Utility Route
- Temporary POST endpoint: `/api/admin/backfill-page-classification` (requires `x-backfill-token` header when `BACKFILL_ADMIN_TOKEN` env var is set)
  - Reclassifies historical `FunnelSession` + `FunnelEvent` documents that predate the new `pageCategory`/`name` fields.
  - Batches 250 docs at a time, idempotent, and returns `{ sessions: { processed, updated }, events: { processed, updated } }`.
