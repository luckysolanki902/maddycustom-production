# Analysis: Current Assistant Chat Flow (as of 2025-10-11)

This document captures how the chat system currently behaves, where it works well, and where it breaks down for certain queries.

## What exists today

- Single-path handling in `src/app/api/assistant/chat/route.js`:
  - Every request is normalised into a planner prompt (client tool actions are just metadata) and evaluated by a lightweight planner unless strong search intent is detected.
  - A `extractSearchHints(...)` helper now inspects the raw user message to detect colours, relations (“dad”), budgets (“300 rs”), and vehicle references. When those hints are strong enough the server forces a `search_products` plan even before the planner runs, guaranteeing tool execution for clearly shoppable queries.
  - Planner-produced `classification` metadata is normalised and reused so we do not fire an extra classification completion per turn.
  - Tool executions (`search_products`, `browse_categories`, `get_order_status`) log structured telemetry and persist chat history via `AssistantChatLog`.

- Search implementation in `src/lib/assistant/productSearch.js`:
  - Keyword parsing with `extractKeywords(...)` that removes stopwords and generic terms.
  - Structural vs optional tokens.
  - Price hints and sorting hints (most-ordered and price asc/desc).
  - Category/variant availability gating; inventory gating based on `SpecificCategory.inventoryMode`.
  - Relaxed inventory fallback; popularity-based relaxed fallback; final `browse_categories` fallback.
  - Recent fix: Enforce category/variant availability also in the popularity-relaxed path; representative category picks respect variant availability and inventory stock.

- Response composition:
  - Tool replies no longer call a second OpenAI endpoint. Instead deterministic helpers craft concise summaries (e.g., “Pulled top 6 matches like … Using keywords …”). This shaved ~4–6s from tool latency in dev and keeps copy consistent.

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

1. Split decision-making (explicit tools vs planner) → **resolved** by collapsing into a single planner flow with pre-planner overrides.
2. Server-side stopwords/keyword heuristics were brittle → mitigated by `extractSearchHints` that maps budgets/colours/domains directly into planner args.
3. Category browsing vs product search intent now benefits from both planner judgement and hint-based overrides; remaining edge cases involve mixed queries (policy + product) that still require tuning.
4. Lack of unified “response composer” → resolved with deterministic summaries, eliminating an extra model hop.

## Constraints and observations

- We still need the structured tool responses for UI rendering (gallery, order card, category grid).
- We prefer to keep the Assistant thread for long-form knowledge answers and the small planner for decisions.
- `productSearch.js` remains the execution engine; we now focus on richer args to remove guesswork while keeping deterministic sanitisation in place.
- Persisting chat logs requires the Mongoose model to be available under both default and named exports when bundled; defensive guards were added so Turbopack dev builds stop throwing on `.findOneAndUpdate`.
