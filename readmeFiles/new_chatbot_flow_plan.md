# New Chatbot Flow Plan – LLM-First, Single Path

Goal: Remove server heuristics from the critical path and let the LLM orchestrate every interaction through a single, consistent planner-first flow. Always return structured tool outputs and an optional, concise message (“response composer”).

## Principles

- Single entry path: Every user action (including client “tool” initiations) runs through the planner JSON decision step.
- No stopwords/keyword parsing on the server for intent; the LLM decides which function to call, with arguments.
- Server tools stay strict: enforce availability/inventory; return deterministic, well-typed JSON.
- Response composer: After tool execution, optionally ask a small LLM to produce a short user-facing message tailored to history and the tool outcome.

## Flow

1) Client → Server: always send `{ message, userId }` (and optionally context snapshot). Do not call tools directly from client.

2) Server Planner (JSON-only): Provide function catalog docs. The planner returns strictly one of:
   - `{ action: 'call_tool', tool: 'search_products' | 'get_order_status' | 'browse_categories', args, reason }`
   - `{ action: 'direct_answer', reason }`

3) Execute:
   - If `call_tool`, run the selected tool with sanitized args.
   - If `direct_answer`, forward to Assistant thread for the answer.

4) Response Composer (optional, short):
   - For tool results, run a small completion to generate a brief, personalized sentence that references the user request and result (e.g., “Here are window pillar wraps. Want me to sort by most ordered?”).
   - Keep under ~40–70 words; no markdown.

5) Return unified payload to client:
   - `{ tool: 'search_products'|'get_order_status'|'browse_categories'|null, data, reply, threadId }`
   - `reply` is the message from Response Composer or Assistant answer; `data` is the structured tool payload.

## Function Catalog (given to Planner)

- search_products(args): { query?, maxPrice?, minPrice?, categoryTitle?, page?, limit?, keywords?, sortBy? }
- get_order_status(args): { orderId }
- browse_categories(args): {}

The planner is encouraged to:
- Pick `browse_categories` for generic browse (“all products”, “show products”) unless the user references a category or specific product concept.
- Use `search_products` when there’s a concrete request (keywords, category, price, sort).
- Use `get_order_status` only when a valid order ID is present or the user clearly asks for tracking.

## Migration Steps

- Remove explicit client tool invocations; have client always POST `message`.
- Keep the existing planner block but apply it to all requests (including the ones coming from the previous explicit tool branch).
- Add Response Composer for tool results.
- Optionally keep the explicit tool routes for internal/testing, but mark them deprecated and pass them through the planner internally if used.

## Edge Cases

- Empty planner or invalid JSON → default to `browse_categories` with a polite prompt.
- Planner picks `search_products` but args too vague → allow the tool to return zero and then fallback to `browse_categories`, and mention it in the composer message.
- Order ID mis-detected → prefer planner judgment, not server regex; still allow a safety short-circuit when it’s a perfect 24-hex match.
