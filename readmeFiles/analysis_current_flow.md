# Analysis: Current Assistant Chat Flow (as of 2025-09-29)

This document captures how the chat system currently behaves, where it works well, and where it breaks down for certain queries.

## What exists today

- Dual-path handling in `src/app/api/assistant/chat/route.js`:
  - Explicit tools path (server-side):
    - `action === 'tool:search_products'` → sanitizes payload, calls `searchProducts(...)` or `categoryFirstSuggestions(...)` directly and returns structured JSON for the client.
    - `action === 'tool:get_order_status'` → calls `getOrderStatus(...)` and returns structured JSON.
  - Planner path (LLM pre-decision):
    - For free-form user messages, a small “planner” model receives function docs and returns a strict JSON decision `{ action: call_tool|direct_answer, tool, args }`.
    - If `call_tool`, the server executes the relevant tool and returns structured data; otherwise, it forwards messages to the OpenAI Assistant thread for a direct answer.

- Search implementation in `src/lib/assistant/productSearch.js`:
  - Keyword parsing with `extractKeywords(...)` that removes stopwords and generic terms.
  - Structural vs optional tokens.
  - Price hints and sorting hints (most-ordered and price asc/desc).
  - Category/variant availability gating; inventory gating based on `SpecificCategory.inventoryMode`.
  - Relaxed inventory fallback; popularity-based relaxed fallback; final `browse_categories` fallback.
  - Recent fix: Enforce category/variant availability also in the popularity-relaxed path; representative category picks respect variant availability and inventory stock.

- UI behavior:
  - Client can handle tool results for `search_products`, `get_order_status`, and `browse_categories`.
  - Category grid is shown either when the planner decides `browse_categories` or when the server search explicitly returns `fallback: 'browse_categories'`.

## Where it breaks or feels inconsistent

- Two separate paths: explicit tool calls vs planner-first. This leads to:
  - Inconsistent decisions: The explicit tool path can be triggered by the client and bypass the planner’s discretion.
  - Different user experiences for similar intents.

- Over-reliance on server heuristics for search:
  - Stopword filtering and structural token logic sometimes over-constrain or misinterpret generic queries (e.g., “show me all products you have”), causing unexpected direct product results instead of a category grid.
  - The same phrase can get different treatment depending on whether the client invoked the explicit tool or the planner was used.

- Messaging consistency:
  - The server returns structured tool data, but there isn’t a consistent step to craft a short, customized, user-facing summary for every response. Some replies are direct LLM answers; others are purely data payloads for UI.

## Summary of pain points

1. Split decision-making (explicit tools vs planner) → inconsistent outcomes.
2. Server-side stopwords/keyword heuristics are brittle for diverse phrasing.
3. Category browsing vs product search intent isn’t centrally decided by LLM for every request.
4. Lack of a small, unified “response composer” to tailor a message along with tool results.

## Constraints and observations

- We still need the structured tool responses for UI rendering (gallery, order card, category grid).
- We prefer to keep the Assistant thread for long-form knowledge answers and the small planner for decisions.
- We can keep `productSearch.js` and improve its inputs (from LLM) to reduce server-side guesswork.
