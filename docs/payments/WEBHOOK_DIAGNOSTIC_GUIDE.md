# Webhook Diagnostic Guide

## Overview

This guide helps you diagnose issues with payment webhooks and client-side tracking data capture. Based on the analysis of your order, we've identified that **analyticsInfo is completely null**, which means tracking data wasn't captured during order creation.

## Your Order Analysis

**Order ID**: `6925a89344746ebd3963ae47`

### Current State
```json
{
  "analyticsInfo": {
    "ip": null,
    "userAgent": null,
    "externalId": null,
    "fbp": null,
    "fbc": null,
    "gaClientId": null,
    "capturedAt": null,
    "sourceUrl": null
  }
}
```

**Problem**: All tracking data is missing! This will result in:
- ❌ Poor Meta CAPI event quality score
- ❌ Lower Facebook ad performance
- ❌ Inaccurate attribution
- ❌ Reduced conversion tracking effectiveness

## Diagnostic Steps

### 1. Check Browser Console Logs

When creating an order, you should see these console logs in your browser's developer console:

```
📊 [ORDER FORM] Capturing fresh client tracking data before payment...

============================================================
📊 Starting Client Tracking Data Capture
============================================================
✅ Basic data captured: {...}

🌐 Fetching client IP address...
✅ IP Address: 103.x.x.x

🖥️ Capturing user agent...
✅ User Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)...

🔑 Getting or generating external ID...
✅ Generated External ID from FBP: fb.1.xxxxx

📘 Extracting Facebook Pixel data...
✅ Facebook FBP: fb.1.xxxxx
ℹ️ Facebook FBC cookie not found (normal if no FB ad click)

📊 Extracting Google Analytics Client ID...
✅ GA Client ID: xxxxx.xxxxx

============================================================
✅ Client Tracking Data Capture Complete
============================================================
Final tracking data: {
  "ip": "103.x.x.x",
  "userAgent": "Mozilla/5.0...",
  "externalId": "fb.1.xxxxx",
  "fbp": "fb.1.xxxxx",
  "fbc": null,
  "gaClientId": "xxxxx.xxxxx",
  "capturedAt": "2025-11-25T13:01:07.168Z",
  "sourceUrl": "https://www.maddycustom.com/checkout"
}
============================================================

✅ [ORDER FORM] Tracking metadata captured successfully!
```

**If you DON'T see these logs:**
- The tracking capture function is not being called
- You may be testing on server-side rendered page
- JavaScript error is preventing execution
- Browser is blocking the tracking script

### 2. Check for JavaScript Errors

Open browser console and look for any errors before order creation:
```javascript
// Look for errors like:
❌ [ORDER FORM] FAILED to capture tracking metadata
Error: ...
```

### 3. Verify Browser Environment

Tracking capture requires:
- ✅ Browser environment (not server-side)
- ✅ JavaScript enabled
- ✅ No ad blockers blocking cookies or ipify.org
- ✅ Cookies enabled
- ✅ sessionStorage available

### 4. Check Webhook Logs

After payment success, the webhook should log analytics info status.

**For PayU Webhook** (`/api/payu/payment-response`):
```
================================================================================
[11/25/2025, 01:01:07 PM] 🔔 PayU Webhook Received
================================================================================
Transaction ID: MADDY-xxx-xxx
Payment Status: success
Amount: 1
...
================================================================================

[11/25/2025, 01:01:07 PM] 📦 Found 1 Orders
  Main Order ID: 6925a89344746ebd3963ae47
  - Payment Status: pending
  - Delivery Status: pending
  - Testing Order: true
  - Inventory Deducted: false

[11/25/2025, 01:01:07 PM] 📊 Analytics Info Status:
  ✅ IP Address: 103.x.x.x
  ✅ User Agent: Present
  ✅ External ID: fb.1.xxxxx
  ✅ Facebook FBP: fb.1.xxxxx
  ⚠️ Facebook FBC: MISSING (normal if no FB ad)
  ✅ GA Client ID: xxxxx.xxxxx
  ✅ Captured At: 2025-11-25T13:01:07.168Z
  ✅ Source URL: https://www.maddycustom.com/checkout
  ✅ All critical tracking data captured successfully
```

**For Razorpay Webhook** (`/api/webhooks/razorpay/verify-payment`):
Same format as above (centralized logging).

### 5. What You Should See vs What's Missing

