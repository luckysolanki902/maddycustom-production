# Shiprocket Magic Checkout Integration Plan

## Research Highlights
- **Shiprocket Checkout docs** demand three seller-managed catalog APIs (products list, collections list, products filtered by collection) with strict field names, pagination, and blank-string fallbacks. All responses wrap payloads inside a `data` object. Webhooks and checkout/token steps follow later phases.
- **Authentication**: current phase exposes endpoints without auth, but headers like `X-Api-Key`/`X-Api-HMAC-SHA256` will be required for webhook handling and future server-to-server calls.
- **Product eligibility rules**: Only include catalog entries when the product, its specific category, and linked specific category variant have `available = true`. Weight/dimension data must align with Shiprocket fulfilment maths already implemented in `src/lib/utils/shiprocket.js`.
- **Metadata parity**: Existing feeds (e.g. `meta/pixel-products-xml`) demonstrate canonical naming, pricing, and image URL assembly using the CloudFront base URL. These patterns must stay consistent so downstream analytics and creatives remain aligned.

## Catalog API Blueprint
- **Endpoints** (all under `/api/shiprocket/catalog`):
  1. `GET /products` – paginated master list. Supports optional `collection_id` for future reuse and query params `page` / `limit` (defaults `page=1`, `limit=100`, cap at 250).
  2. `GET /products/by-collection` – wrapper around the same data fetch but requires `collection_id` (mirrors doc examples for clarity).
  3. `GET /collections` – paginated list of available specific categories exposed as Shiprocket "collections".
- **Response schema**:
  - Wrap all payloads in `{ "data": { ... } }`.
  - Each product exposes Shopify-like fields: `id`, `title`, `body_html`, `vendor`, `product_type`, `created_at`, `updated_at`, `handle`, `status`, `tags`, `variants`, `options`, `image`.
  - `variants` array contains at least one entry with pricing, SKU, weight (kg + grams), quantity (from `Inventory.availableQuantity` fallback to `0`), and associated imagery. `taxable` defaults to `true`.
  - `collections` expose `id`, `title`, `handle`, `body_html`, `created_at`, `updated_at`, `image`.
- **Data sourcing & transforms**:
  - `Product` model drives core details; populate `specificCategory`, `specificCategoryVariant`, `brand`, and `inventoryData` to enrich results.
  - `id` fields use the Mongo ObjectId string to preserve determinism (Shiprocket consumers will receive the string IDs they must echo back in subsequent requests).
  - `body_html` prefers `specificCategoryVariant.productDescription`, then `specificCategoryVariant.description`, then product `title` wrapped in `<p>`.
  - `vendor` resolves from `Brand.name`; otherwise fall back to `Maddy Custom`.
  - `product_type` maps to `specificCategory.name` (fallback to product `category`).
  - Images resolve via helper ensuring absolute URLs against `NEXT_PUBLIC_CLOUDFRONT_BASEURL` with CloudFront fallback.
  - Weight/dimension data derives from `getDimensionsAndWeight([{ product: product._id, quantity: 1 }])`; gracefully degrade to zeroes if packaging config missing.
- **Filtering**:
  - Exclude products when `available` is false at product, specific category, or variant level.
  - Exclude records missing both CloudFront-ready imagery and pricing to avoid downstream rejections.
- **Error handling**:
  - Bad query params (non-numeric pagination, invalid `collection_id`) return `400` with descriptive text.
  - Internal errors respond `500` with logged context (no stack leak).

## Implementation Tasks
1. **Utilities**: add `src/lib/shiprocket/catalog/helpers.js` (image normalization, HTML shaping, packaging lookup wrappers, pagination sanitizer).
2. **Products endpoint**: implement `/api/shiprocket/catalog/products/route.js` leveraging helpers, including optional `collection_id` filtering.
3. **Collections endpoint**: implement `/api/shiprocket/catalog/collections/route.js` mirroring Shiprocket schema.
4. **By-collection endpoint**: implement `/api/shiprocket/catalog/products/by-collection/route.js` delegating to core fetcher.
5. **Shared formatter tests**: craft lightweight integration tests or manual script (if time) ensuring schema compliance and filtering logic.
6. **Docs**: append endpoint usage summary to `magic-cht-docs/catalog-apis/README.md` (post-implementation) for Shiprocket handoff.

## Future Phases (Post Catalog)
- Checkout token generation & iframe embed (replace legacy `OrderForm` with Magic Checkout).
- Webhook ingestion for orders + catalog updates, including HMAC verification.
- Loyalty wallet bridge & analytics hooks to keep Meta/GA funnels intact.

## Next Step
Proceed with task 1–4: build reusable helpers and implement the catalog API routes with the exact response contract described above.
