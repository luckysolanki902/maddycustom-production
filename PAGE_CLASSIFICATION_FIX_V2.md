# Page Classification Fix Summary

## Issue Identified
- FunnelSessions were showing product-id-page instead of product-list-page
- Classification logic was wrong - it was counting segments AFTER /shop
- The database fields were nested objects (page.pageCategory and landingPage.pageCategory)

## New Classification Logic
**Simple rule based on TOTAL segments:**
- `/`  **home**
- `/shop/wraps/car-wraps/fuel-cap-wraps` (4 parts)  **product-list-page**
- `/shop/wraps/car-wraps/fuel-cap-wraps/rectangle-petrol` (5 parts)  **product-id-page**
- Anything else  **other**

## Files Updated

### 1. `/src/app/api/admin/fix-page-classification/route.js`
- Changed to GET route (just visit URL to fix)
- Fixed classification: 4 segments = list, 5 segments = id
- Fixed field paths:
  - FunnelEvent: `page.path`  `page.pageCategory`
  - FunnelSession: `landingPage.path`  `landingPage.pageCategory`
- Processes ALL documents without limits

### 2. `/src/lib/analytics/pageClassifier.js`
- Updated `classifyShopPath()` function
- Now counts total segments instead of segments after /shop
- 4 parts = product-list-page
- 5 parts = product-id-page

## How to Use
Simply visit: `http://localhost:3000/api/admin/fix-page-classification`

The route will:
1. Process ALL FunnelEvents and update `page.pageCategory`
2. Process ALL FunnelSessions and update `landingPage.pageCategory`
3. Return statistics showing total processed and updated

## Test Results
All 8 test cases passed 
