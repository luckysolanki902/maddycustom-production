# Fast Checkout: Data Contracts & Caching

## Cart Signature
- Input: array of `{ productId, optionId, quantity }`, sorted stable, plus `couponCode` (if any).
- Canonical JSON -> SHA-256 (or fast murmurhash) -> `cartSignature` string.

## LocalStorage Keying
- Namespace: `mc:checkoutPrefetch:<signature>`
- Value schema:
```json
{
  "version": 1,
  "signature": "<cartSignature>",
  "expiresAt": 1730000000000,
  "createdAt": 1730000000000,
  "inventory": {
    "excludedKeys": ["<key>", "<key>"]
  ,  "itemsInfo": {"<key>": {"productId": "..", "optionId": "..", "quantity": 1, "reason": "OUT_OF_STOCK"}},
    "expiresAt": 1730000000000
  },
  "coupon": {
    "code": "<string>",
    "valid": true,
    "discountType": "flat|percent",
    "discountValue": 150,
    "message": "<localized>"
  },
  "paymentModes": {
    "list": [
      {"name": "online", "extraCharge": 0},
      {"name": "cod", "enabled": true, "min": 0, "max": 5000}
    ],
    "default": "online"
  },
  "serviceability": {
    "pincode": "<string>",
    "codAllowed": true,
    "etaDays": 3
  }
}
```

## TTL & Refresh
- Top-level `expiresAt = now + 120s`.
- Read path: if not expired and signature matches, return; also schedule a background refresh (non-blocking) to extend freshness.
- Write path: atomically update entry; keep `createdAt` for metrics.

## Redux Bridge
- Minimal state under `orderForm` or a new `checkoutPrefetch` slice:
```ts
{
  status: 'idle' | 'pending' | 'ready' | 'partial' | 'failed',
  signature: string | null,
  lastUpdated: number,
  errors: {
    inventory?: string,
    coupon?: string,
    paymentModes?: string,
    serviceability?: string
  }
}
```
- `cartSlice.inventoryGate` continues to be source for excluded items in UI totals. On CPO success, dispatch `setInventoryGate({ ... , cartSignature })` with a TTL aligned to cache.

## Invalidation Rules
- New signature -> clear old ready state; start fresh prefetch.
- Manual coupon change -> new signature -> prefetch coupon and inventory again.
- Cart empty -> clear cache pointer, no prefetch.
- Hard errors -> mark `failed`, expose retry.