#### ✅ Good Order (All Tracking Captured)
```json
{
  "analyticsInfo": {
    "ip": "103.147.184.238",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
    "externalId": "fb.1.1732544234567.1234567890",
    "fbp": "fb.1.1732544234567.1234567890",
    "fbc": "fb.1.1732544234567.fbclid123abc",
    "gaClientId": "1234567890.1732544234",
    "capturedAt": "2025-11-25T13:01:07.168Z",
    "sourceUrl": "https://www.maddycustom.com/checkout"
  }
}
```

Webhook logs will show:
```
✅ All critical tracking data captured successfully
✅ Meta Purchase event sent successfully via CAPI
```

#### ❌ Bad Order (No Tracking Captured - Your Case)
```json
{
  "analyticsInfo": {
    "ip": null,
    "userAgent": null,
    "externalId": null,
    "fbp": null,
    "fbc": null,
    "gaClientId": null,
    "capturedAt": null,
    "sourceUrl": null
  }
}
```

Webhook logs will show:
```
❌ NO ANALYTICS INFO OBJECT - All tracking data missing!
❌ This will result in very poor Meta CAPI event quality
❌ Check OrderForm.js tracking capture implementation
⚠️ No analyticsInfo available, skipping Meta CAPI event
```

## Common Issues and Solutions

### Issue 1: Browser Console Shows Nothing
**Problem**: No tracking capture logs appear in browser console

**Possible Causes**:
1. Page is being server-side rendered
2. JavaScript not loaded yet
3. Order creation is happening too fast

**Solution**:
- Ensure you're on the client-side (check `typeof window !== 'undefined'`)
- Add delays if needed
- Check browser console is open and monitoring correct tab

### Issue 2: IP Address is Null
**Problem**: `ip: null` in tracking data

**Possible Causes**:
1. ipify.org API is blocked (ad blockers, firewall)
2. Network timeout
3. CORS issues

**Solution**:
```javascript
// Check if ipify.org is accessible
fetch('https://api.ipify.org?format=json')
  .then(r => r.json())
  .then(d => console.log('IP:', d.ip))
  .catch(e => console.error('IP fetch failed:', e));
```

**Workaround**: IP will be captured from request headers on server-side as fallback (if implemented)

### Issue 3: Facebook Pixel Cookies Missing
**Problem**: `fbp: null` or `fbc: null`

**Possible Causes**:
1. Facebook Pixel not loaded on site
2. User has ad blockers
3. Cookies disabled
4. User never came from Facebook ad (fbc only)

**Solution**:
```javascript
// Check cookies manually
document.cookie.split(';').forEach(c => console.log(c.trim()));
// Look for _fbp and _fbc
```

**Note**: `fbc` missing is normal if user didn't click a Facebook ad. `fbp` should be present if Facebook Pixel is working.

### Issue 4: Google Analytics Client ID Missing
**Problem**: `gaClientId: null`

**Possible Causes**:
1. Google Analytics not installed
2. GA4 cookie format different
3. Cookies disabled

**Solution**:
```javascript
// Check GA cookies
document.cookie.split(';').forEach(c => {
  if (c.includes('_ga')) console.log(c.trim());
});
```

### Issue 5: External ID Generation Failed
**Problem**: `externalId: null`

**Possible Causes**:
1. sessionStorage disabled
2. crypto.randomUUID() not available
3. FBP fallback also failed

**Solution**:
- Check browser supports crypto.randomUUID()
- Enable sessionStorage
- Code has fallback to generate random ID

### Issue 6: Tracking Capture Throws Error
**Problem**: Console shows error in tracking capture

**Solution**:
Check the detailed error logs:
```
❌ CRITICAL ERROR in captureClientTrackingData
Error: [error message]
Stack: [stack trace]
```

Common errors:
- `TypeError: Cannot read property 'userAgent' of undefined` - Navigator not available
- `ReferenceError: crypto is not defined` - Running in old browser
- `DOMException: Failed to fetch` - Network/CORS issue with ipify.org

## Testing Checklist

Before deploying to production:

### Client-Side Testing
- [ ] Open browser developer console
- [ ] Navigate to checkout page
- [ ] Fill out order form
- [ ] Click to create order
- [ ] Verify you see detailed tracking capture logs
- [ ] Verify tracking data is not null
- [ ] Verify IP address is captured
- [ ] Verify user agent is present
- [ ] Verify external ID is generated
- [ ] Check if Facebook cookies exist (_fbp, _fbc)
- [ ] Check if GA cookie exists

