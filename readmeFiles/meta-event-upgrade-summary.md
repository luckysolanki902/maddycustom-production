# Meta Pixel & Conversion API Enhancements

This note captures the recent instrumentation sweep across the Facebook Pixel (client) and Conversion API (server). It highlights the pre-change gaps, the upgrades we shipped, and the impact we expect on Meta's Event Match Quality (EMQ), Event Deduplication, and overall coverage.

---
## 1. High-Level Timeline
- Added Facebook domain verification & analytics scaffolding for predictable Pixel loading.
- Rebuilt `FacebookPageViewTracker` to guarantee PageView coverage (idle scheduling, visibility flush, retry queue).
- Centralised `InitiateCheckout` emission with dedupe IDs, removed duplicate firing paths.
- Hardened client fingerprinting & hashing: Web Crypto first, `js-sha256` fallback, auto detection of pre-hashed IDs.
- Upgraded Conversion API route to respect pre-hashed payloads, normalise phone/email, and avoid double hashing.
- Introduced short debug logs on both client and server to streamline validation.

---
## 2. Before vs. After Snapshot

| Dimension | Before | After |
| --- | --- | --- |
| **Event Coverage** | *~30% PageView success.* Tracker relied on immediate `fbq('track','PageView')` and missed when Pixel not ready or during rapid SPA navigations. | *Target 90%+ PageView success.* Dedicated tracker waits for Pixel load, replays missed paths, and flushes on visibility/resume. |
| **InitiateCheckout Firing** | Multiple sources (ViewCart + OrderForm) created duplicate events without shared `eventID`. | Single source (`ViewCart`) with scoped `eventID` persisted through checkout, preventing duplicate uploads. |
| **Identifier Quality** | Relied on raw email/phone fields. Missing values during funnel entry caused "Missing/Invalid" warnings. | Automatic collection via `userDataEnhancer`, hashed client-side (Web Crypto → `js-sha256` fallback) and validated server-side. |
| **Deduplication** | Pixel auto-fired `PageView`; server-side events lacked pairing ID causing dedupe failures. | Client Pixel no longer auto fires. Tracker sets common `eventID`; server trusts hashed IDs and dedupes reliably. |
| **Conversion API Hygiene** | Phone/email always hashed server-side, leading to double hashing when client sent hashes. Validation rejected hashed emails. | Route detects SHA-256, skips rehashing, validates hashed or raw emails, and trims numbers. |
| **Dynamic Routing** | API routes used `request.url`, breaking static export and undermining reliability. | All affected routes use `request.nextUrl` and are tagged `dynamic = 'force-dynamic'`, avoiding export failures. |
| **Observability** | No ground truth logs besides Meta dashboard. | `console.debug` summaries on both client and server (event name, `eventId`, counts of hashed IDs, value, contents). |

---
## 3. Expected Impact on Meta Scores

| Metric | Baseline (Est.) | Expected Range After Changes | Drivers |
| --- | --- | --- | --- |
| **Event Match Quality (PageView)** | 3 / 10 | 6 – 7 / 10 | Higher identifier coverage (hashed email/phone, session IDs), consistent event timestamps, IP/UA capture. |
| **Event Match Quality (InitiateCheckout)** | 4 / 10 | 7 – 8 / 10 | Deduplicated identifiers, consistent `eventID`, first-name hashing, debug tuning. |
| **Event Deduplication Rate (Checkout/Purchase)** | < 30% | 90%+ | Shared `eventID` across Pixel & CAPI, removal of duplicate client emitters. |
| **PageView Coverage** | ~30% tracked | 90%+ tracked | Idle-based firing, visibility flush, fallback queue. |
| **EMQ for Purchase (downstream)** | 5 / 10 | 7 – 8 / 10 | Upstream identify improvements flow into purchase events. |

*Numbers reflect realistic improvements based on Meta best-practice guidance and observed coverage gaps; final values will depend on traffic mix and data capture quality.*

---
## 4. What to Monitor Next
- **Meta Events Manager**: Watch EMQ dashboards for PageView & InitiateCheckout over the next 7 days.
- **Deduplication Diagnostics**: Ensure Pixel vs. CAPI events show high pairing rate; run the Meta Testing Tool after key checkouts.
- **Client Console**: Verify `[FB Pixel] Dispatch` logs fire once per intended event; confirm hashed identifiers show as boolean `true`.
- **Server Logs**: Tail `[Meta CAPI] Dispatch` output for each event; spot-check value/contents counts.
- **Segment Coverage**: Confirm that hashed identifiers appear during the entire checkout flow, even before email entry (phone or session ID fallback).

---
## 5. Follow-Up Recommendations
1. Add automated smoke test to hit key flows (`PageView`, `AddToCart`, `InitiateCheckout`, `Purchase`) and assert debug log presence.
2. Periodically export Meta's Event Matching CSV to quantify actual score shifts against expectations above.
3. Consider wiring debug logs into a structured analytics sink (e.g., Logflare/Datadog) for historical tracking beyond console output.
4. Once metrics stabilise, disable excessive logging or gate with `process.env.NODE_ENV !== 'production'` if noise becomes an issue.

---
**Bottom Line:** We now have resilient Pixel firing, consistent dedupe IDs, richer hashed identifiers, and clear observability. These changes should meaningfully lift Meta's match quality scores and reduce warning noise during validation, positioning the funnel for better optimisation and attribution.
