# Page Classification Fix

## Problem
The page classification logic was incorrectly categorizing product listing pages as product detail pages. URLs like:
- `/shop/wraps/car-wraps/fuel-cap-wraps` (should be **product-list-page**)
- `/shop/wraps/car-wraps/window-pillar-wraps/win-wraps` (should be **product-id-page**)

Were being misclassified.

## Solution
Updated the classification logic in `src/lib/analytics/pageClassifier.js` to use a simple rule:

### New Classification Logic:
- **Home**: `/` → `home`
- **Product List**: `/shop` + 0-3 segments → `product-list-page`
  - `/shop` (0 segments after shop)
  - `/shop/wraps` (1 segment after shop)
  - `/shop/wraps/car-wraps` (2 segments after shop)
  - `/shop/wraps/car-wraps/fuel-cap-wraps` (3 segments after shop)
- **Product Detail**: `/shop` + 4+ segments → `product-id-page`
  - `/shop/wraps/car-wraps/fuel-cap-wraps/rectangle-petrol` (4 segments after shop)
- **Other**: Everything else → `other`

## Fixed Documents in Database

To fix existing documents with wrong classifications, use the admin route:

### 1. Analyze (Check what needs fixing):
```bash
POST /api/admin/fix-page-classification
Content-Type: application/json

{
  "action": "analyze"
}
```

**Response:**
```json
{
  "analysis": {
    "eventsNeedingFix": 1234,
    "sessionsNeedingFix": 567,
    "eventsSample": [...],
    "sessionsSample": [...]
  }
}
```

### 2. Fix (Update documents):
```bash
POST /api/admin/fix-page-classification
Content-Type: application/json

{
  "action": "fix",
  "limit": 1000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Page classification fixed",
  "stats": {
    "events": {
      "processed": 1000,
      "updated": 856,
      "errors": 0
    },
    "sessions": {
      "processed": 1000,
      "updated": 432,
      "errors": 0
    }
  }
}
```

### 3. Run multiple times if needed:
If you have more than 1000 documents, run the fix endpoint multiple times until all documents are updated.

## Testing

Run the test script to verify the classification logic:

```bash
node scripts/test-page-classifier.js
```

All tests should pass ✓

## Updated Collections

Both collections will be updated:
- **FunnelEvent**: `page.pageCategory` and `page.name`
- **FunnelSession**: `landingPage.pageCategory` and `landingPage.name`

## Verification

After running the fix, verify the results:

```javascript
// Check unique categories in FunnelEvent
db.funnelevents.distinct('page.pageCategory')
// Should return: ['home', 'product-list-page', 'product-id-page', 'other']

// Count documents by category
db.funnelevents.aggregate([
  { $group: { _id: '$page.pageCategory', count: { $sum: 1 } } }
])
```

Now `product-list-page` should appear in your data! 🎉
