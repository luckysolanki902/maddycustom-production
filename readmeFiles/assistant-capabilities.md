# Assistant Product Gallery Capability (Phase 1)

This document describes the initial function-calling style automation implemented for the MaddyCustom assistant.

## Overview
The assistant can now surface product suggestions as a structured `product_gallery` message rendered inside all chat UIs:
- Floating dialog (`SupportChatDialog`)
- FAQ page inline chat (`FaqPageChat`)
- Full page support view (`FullPageSupportChat`)

It supports:
- Natural language queries like: "show me pillar wrap under 1000" / "suggest a red pattern wrap" / "cheap tank wrap".
- Optional numeric filters (min/max price) auto-extracted upstream (future: extraction layer – current phase expects explicit tool trigger or manual user shaping by LLM).
- Category biasing via browsing context (Redux slice `assistantContext`).
- Inventory & availability enforcement (product, specific category, variant, inventory stock / option-level inventory).
- Keyword scoring across `title`, `searchKeywords`, and `mainTags`.
- Discount signal boosting.
- Pagination with a Show More button.
- Cold-start fallback: first-variant picks from available categories when no query/filters present.

## Message Schema
Assistant gallery messages appended to chat state have shape:
```
{
  id: string,              // gallery-<timestamp>
  role: 'assistant',
  type: 'product_gallery',
  products: [
    {
      title: string,
      price: number,
      mrp?: number,
      discountPercent?: number, // 0 if none
      image?: string,           // absolute URL
      slug: string              // /shop/... internal route
    }
  ],
  hasMore: boolean,
  page: number,
  limit: number,
  queryEcho: { query?, maxPrice?, minPrice?, keywords?: string[] },
  created_at: isoDateString
}
```

## Tool Invocation (Search Products)
POST `/api/assistant/chat` with body:
```
{
  userId: string,
  action: 'tool:search_products',
  toolInvocation: {
    query?: string,
    maxPrice?: number,
    minPrice?: number,
    categoryTitle?: string,
    keywords?: string[] | string,
    page?: number,
    limit?: number // 1..12 (default 6)
  }
}
```
Returns:
```
{
  tool: 'search_products',
  data: {
    page, limit, hasMore, totalApprox,
    products: [...],
    queryEcho: { query, maxPrice, minPrice, keywords }
  }
}
```
The hook (`useAssistantChat.invokeProductSearch`) wraps this and automatically appends a gallery message.

## Pagination (Current Behavior)
Each "Show More" click issues `page + 1` using the previous message's `queryEcho` data and appends a **new** gallery message. (Future enhancement option: merge into existing message.)

## Browsing Context Enrichment
Redux slice: `assistantContext` (non-persisted) captures:
```
{
  pageType: 'product_list' | 'product_detail' | null,
  categoryTitle?: string,
  productTitle?: string,
  variantTitle?: string,
  lastUpdated: number
}
```
Pages dispatch on mount (Products list & Product detail). The search tool uses `categoryTitle` as a bias if user did not specify one explicitly.

## Filtering & Gating Rules
- `available !== false` on Product required.
- If `specificCategory` present: that category `available !== false`.
- If `specificCategoryVariant` present: variant `available !== false`.
- If `productSource === 'inventory'` OR option-level inventory references exist, at least one referenced `Inventory.availableQuantity > 0` required.
- Price filter applied if `minPrice` / `maxPrice` defined.

## Ranking
Score components (additive):
- Title contains keyword: +3
- `searchKeywords` contains keyword: +2
- `mainTags` contains keyword: +1.5
- Discount > 20%: +1
Sorted descending; ties preserve Mongo return order.

## Sanitation & Validation
Server route clamps & cleans:
- Text fields trimmed, collapsed whitespace, max length 120.
- Numeric values coerced, negatives floored at 0.
- If `minPrice > maxPrice` they are swapped.
- `limit` forced to 1..12 (default 6).
- Keywords array truncated to 8 entries.

## Cold Start (No Query Provided)
When no `query | maxPrice | minPrice | keywords | categoryTitle` present, `categoryFirstSuggestions` runs:
- Lists available specific categories.
- For each category retrieves the cheapest available product.
- Stops when reaching requested `limit`.
- `hasMore` is always `false` in this mode.

## UI Components
- `ProductGalleryMessage`: Renders responsive grid (2 columns on narrow). Shows image, title, price, optional MRP with strike-through, discount badge, and button linking to product page. Displays a Show More button if `hasMore`.
- Integrated into: `SupportChatDialog`, `FaqPageChat`, `FullPageSupportChat`.

## Hook Additions (`useAssistantChat`)
Added method:
```
invokeProductSearch(params)
```
Appends gallery message on success. Sets `pendingAssistant` during request.

## Error Handling
- Tool or send failures set `pendingAssistant` false and attach `meta.error` to the triggering user message (for retry) OR surface error state via hook `error` string.

## Extensibility Plan (Future Phases)
Planned tools:
1. `tool:track_order` – anonymous order lookup (order id + phone/email fragment).
2. `tool:shipping_eta` – shipping / delivery estimate given PIN + product(s).
3. `tool:bundle_recommend` – cross-sell / accessory bundle suggestions.

## Suggested Next Enhancements
- Merge pagination results into existing gallery message (append products, maintain stable ID).
- Tokenize + classify free-form user input to auto-decide when to call `search_products` vs. LLM reply (lightweight semantic trigger layer).
- Add rate limiting per IP/user for tool calls.
- Add analytics event (gallery impression, show more clicks, product click).
- Introduce queryId in tool response for safer pagination validation.

## Quick Example
Request:
```
POST /api/assistant/chat
{
  "userId": "anon-123",
  "action": "tool:search_products",
  "toolInvocation": {
    "query": "red pattern wrap",
    "maxPrice": 1200,
    "limit": 6
  }
}
```
Response (truncated):
```
{
  "tool": "search_products",
  "data": {
    "page": 1,
    "limit": 6,
    "hasMore": true,
    "products": [ { "title": "Red Carbon Pillar Wrap", ... } ],
    "queryEcho": { "query": "red pattern wrap", "maxPrice": 1200, "keywords": ["red","pattern","wrap"] }
  }
}
```

---
Phase 1 complete. See TODO for pagination merging & upcoming tool additions.