### Server-Side Testing (After Order Creation)
- [ ] Check MongoDB order document has analyticsInfo populated
- [ ] Process payment (PayU or Razorpay)
- [ ] Check webhook logs for analytics info status
- [ ] Verify webhook shows "✅ All critical tracking data captured successfully"
- [ ] Verify "✅ Meta Purchase event sent successfully via CAPI"
- [ ] Check Meta Events Manager for event with good match quality

### Meta Events Manager Verification
1. Go to Facebook Events Manager
2. Select your Pixel
3. Go to "Test Events" or "Events" tab
4. Look for Purchase event
5. Check "Event Match Quality" score
6. Verify these parameters are present:
   - ✅ `client_ip_address`
   - ✅ `client_user_agent`
   - ✅ `fbp`
   - ✅ `external_id`
   - ✅ User data (email, phone, name, city, etc.)

## Quick Fix for Your Issue

Based on your order showing all null values, try these steps:

### Step 1: Clear Browser Cache and Storage
```javascript
// In browser console:
sessionStorage.clear();
localStorage.clear();
location.reload();
```

### Step 2: Test Order Creation with Console Open
1. Open browser dev tools (F12)
2. Go to Console tab
3. Navigate to checkout page
4. Fill order form
5. Click create order
6. **Watch for tracking capture logs**

### Step 3: Check for Ad Blockers
- Disable ad blockers temporarily
- Whitelist your domain
- Check if ipify.org is accessible

### Step 4: Test Tracking Function Directly
Open browser console and run:
```javascript
// Test tracking capture function
const { captureClientTrackingData } = await import('/src/lib/analytics/trackingCapture.js');
const data = await captureClientTrackingData();
console.log('Tracking data:', data);
```

### Step 5: Verify Implementation in OrderForm.js
Check that OrderForm.js has:
1. Import at top:
   ```javascript
   import { captureClientTrackingData } from '@/lib/analytics/trackingCapture';
   ```

2. Capture before order creation (around line 1144-1170):
   ```javascript
   let trackingMetadata = null;
   try {
     console.log('\n📊 [ORDER FORM] Capturing fresh client tracking data before payment...');
     trackingMetadata = await captureClientTrackingData();
     // ... more logs
   } catch (trackingError) {
     console.error('❌ [ORDER FORM] FAILED to capture tracking metadata');
     // ... error handling
   }
   ```

3. Include in order payload (around line 1202):
   ```javascript
   analyticsInfo: trackingMetadata,
   ```

## Monitoring in Production

### Key Metrics to Track

1. **Tracking Capture Success Rate**
   - Target: >95% of orders have non-null analyticsInfo
   - Query: Count orders where `analyticsInfo.ip != null`

2. **Meta CAPI Event Delivery Rate**
   - Target: >90% webhook logs show "✅ Meta Purchase event sent successfully"
   - Check webhook logs for success messages

3. **Event Match Quality Score**
   - Target: 6.0+ out of 10
   - Check in Meta Events Manager

4. **Individual Field Capture Rates**
   - IP: Target >99% (should always work)
   - User Agent: Target >99% (should always work)
   - External ID: Target >99% (fallback generation)
   - FBP: Target >60% (depends on Pixel installation)
   - FBC: Target >10% (only for FB ad clicks)
   - GA Client ID: Target >80% (depends on GA installation)

### Setting Up Alerts

Monitor these error patterns in webhook logs:

**Critical Alerts** (page someone immediately):
```
❌ NO ANALYTICS INFO OBJECT - All tracking data missing!
```

**Warning Alerts** (review daily):
```
⚠️ WARNING: 3+ critical tracking fields are missing!
⚠️ No analyticsInfo available, skipping Meta CAPI event
⚠️ Meta Purchase event failed: [error]
```

## Related Documentation

- [Centralized Webhook Implementation](./CENTRALIZED_WEBHOOK_IMPLEMENTATION.md)
- [Webhook Logs Reference](./WEBHOOK_LOGS_REFERENCE.md)
- [Client Tracking Integration](./CLIENT_TRACKING_INTEGRATION.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)

## Support

If you're still seeing null analyticsInfo after following this guide:

1. Share your browser console logs (full output from tracking capture)
2. Share webhook logs from your server
3. Specify which browser and version you're testing with
4. Check if you're using any privacy-focused browser extensions

The detailed logging added to the system should make it very clear where the issue is occurring.
