# Funnel Tracking Overview

This document captures how funnel data is collected, stored, and linked to user records.

## Data Models

### FunnelSession

Collection: `funnel_sessions`

Represents a visitor session and consolidates everything we know about the user and their entry context.

| Field | Type | Notes |
| --- | --- | --- |
| `visitorId` | `String` | UUID persisted in localStorage; indexed and unique per session alongside `sessionId`. |
| `sessionId` | `String` | UUID persisted with 30-minute inactivity TTL; composed index with `visitorId`. |
| `userId` | `ObjectId<User>` | Populated whenever we successfully link a user. |
| `metadata.contact.phoneNumber` | `String` | Last known phone submitted for this visitor. Indexed for fast retrieval. |
| `metadata.contact.email` | `String` | Last known email submitted. |
| `metadata.contact.name` | `String` | Last known name. |
| `metadata.tags` | `[String]` | Optional classification hooks for future enrichment. |
| `metadata.lastLinkedAt` | `Date` | Timestamp of the most recent linkage from a user-facing form or API response. |
| `utm` | `Object` | Captures UTM fields and query params for the first hit. |
| `referrer` | `String` | First referrer captured. |
| `landingPage` | `Object` | Path, category, slug, and title of landing route. |
| `device` | `Object` | user agent, platform, language, screen dimensions. |
| `geo` | `Object` | City, region, country, timezone (if available). |
| `firstActivityAt` / `lastActivityAt` | `Date` | Session activity bounds. |
| `revisits` | `Number` | Incremented on `session_return` events. |
| `flags` | `Object` | Booleans like `isReturning`, `isFromAd`. |

Key indexes:

- `{ visitorId: 1, sessionId: 1 }` (unique)
- `{ 'utm.campaign': 1, lastActivityAt: -1 }`
- `{ 'device.platform': 1, lastActivityAt: -1 }`
- `{ 'metadata.contact.phoneNumber': 1, lastActivityAt: -1 }`

### FunnelEvent

Collection: `funnel_events`

Stores each funnel step emitted by the client orchestrator. Sessions are referenced through `session` (ObjectId) while `visitorId`/`sessionId` remain denormalised for direct lookups.

| Field | Type | Notes |
| --- | --- | --- |
| `session` | `ObjectId<FunnelSession>` | Required reference. |
| `visitorId` / `sessionId` | `String` | Assist in debugging or targeted updates. |
| `userId` | `ObjectId<User>` | Filled once a user is known. |
| `step` | `String` | One of: `visit`, `view_product`, `add_to_cart`, `view_cart_drawer`, `open_order_form`, `address_tab_open`, `initiate_checkout`, `contact_info`, `payment_initiated`, `purchase`, `session_return`. Normalised server-side. |
| `timestamp` | `Date` | When the activity occurred. |
| `eventId` / `eventHash` | `String` | Optional dedupe keys. |
| `page` | `Object` | Route metadata (`path`, `name`, `category`, `slug`, `title`, `referringPath`). |
| `product` | `Object` | Product snapshot (id, name, price, quantity, variantId, brand, category). |
| `cart` | `Object` | Cart totals (item count, value, currency). |
| `order` | `Object` | Checkout payload (orderId, value, coupon, currency). |
| `utm` | `Object` | Event-level UTMs (falls back to session UTM). |
| `metadata` | `Mixed` | Open object to attach extra context (cart breakdowns, device hints, contact info, etc.). |
| `errors` | `[String]` | Optional capture of processing issues. |

Key indexes:

- `{ step: 1, timestamp: -1 }`
- `{ 'page.category': 1, timestamp: -1 }`
- `{ 'product.id': 1, timestamp: -1 }`
- `{ sessionId: 1, step: 1, timestamp: -1 }`
- `{ sessionId: 1, step: 1, eventId: 1 }` (partial unique where `eventId` exists)

## Client Instrumentation

All client instrumentation flows through `src/lib/analytics/funnelClient.js`.

- Maintains long-lived `visitorId` + rolling `sessionId` (30 minute inactivity TTL).
- Batches events (max 10) and flushes via `navigator.sendBeacon` with fetch fallback.
- Exposes `getIdentifiers()` for any component that needs to forward IDs to the backend.
- New `identifyUser()` API stores the latest `userId`, phone, email, and name; subsequent events automatically include this metadata and set `event.userId` when available.
- `contact_info` step is emitted from:
  - Order form contact tab.
  - Footer subscribe form.
  - Subscribe dialog.
  - Login dialog.

Each of those submission points now forwards `funnelVisitorId` & `funnelSessionId` with their API requests so the backend can link the active session.

## Server Ingestion & Linking

### Event ingestion

Endpoint: `POST /api/analytics/track-funnel`

- Accepts `{ events: [...] }` (max 50 per batch) validated with Zod.
- Normalises steps (`viewproduct` → `view_product`, etc.) and gracefully ignores unsupported steps.
- Upserts sessions through `upsertSession()`, merging UTM, device, geo, and flags data.
- Persists events via `persistEvent()` while avoiding duplicates (`eventId` uniqueness).

### Linking visitors to users

Helper: `attachUserToFunnel({ visitorId, sessionId?, userId?, phoneNumber?, email?, name? })`

- Writes `userId` + latest contact info into matching `FunnelSession` documents and stamps `metadata.lastLinkedAt`.
- Updates `FunnelEvent` documents for the same visitor/session so downstream funnels immediately have user context.
- Safe no-op if identifiers are missing.

Usage points:

- `/api/user/create` (existing + new user paths).
- `/api/user/check` (both when user exists and when they don't, so contact info is still cached).

## Query Examples

### Recent abandoned carts with phone numbers

```javascript
// sessions with add_to_cart but no purchase in last 48 hours
const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
const sessions = await FunnelSession.aggregate([
  { $match: { lastActivityAt: { $gte: twoDaysAgo }, 'metadata.contact.phoneNumber': { $exists: true, $ne: '' } } },
  {
    $lookup: {
      from: 'funnel_events',
      let: { sessionKey: '$sessionId', visitorKey: '$visitorId' },
      pipeline: [
        { $match: { $expr: { $and: [ { $eq: ['$sessionId', '$$sessionKey'] }, { $eq: ['$visitorId', '$$visitorKey'] } ] } } },
        { $group: { _id: '$step', count: { $sum: 1 } } },
      ],
      as: 'steps'
    }
  },
  {
    $match: {
      steps: {
        $elemMatch: { _id: 'add_to_cart' },
        $not: { $elemMatch: { _id: 'purchase' } }
      }
    }
  },
  {
    $project: {
      visitorId: 1,
      sessionId: 1,
      phone: '$metadata.contact.phoneNumber',
      email: '$metadata.contact.email',
      name: '$metadata.contact.name',
      lastActivityAt: 1,
      utm: 1,
    }
  }
]);
```

### Resolve session history for a known user

```javascript
const history = await FunnelEvent.find({ userId }).sort({ timestamp: -1 }).lean();
```

## Operational Notes

- Attach funnel identifiers (`funnelVisitorId`, `funnelSessionId`) to any new API endpoint that ties a visitor to first-party data (lead forms, callbacks, etc.).
- Keep `identifyUser()` in mind whenever user context changes client-side so future events inherit the linkage automatically.
- `metadata.tags` inside sessions is available for lightweight classifications (e.g., "b2b", "test-order", etc.) should we need them later.
- Phone number index enables quick lookups for service teams needing last-touch metadata on a lead.
