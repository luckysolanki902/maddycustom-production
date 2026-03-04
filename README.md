<div align="center">

<br/>

# MaddyCustom

**E-commerce platform for custom vehicle wraps and stickers.**

Built from scratch. No Shopify. No templates.
100K+ monthly users · ₹60L annual revenue · 10-person team.

The main domain ([maddycustom.com](https://maddycustom.com)) has since moved to Shopify.
This codebase — the original custom-built platform — is live at:

[maddycustom.vercel.app](https://maddycustom.vercel.app)

<br/>

</div>

<br/>

<div align="center">
<table>
<tr>
<td width="50%"><img src="https://maddycustom.vercel.app/images/githubss/hero.png" alt="Hero — Landing page" /></td>
<td width="50%"><img src="https://maddycustom.vercel.app/images/githubss/plp.png" alt="PLP — Product listing" /></td>
</tr>
<tr>
<td align="center"><sub>Landing page</sub></td>
<td align="center"><sub>Product listing</sub></td>
</tr>
<tr>
<td width="50%"><img src="https://maddycustom.vercel.app/images/githubss/pdp.png" alt="PDP — Product detail page" /></td>
<td width="50%"><img src="https://maddycustom.vercel.app/images/githubss/cart.png" alt="Cart & Checkout" /></td>
</tr>
<tr>
<td align="center"><sub>Product detail page</sub></td>
<td align="center"><sub>Cart & checkout</sub></td>
</tr>
<tr>
<td width="50%"><img src="https://maddycustom.vercel.app/images/githubss/chatbot.png" alt="AI Chatbot" /></td>
<td width="50%"><img src="https://maddycustom.vercel.app/images/githubss/track-order.png" alt="Track your order" /></td>
</tr>
<tr>
<td align="center"><sub>AI chatbot</sub></td>
<td align="center"><sub>Order tracking</sub></td>
</tr>
</table>
</div>

<br/>

---

<br/>

## Context

Started in 2022 when [Harshit Yadav](https://github.com/harshityadav) — the founder — spotted a market in custom bike wraps. I came on as co-founder and sole engineer; he handled the business. Within a year the product grew past what any off-the-shelf platform could support — custom offer engines, multi-provider payment failover, WhatsApp-first customer flows, and a 3-tier product hierarchy that doesn't map to any standard e-commerce template.

So I built the entire platform from scratch. Every API route, every model, every deployment decision.

The platform eventually served **100K+ monthly users**, generated **₹60L in annual revenue**, and ran on **under $30/month** in infrastructure costs (MongoDB ~$9, AWS ~$2, Vercel ~$20). Then Vercel changed their pricing — our bill jumped from $20 to $116. I optimised it down to $75, but the cost unpredictability, combined with growing payment gateway issues (Razorpay upstream bank downtimes), made the team decide to migrate to Shopify. Grow faster, spend less, fewer incidents to debug without a dedicated engineer. It was the right business call.

The main domain ([maddycustom.com](https://maddycustom.com)) now runs on Shopify. This codebase — the original custom-built platform — is still live at [maddycustom.vercel.app](https://maddycustom.vercel.app).

<br/>

---

<br/>

## Architecture

```
Next.js 15 (App Router) · Turbopack
├── 118 API route handlers
├── 38 Mongoose models
├── 18 Redux slices (11 persisted)
├── 503 source files
│
├── MongoDB Atlas (Atlas Search, Triggers)
├── AWS S3 + CloudFront (images, 10-year cache)
├── AWS SES (transactional email)
├── Firebase Auth (OTP phone login)
│
├── Razorpay + PayU (multi-provider payments)
├── Shiprocket (fulfillment + tracking)
├── Meta CAPI + Pixel (server-side event tracking)
├── AISensy (WhatsApp campaigns)
├── Twilio (SMS)
├── OpenAI Agents SDK (AI chatbot)
│
└── Vercel (deployment, edge middleware, serverless)
```

<br/>

---

<br/>

## Technical deep-dive

<br/>

### Payment orchestration — Razorpay + PayU failover

Not a simple "try one, then the other." The system actively monitors gateway health.

`decidePaymentProvider()` pings each provider's public status page API (Razorpay's and PayU's) and caches results with a **1-minute TTL**. If the preferred gateway shows `partial_outage` or `major_outage`, it falls back automatically. The decision metadata — preferred, recommended, reason, health snapshot — is stored on every order for debugging.

**PayU runs fully server-to-server (S2S)** — UPI intent URL extraction, card tokenization, net banking, wallets. Separate routes for each payment method. Hash computation and device fingerprinting handled server-side.

**Razorpay** uses client-side checkout with server-side order creation and webhook verification via `crypto.timingSafeEqual`.

Post-payment, a single **idempotent pipeline** runs: inventory deduction → coupon usage → Shiprocket order creation → WhatsApp notification → Meta CAPI purchase event → Google Ads conversion. All within a MongoDB transaction.

Split orders are supported — linked via `orderGroupId` and `linkedOrderIds` with payment amounts aggregated across parts.

**Payment modes**: online, 50/50 (50% online + 50% COD), 30/70 — each with configurable extra charges.

<br/>

### AI chatbot — OpenAI Agents SDK

Multi-agent architecture using `@openai/agents`. No regex routing — every message goes through an LLM classifier.

```
User message
  → Input guardrails
    → Classifier agent (gpt-4.1-nano, Zod-validated output)
      → DATA_QUERY     → Product search, order status, category browsing
      → VECTOR_STORE   → FAQ/policy retrieval via OpenAI file search
      → DIRECT_ANSWER  → General responses
      → HUMAN_HANDOFF  → Escalation to WhatsApp support
    → Output guardrails
      → Session persistence (MongoDB)
```

The **Data Query agent** has tool-use capabilities: `search_products` with filters/pagination/category diversity, `get_order_status`, `browse_categories` — all querying MongoDB directly.

The **Vector Store agent** uses OpenAI's `fileSearchTool()` against a hosted vector store containing return policies, installation guides, and care instructions.

Sessions are MongoDB-backed with context windowing, token budget management, and automatic conversation summarization after 10 messages.

The client-side hook (`useAssistantChat`, 607 lines) handles heuristic intent detection for product search, pagination ("show more", "next page"), price extraction, and category inference from natural language.

<br/>

### Meta Conversion API — 934 lines of server-side tracking

Full server-side event tracking for Facebook: `ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`, `Search`, `PageView`.

Advanced matching: SHA-256 hashing of PII (phone, email, name, external ID). Cookie-based `mc_external_id` extraction. `fbp`/`fbc` passthrough.

**IP extraction at the edge** — middleware reads the real client IP from `x-forwarded-for`, `cf-connecting-ip`, `x-vercel-forwarded-for`, and injects it as a custom header for the CAPI route. In-memory rate limiter (100 req/min/IP) with probabilistic cleanup.

Cron jobs generate and maintain Facebook Product Catalogs. Separate feeds for XML and CSV.

<br/>

### Search — MongoDB Atlas Search

Compound search using `$search` aggregation:

- Full-text across `title`, `mainTags`, `searchKeywords`
- Fuzzy matching (`maxEdits: 1`, `prefixLength: 1`)
- Wildcard matching for partial queries
- AND logic across query words, OR logic across fields
- Score boosting: title 3×, tags 2×, keywords 1.5×
- Availability filtering via `$lookup` on variant collections
- 10-minute result caching

<br/>

### Custom funnel analytics

Full-stack analytics engine tracking every step of the customer journey:

```
visit → view_product → add_to_cart → view_cart_drawer → open_order_form
  → address_tab → payment_tab → contact_info → payment_initiated → purchase
```

**Server** (548 lines): Zod-validated event ingestion, deterministic event IDs (hash of step + visitor + session + timestamp + payload) for deduplication.

**Client** (991 lines): `visitorId` + `sessionId` generation, page classification, automatic UTM capture, cart state tracking. Full UTM history persisted per user per order.

<br/>

### Shipping — Shiprocket integration

Automatic order creation in Shiprocket post-payment. Delivery webhook (418 lines) maps Shiprocket statuses to internal states:

```
pending → orderCreated → processing → shipped → onTheWay → delivered
                                                          → returned
                                                          → cancelled
```

Inventory restoration on cancellation. Reserved inventory clearing on delivery. Retry logic with exponential backoff for critical operations.

<br/>

### WhatsApp campaigns — AISensy

- **Abandoned cart recovery**: 2-stage campaigns. First at 30–60 min, follow-up for still-unpaid orders.
- **Review solicitation**: Automated post-delivery.
- **Campaign logging**: Per-message success/failure tracking with `CampaignLog` model.

<br/>

---

<br/>

## Data model — 38 Mongoose models

Key models and what they handle:

| Model | Purpose |
|-------|---------|
| **Order** (461 lines) | Items, dual payment details (Razorpay + PayU), split order linking, 12 delivery states, UTM + analytics metadata |
| **Product** | 3-tier hierarchy (category → specificCategory → variant), pageSlug routing, 13-digit uniqueNumericId, design templates |
| **Inventory** | Available/reserved quantities, reorder levels, back-in-stock detection via pre-save hooks |
| **Offer** | Condition engine (cart value, item count, first order, order count) with operators, action types (percent, fixed, bundle) |
| **Coupon** | Fixed/percentage discounts, min purchase, per-user usage limits, active periods |
| **Review** | Multi-scope (product, variant, category), admin vs user reviews, moderation pipeline |
| **AssistantSessionV2** | AI chat sessions — message history, tool calls, pagination state, token count, conversation summaries |
| **FunnelSession / FunnelEvent** | Visitor/session/UTM/device/geo tracking, full funnel event chain |
| **CampaignLog** | WhatsApp campaign tracking — send counts, per-message success/failure |
| **Notification** | Multi-channel (SMS, WhatsApp, email) with templates |

<br/>

---

<br/>

## State management

**Redux Toolkit + Redux Persist** with **18 slices**:

**Persisted** (survive page refresh): cart, orderForm, UTM params, variant preferences, UI state, display assets, B2B flow, notification state.

**Transient** (session-only): navigation, variant cache, chat context, checkout prefetch, user behavior tracking.

Persist key versioned at `root_v10` — incremented on breaking schema changes for safe migrations.

<br/>

---

<br/>

## Infrastructure

| Service | What it does | Cost |
|---------|-------------|------|
| **Vercel** | Hosting, serverless (512MB, 30–60s timeout), edge middleware | ~$20/mo |
| **MongoDB Atlas** | Database + Atlas Search + Triggers | ~$9/mo |
| **AWS S3 + CloudFront** | Image storage + CDN (10-year cache TTL) | ~$2/mo |
| **AWS SES** | Transactional email | Minimal |
| **Firebase** | OTP phone auth | Free tier |

**Total infrastructure: ~$30/month** serving 100K+ monthly users.

The edge middleware matcher is kept to exactly 6 paths to minimize Vercel edge invocations — a $22/month saving from being specific.

Image optimization: 10-year `minimumCacheTTL`, reduced device sizes (33–37% fewer transformations), WebP-only. All remote images via CloudFront.

<br/>

---

<br/>

## Testing

- **Playwright E2E** — API tests, PayU response processing tests, HTML reporter, failure screenshots + traces.
- **Lint** — ESLint + lint-staged on pre-commit.

<br/>

---

<br/>

## Stack

```
Frontend     Next.js 15 · React 18 · Redux Toolkit · MUI v6 · Framer Motion · Swiper
Backend      Next.js API Routes (118) · Mongoose · MongoDB Atlas
AI           OpenAI Agents SDK · GPT-4.1-nano · Vector Store file search
Payments     Razorpay · PayU (S2S seamless)
Shipping     Shiprocket
Messaging    AISensy (WhatsApp) · Twilio (SMS) · AWS SES (email)
Analytics    Custom funnel engine · Meta CAPI · Google Ads · GA4 · Microsoft Clarity
Storage      AWS S3 · CloudFront CDN
Auth         Firebase (phone OTP)
Infra        Vercel · MongoDB Atlas · AWS
Testing      Playwright
```

<br/>

---

<br/>

<sub>Built solo over 3 years. Every route, every model, every late-night production fix. The Shopify migration was the right business call — but this codebase is the engineering proof.</sub>