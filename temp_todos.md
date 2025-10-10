# Temp TODOs — Assistant Enhancements

1. **Order tracking by phone number**
   - Accept `phone` in `src/app/api/order/track/route.js`: sanitize digits, locate latest non-test order(s) by `address.receiverPhoneNumber`, handle multiple matches, and reuse existing Shiprocket hydration so response shape matches current `trackingData`.
   - Update `src/lib/assistant/orderStatus.js` to pass through `phone`, relax validation (allow phone digits), and surface meaningful errors when neither ID nor phone is usable.
   - Allow planner + tool plumbing to send phone-based lookups: extend `pruneToolArgs`, `summarizeToolResult`, and `composeToolReply` in `src/app/api/assistant/chat/route.js`; insert heuristics for phone detection in `ruleBasedPlan`, classification, and tool wiring.
   - Update client hook `src/hooks/useAssistantChat.js` so `detectOrderStatusIntent` emits a phone lookup, uses digits-only normalisation, and pipes that into the tool call/pagination state.

2. **Resolution confirmation improvements**
   - When users click “Yes” on resolution check, surface the freshest order snapshot (status + ETA/track link) instead of a generic thank-you.
   - Capture last tool payload in chat state so resolution handlers can reference it.

3. **Support request persistence polish**
   - Ensure `/api/support/request` returns and stores the assistant chat context: include `chatLogId` wiring, persist `threadId`, and keep API guardrails (import missing `mongoose` if needed).
   - In `submitPhone`, store returned `chatLogId`/support ticket id for potential UI follow-ups (even if hidden for now) and gracefully notify on failure.

4. **Animated loader revamp**
   - Replace existing loading pulse + black bar overlay in `src/components/Chat/SupportChatDialog.js` with a minimal glass-card spinner that cycles through curated phrases (orders, product search, category browse).
   - Define `loadingPhrases` such as “Gathering the latest courier updates…”, “Picking wraps that match your theme…”, rotate while `pendingAssistant` or `isResetting`.
   - Remove the dark moving lines from reset overlay and smooth out entry/exit easing.

5. **Template prompts refresh**
   - Update `templateSets` with richer, conversion-focused examples (e.g., “My car is red and my budget is ₹1000—what can I wrap?”) tuned per route, highlighting budget+theme combos that show bot strengths.

6. **Smarter product follow-ups**
   - Drop the static “Want me to show more?” bubbles. Instead, generate contextual follow-ups server-side in `composeToolReply` summarising why selections fit user colors/budget, referencing price tiers when available.
   - Ensure hook skips injecting legacy follow-up text, using server reply instead.

7. **Assistant knowledge enrichment**
   - Extend `src/app/api/assistant/helping-data/route.js` to compute per-specific-category reference pricing (first in-stock product or median) and append concise “Typical price starts ~₹X” lines so GPT can reason about budgets.

8. **Loader + phrase reuse across tooling**
   - Centralise loader phrase list in chat component, allow quick randomisation per request type (product search vs order tracking vs browse) so UI never shows repetitive “Thinking…” captions.

9. **General QA**
   - Regression test order tracking by ID and by phone, product search flows, reset animation, support request submission.
   - Update any snapshots/docs if behaviour changes (e.g., mention phone support + new loader in relevant readme if required).
