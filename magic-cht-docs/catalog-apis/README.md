# Shiprocket Catalog API – Delivery Contract

## Base Path
`/api/shiprocket/catalog`

## Authentication
None (public for Shiprocket ingestion; add HMAC once credentials are issued).

## Pagination
- Query params: `page` (default `1`), `limit` (default `100`, max `250`).
- Responses use `{ "data": { "total": <number>, ... } }`.

## Endpoints

### 1. `GET /products`
- Optional query: `collection_id` (Specific Category ObjectId string) to filter products by Shiprocket collection.
- Returns Shopify-style payload:
  ```json
  {
    "data": {
      "total": 123,
      "products": [
        {
          "id": "66fe...",
          "title": "UltraGloss Bike Wrap",
          "body_html": "<p>High gloss finish...</p>",
          "vendor": "Maddy Custom",
          "product_type": "Bike Wraps",
          "created_at": "2025-01-02T10:34:11.000Z",
          "updated_at": "2025-03-14T07:22:01.000Z",
          "handle": "wraps/ultragloss-bike",
          "status": "active",
          "tags": "bike, wrap, gloss",
          "variants": [
            {
              "id": "66fe...",
              "title": "UltraGloss Bike Wrap",
              "price": "2499.00",
              "compare_at_price": "2999.00",
              "sku": "MD-BW-UG-01",
              "quantity": 25,
              "taxable": true,
              "option_values": { "Variant": "UltraGloss Bike Wrap" },
              "grams": 1800,
              "weight": 1.8,
              "weight_unit": "kg",
              "image": { "src": "https://d26w01jhwuuxpo.cloudfront.net/assets/.../thumb.jpg" }
            }
          ],
          "options": [
            {
              "name": "Variant",
              "values": ["UltraGloss Bike Wrap"]
            }
          ],
          "image": { "src": "https://d26w01jhwuuxpo.cloudfront.net/assets/.../hero.jpg" }
        }
      ]
    }
  }
  ```
- Data prep: filters out products/specific categories/variants marked unavailable; weights & dimensions come from `getDimensionsAndWeight` packaging logic. Every required field from the Shiprocket example is returned (falling back to blank strings or zero values where data is missing) including `status`, `variants[].created_at`, `variants[].updated_at`, `variants[].option_values`, `variants[].taxable`, and top-level `image` objects.

### 2. `GET /products/by-collection`
- Requires `collection_id` query param (Specific Category ObjectId string).
- Wrapper around `/products` to mirror Shiprocket documentation; identical response structure.

### 3. `GET /collections`
- Lists available Specific Categories as Shiprocket collections.
- Response example:
  ```json
  {
    "data": {
      "total": 12,
      "collections": [
        {
          "id": "66ab...",
          "title": "Bike Wraps",
          "handle": "wraps/bike",
          "body_html": "<p>Premium wraps for two-wheelers.</p>",
          "created_at": "2024-08-11T09:10:17.000Z",
          "updated_at": "2025-03-10T05:44:20.000Z",
          "image": { "src": "https://d26w01jhwuuxpo.cloudfront.net/assets/.../bike-card.jpg" }
        }
      ]
    }
  }
  ```

## Data Rules
- IDs are deterministic 64-bit integers derived from the Mongo ObjectId (safe for Shiprocket’s “long” requirement). Shiprocket should reuse the received numeric IDs for subsequent API calls and webhooks.
- Images are normalized against `NEXT_PUBLIC_CLOUDFRONT_BASEURL` with `https://d26w01jhwuuxpo.cloudfront.net` fallback.
- `quantity` resolves from `Inventory.availableQuantity`, default `0`.
- `tags` join the product’s `mainTags` with commas; blank string otherwise.
- `body_html` draws from variant/product descriptions in priority order and is wrapped in a single paragraph tag.
- Missing textual fields output `""` and image objects default to `{ "src": "" }` to satisfy Shiprocket’s “all keys present” requirement.
