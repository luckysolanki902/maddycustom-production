# Implementation TODO

## Phase 1 – Scaffolding (Backend)
1. Define function schemas (JSON) for OpenAI tools:
   - search_products
   - get_order_status
   - estimate_shipping_time
2. Add tool definitions & enabling logic in `/api/assistant/chat/route.js`.
3. Implement run loop: detect `requires_action`, execute tools, submit outputs, continue run (max 2 tool passes).
4. Add structured message envelope types: product_gallery, order_status, shipping_eta.

## Phase 2 – Utilities
5. Create `src/lib/assistant/productSearch.js`:
   - Query building: availability chain, inventory check, option-level fallback.
   - Keyword + tag + fuzzy matching.
   - Ranking & limiting.
6. Create `src/lib/assistant/orderStatus.js`:
   - Secure fetch by orderId only.
   - Derive timeline & status snapshot (no PII beyond masked name).
7. Create `src/lib/assistant/shippingEstimator.js`:
   - Heuristic region mapping (pincode pattern).
   - Returns range + disclaimer.
8. Create simple in-memory LRU cache util for product search (optional size 100 entries, TTL 60s).

## Phase 3 – Context Injection
9. Implement route context provider/hook to gather pageType, category name, product title.
10. Inject route context as hidden assistant message when it changes (like internal knowledge injection pattern) tagged for filtering.

## Phase 4 – UI Enhancements
11. Extend chat message model in hook to allow `type` field.
12. Add UI components:
    - `ProductGalleryMessage` (grid with image, price, quick link buttons).
    - `OrderStatusMessage` (timeline + key status pill + optional item count).
    - `ShippingEtaMessage` (range highlight, disclaimer styling).
13. Update rendering logic in `SupportChatDialog`, `FaqPageChat`, `FullPageSupportChat` to switch on message.type.
14. Add highlight styling (bold or accent background) for numbers like prices & status keywords.

## Phase 5 – Safety & Validation
15. Central input validator for functions (clamp limits, sanitize strings, pattern-check orderId/pincode, numeric bounds).
16. Rate limiter (simple Map: key=userId+function; track timestamps & counts per minute).
17. Ensure responses truncate large arrays (products max 8).
18. Strip markdown / enforce plain text in free-form assistant replies.

## Phase 6 – Testing & Docs
19. Manual test scripts or Jest (if configured) for product search edge cases.
20. Test function-call conversation flows (product query, order tracking, shipping time).
21. Write `README_CHAT_FUNCTIONS.md` documenting tools & response shapes.
22. Update existing `NOTIFICATION_SYSTEM_SUMMARY.md` (if needed) with reference to assistant additions.

## Acceptance Checklist
- [ ] Tool call loop works end-to-end.
- [ ] Product query returns gallery.
- [ ] Order tracking returns secure timeline.
- [ ] Shipping estimator returns range.
- [ ] Route context influences assistant wording.
- [ ] No PII leakage in order responses.
- [ ] Invalid inputs return friendly validation messages.

## Stretch (Later)
- Streaming partial tool responses.
- Semantic embedding search fallback.
- Persistent caching layer (Redis) for high traffic.
- Feedback thumbs up/down capture.
