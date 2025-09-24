# AI Support Assistant Function-Calling Architecture Plan

## 1. Goals
- Provide an automated, safe, extensible assistant capable of:
  - Product discovery (filters like price < 1000, category-specific, color/pattern keywords)
  - Context-aware suggestions based on current page (product list, product detail, order success, etc.)
  - Anonymous order tracking via orderId (no PII leakage)
  - Shipping time estimates (heuristic + Shiprocket integration placeholder)
  - Structured responses (renderable galleries, timelines, highlights)
  - Natural language queries mapped to function calls with minimal hallucination
- Preserve safety: never expose internal IDs, raw database internals, hidden knowledge, or unavailable products.
- Maintain performance: avoid large payloads; cap product suggestions (e.g. 6–8 items) and timeline steps.

## 2. Data Sources & Models
Relevant models (from `/src/models`):
- Product: fields (name, title, images[], price, MRP, pageSlug, mainTags, searchKeywords[], available, specificCategory, specificCategoryVariant, inventoryData, options via Option model, productSource, brand)
- SpecificCategory / SpecificCategoryVariant: hierarchical availability gating.
- Inventory: (not shown but assumed) track stock counts; if productSource === 'inventory' ensure stock > 0.
- Option: product option-level inventory possible (need to check inventory referencing in options when product has variants or multiple SKUs).
- Order: orderId, items, address, status history, shipment (Shiprocket) data.
- AssistantThread / UserMessage: existing persistence for chat continuity.

## 3. Functional Capabilities (Planned Functions)
1. searchProducts
   - Inputs: { query?: string, maxPrice?: number, minPrice?: number, category?: string, colorOrKeyword?: string[], limit?: number }
   - Behavior: lexical + tag + keyword filtering; enforce availability chain; price filter; ranking: (exact keyword hits > tag hits > fuzzy).
   - Output: { products: [{ id, title, price, image, pageSlug, badges[], short?: string }] }
   - Safety: omit internal IDs; only first image; build absolute image URL with `NEXT_PUBLIC_CLOUDFRONT_BASEURL`.

2. getOrderStatus
   - Inputs: { orderId: string }
   - Behavior: find order, derive snapshot (current status, timeline milestones, estimated delivery if available).
   - Output: { found: boolean, orderId, status, eta?, steps:[{ label, at, state }], items:[{ title, qty, price }]? }
   - Safety: exclude user personal info except maybe masked name (first name + initial) if needed; no raw address; no phone/email.

3. estimateShippingTime
   - Inputs: { pincode: string }
   - Behavior: placeholder heuristics mapping region → range (2-5 days). Later: integrate actual Shiprocket service for realtime SLA.
   - Output: { pincode, estimate: { minDays, maxDays }, disclaimer }

4. getPageContext
   - Inputs: none (server injects) OR { pageType, category, productTitle? }
   - Provided automatically by middleware/hook as a hidden assistant message (NOT via function call) when route changes.

5. buildProductGallery (internal formatting helper)
   - Not exposed to assistant; API will package structured product results into a single assistant message with metadata: { type: 'product_gallery', items: [...] }.

6. highlightEntities (internal)
   - Parse assistant free-form reply to wrap key tokens (ETA, price numbers, order status) with markup markers for UI highlighting.

## 4. OpenAI Tool / Function Design
We will use new Assistants tool calling style (JSON schema). Defined functions:
- search_products (maps to searchProducts)
- get_order_status
- estimate_shipping_time

Assistant Instructions Addition:
"You can call tools to fetch products, shipping times, or order status. Prefer tool calls over guessing. Do NOT fabricate product details or availability."

Handling Loop:
1. User message -> POST /api/assistant/chat
2. Create message in thread.
3. Run assistant with tool definitions.
4. If run status = requires_action: parse tool calls → execute server functions sequentially → submit tool outputs.
5. Resume run until completed.
6. On completion, gather final assistant messages + structured tool outputs we appended.
7. Transform any attached structured metadata into renderable chat entries.

## 5. Product Search Logic Details
Filters:
- available must be true on product.
- If product.specificCategory → ensure that category.available !== false.
- If product.specificCategoryVariant → ensure variant.available !== false.
- If inventory gating (productSource === 'inventory'): ensure inventoryData.inStock > 0 (or quantity > 0). For option-level inventory: only include product if ANY option has stock.
- Price filters: apply min/max.
Ranking Signals (score):
- Exact phrase match in title: +5
- Individual keyword matches in title: +3 each
- searchKeywords match: +2
- mainTags match: +1.5
- Price proximity to mid-range (optional minor tie-break).

Return up to limit (default 6).

## 6. Order Status Logic
Derive steps similar to TrackPage UI:
- Confirmed → Processing → Packed → Shipped → Out For Delivery → Delivered / Cancellation path.
Add timestamps when present; else omit.
Compute ETA: if shipment data has an expected_date else heuristically add 2–5 days based on region/pincode distribution.
Never expose address, email, phone.

## 7. Shipping Time Estimator
Heuristic mapping examples:
- Metro (Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata): 2–3 days
- Tier-1/State capitals: 3–4 days
- Other urban: 4–5 days
- Remote / North-East / J&K: 5–7 days
Return disclaimer: "Estimates—actual dispatch depends on production & carrier performance."

## 8. Response Structuring & UI Rendering
Chat message format extension:
- Standard: { id, role, text }
- Extended types:
  - Product Gallery: { id, role: 'assistant', type: 'product_gallery', products: [...] }
  - Order Status: { id, role: 'assistant', type: 'order_status', order: {...} }
  - Shipping ETA: { id, role: 'assistant', type: 'shipping_eta', eta: {...} }

UI updates: detect message.type and render specialized components (grid, timeline, badge highlights). Fallback to plain text for unknown.

## 9. Safety & Validation
- Validate numeric bounds (price > 0, maxPrice reasonable e.g. <= 100000).
- Sanitize strings (strip control chars).
- Rate limit heavy functions (product search and order status) per userId & IP (light in-memory map initially).
- Truncate product arrays to limit.
- Remove HTML / markdown from assistant raw replies (instructions: no markdown) to keep UI minimal.

## 10. Caching Strategy
- Short-term (60s) cache product search results by normalized query + filters (in-memory LRU) to reduce DB load.
- Optional: leverage existing Next.js route caching where safe.

## 11. Implementation Phases
Phase 1: Backend function scaffolding + API tool loop.
Phase 2: Product search + order status functions.
Phase 3: Shipping ETA + route context injection.
Phase 4: UI rendering components for gallery, status timeline.
Phase 5: Highlighting + safety & rate limiting.
Phase 6: Docs & polishing.

## 12. Risks & Mitigations
- Function call recursion loops: add max 2 tool passes per user message.
- Large responses: truncate descriptions, limit to crucial fields.
- Model hallucination: reinforce instructions to always call tools for data-dependent answers.
- Privacy: mask/omit personal info in order responses.

## 13. Acceptance Criteria
- Assistant uses function call when user asks for products or order/shipping info.
- Only available and in-stock products appear.
- Gallery renders with correct absolute image URLs.
- Order tracking returns timeline & current status without PII.
- Shipping estimator returns range & disclaimer.
- Route context influences suggestions (e.g., on product list page for pillar wraps, suggestions align to that category).
- No crashes or unhandled promise rejections under typical usage.

## 14. Future Extensions (Not in initial scope)
- Pagination / "show more" for product gallery.
- User preference memory (recently viewed categories).
- A/B testing for ranking signals.
- Real Shiprocket API integration.
- Vector semantic search augmentation.

---
End of Plan.
