# Meta Pixel Test Page - Complete Guide

## Overview
The Meta Pixel Diagnostics page is a comprehensive internal tool for validating the complete Meta Pixel + CAPI integration. Designed for both technical and marketing teams.

**URL:** `http://localhost:3000/test/ip-extraction` (development)  
**URL:** `https://maddycustom.com/test/ip-extraction` (production)

---

## Features

### 1. **Password Protection** 🔒
- **Access Required:** Page is locked with password authentication
- **Password:** Stored in `.env.local` as `ADMIN_TEST_PASSWORD`
- **Default Password:** `maddy2025secure` (change this!)
- **Session Duration:** 1 hour unlock session
- **Storage:** Uses `localStorage` to persist authentication
- **Security:** Server-side verification via `/api/test/verify-password`

### 2. **Auto-Redirect with Test Parameters** 🔄
- **Automatic:** Page auto-redirects on first load to add test query params
- **Simulates Ad Traffic:** Adds realistic tracking parameters:
  - `_fbp` - Facebook Browser ID
  - `_fbc` - Facebook Click ID  
  - `fbclid` - Facebook Click Identifier
  - `utm_source=facebook`
  - `utm_medium=cpc`
  - `utm_campaign=test_campaign`
  - `test_mode=true`
- **Purpose:** Triggers middleware cookie capture logic
- **Result:** Improves match quality scores to realistic levels

### 3. **Full Event Suite Testing** 📊
Tests all critical Meta events in sequence:

1. **PageView** - User views a page
2. **ViewContent** - User views a product
3. **AddToCart** - User adds item to cart
4. **InitiateCheckout** - User starts checkout
5. **Purchase** - User completes purchase

Each event:
- Fires to both **Facebook Pixel** (client-side)
- Fires to **CAPI** (server-side)
- Uses same **eventID** for deduplication
- Includes realistic test data (fake products, prices, etc.)
- Validates deduplication is working

### 4. **Full-Page Loader** ⏳
- **Beautiful Loading Screen:** Shows during test execution
- **Dynamic Status Messages:** "Testing PageView event...", etc.
- **Progress Indicator:** Linear progress bar
- **Professional Design:** Grayscale theme with brand color

### 5. **Comprehensive Dashboard** 📈

#### **Overall Health Score (0-100)**
Calculated from:
- **25%** - Pixel event success rate
- **25%** - CAPI event success rate  
- **30%** - Deduplication success rate
- **20%** - Average match quality score

Color-coded:
- **Green (80-100):** Excellent health
- **Yellow (60-79):** Needs improvement
- **Red (0-59):** Critical issues

#### **Key Metrics Cards**
- **Pixel Events:** X/5 successfully fired
- **CAPI Events:** X/5 successfully received
- **Deduplicated:** X/5 matched via eventID
- **Avg Match Quality:** X.X/10 score

#### **Event Results Table**
| Event | Pixel | CAPI | Deduplicated | Match Quality | Event ID |
|-------|-------|------|--------------|---------------|----------|
| PageView | ✓ | ✓ | ✓ | 8/10 | abc123... |
| ViewContent | ✓ | ✓ | ✓ | 8/10 | def456... |
| ... | ... | ... | ... | ... | ... |

- **Icon Status:** Green checkmark = success, red X = failure
- **Match Quality Chips:** Color-coded (green/yellow/red)
- **Event ID:** First 20 characters displayed

#### **Detailed Analysis Accordions**
Each event has expandable section showing:
- **Pixel Data:** Full parameters sent to Facebook Pixel
- **CAPI Response:** Server response with debug info
- **Match Quality Breakdown:** Score components
- **Formatted JSON:** Easy to read, properly indented

### 6. **Professional UI Design** 🎨

#### **Design Principles**
- **Simple & Clean:** No clutter, focused information
- **Professional:** Suitable for stakeholder demos
- **Tech + Marketing Friendly:** Clear labels, no jargon
- **Icons Instead of Emojis:** Material-UI icons throughout
- **Responsive:** Works on desktop, tablet, mobile

#### **Brand Theme**
- **Grayscale Base:** #fafafa (background), #f9fafb (cards), #e0e0e0 (borders)
- **Brand Accent:** #2d2d2d (primary buttons, headings, score text)
- **Status Colors:** 
  - Green (#10b981) - Success
  - Yellow (#f59e0b) - Warning
  - Red (#ef4444) - Error
- **Typography:** Clean, modern, bold headings

#### **Layout**
1. **Header:** Title + Authentication status + Re-run button
2. **Overall Score Card:** Large circular score + 4 metric boxes
3. **Event Results Table:** Quick overview of all events
4. **Detailed Accordions:** Expand for per-event analysis

---

## Setup Instructions

### 1. Environment Variable
Add to `.env.local`:
```bash
# Meta Pixel Test Page Password (do not expose to client)
ADMIN_TEST_PASSWORD=your-secure-password-here
```

**Important:** 
- Do NOT use `NEXT_PUBLIC_` prefix
- Password stays server-side only
- Change default password for production!

### 2. API Route
Already created: `/api/test/verify-password/route.js`
- POST endpoint for password verification
- Returns: `{ success: boolean, message: string }`
- Status codes: 200 (valid), 401 (invalid), 500 (not configured)

### 3. Access the Page
**Development:**
```
http://localhost:3000/test/ip-extraction
```

**Production:**
```
https://maddycustom.com/test/ip-extraction
```

---

## How It Works

### Flow Diagram
```
1. User visits page
   ↓
2. Check authentication (localStorage)
   ↓ (not authenticated)
3. Show password lock screen
   ↓ (enter password)
4. Verify via /api/test/verify-password
   ↓ (success)
5. Store auth token for 1 hour
   ↓
6. Check for test query params
   ↓ (missing)
7. Redirect with fake tracking params
   ↓ (has params)
8. Show full-page loader
   ↓
9. Run test suite (5 events)
   ↓ (for each event)
10. Fire Pixel → Fire CAPI → Wait 300ms
    ↓
11. Collect results
    ↓
12. Calculate metrics & score
    ↓
13. Display dashboard
```

### Test Execution
Each event test:
```javascript
1. Generate unique eventID (UUID)
2. Fire Facebook Pixel: fbq('track', eventName, data, { eventID })
3. Wait 300ms
4. Fire CAPI: fetch('/api/meta/conversion-api', { eventName, eventID, ...data })
5. Parse response (success, matchQualityScore)
6. Validate: eventID matches? (deduplication check)
7. Record result
```

### Match Quality Scoring
**Components (0-10 scale):**
- **Email:** +4 points
- **Phone:** +3 points
- **_fbc cookie:** +2 points
- **_fbp cookie:** +1 point
- **external_id:** +1 point

**Expected Scores:**
- **Localhost (no real data):** 1-3/10
- **With test params:** 3-5/10
- **Production (organic):** 6-8/10
- **Production (from ad):** 9-10/10

---

## Troubleshooting

### Password Not Working
**Issue:** "Invalid password" error  
**Solutions:**
1. Check `.env.local` has `ADMIN_TEST_PASSWORD` set
2. Restart dev server (`npm run dev`)
3. Verify no typos in password
4. Check API route exists: `/api/test/verify-password/route.js`

### Session Expired
**Issue:** Redirected to lock screen after 1 hour  
**Solutions:**
1. Normal behavior - re-enter password
2. Session stored in `localStorage` with expiry timestamp
3. To extend: Change `60 * 60 * 1000` to longer duration in code

### Events Not Firing
**Issue:** "0/5 events successful"  
**Solutions:**
1. Check Facebook Pixel loaded: `window.fbq` exists
2. Check CAPI endpoint working: `/api/meta/conversion-api`
3. Open console for error messages
4. Verify Pixel ID in FacebookPixel.js: `887502090050413`
5. Check `.env.local` has Meta credentials

### Low Match Quality
**Issue:** Scores showing 1-3/10  
**Solutions:**
1. **Expected on localhost** - No real email/phone data
2. Test params help: Wait for auto-redirect to add `_fbp`, `_fbc`
3. Production will score higher (real cookies)
4. Ad traffic scores 9-10/10 (has real fbclid)

### Coverage Not 100%
**Issue:** Some events not deduplicated  
**Solutions:**
1. Check eventID generated correctly
2. Verify both Pixel and CAPI using same eventID
3. Check CAPI response contains eventID in debug object
4. Review console logs for matching details

### Re-run Button Not Working
**Issue:** Test doesn't restart  
**Solutions:**
1. Button should be visible in top-right corner
2. Click should clear old results and show loader
3. Check console for errors
4. Refresh page if stuck

---

## For Marketing Teams

### What This Tool Shows You
1. **Is our tracking working?** → Overall health score
2. **Are events being sent?** → Pixel/CAPI success counts
3. **Is data quality good?** → Match quality scores
4. **Are we avoiding duplicates?** → Deduplication success

### How to Interpret Results

#### **Good Health (80-100)**
- All events firing to Pixel AND server
- Match quality 6+/10
- 100% deduplication
- **Action:** No issues, tracking is solid

#### **Needs Improvement (60-79)**
- Most events working but some failures
- Match quality 4-6/10
- Some deduplication issues
- **Action:** Technical review needed

#### **Critical Issues (0-59)**
- Many events failing
- Match quality < 4/10
- Deduplication broken
- **Action:** Immediate technical fix required

### When to Run Tests
- **After code changes:** Verify nothing broke
- **Before campaigns:** Ensure tracking ready
- **During troubleshooting:** Diagnose issues
- **Monthly health checks:** Preventive maintenance

---

## For Technical Teams

### Architecture

#### **Client-Side (page.js)**
```javascript
// Password auth
localStorage.setItem('metaTestAuth', token)
localStorage.setItem('metaTestAuthExpiry', timestamp)

// Auto-redirect
if (!hasTestParams) {
  router.replace(`/test/ip-extraction?${fakeParams}`)
}

// Test execution
for (const event of TEST_EVENTS) {
  const eventId = uuidv4()
  fbq('track', event.name, event.data, { eventID: eventId })
  await fetch('/api/meta/conversion-api', { eventName, eventID: eventId })
}

// Scoring
score = (pixelSuccess * 25) + (capiSuccess * 25) + (dedup * 30) + (matchQuality * 20)
```

#### **Server-Side (verify-password/route.js)**
```javascript
export async function POST(request) {
  const { password } = await request.json()
  const correctPassword = process.env.ADMIN_TEST_PASSWORD
  
  if (password === correctPassword) {
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ success: false }, { status: 401 })
}
```

#### **Dependencies**
- `@mui/material` - UI components
- `@mui/icons-material` - Icons (no emojis!)
- `uuid` - Event ID generation
- `next/navigation` - Router for redirects

### Extending the Tool

#### **Add New Test Event**
```javascript
// Add to TEST_EVENTS array
{
  name: 'Lead',
  icon: PersonAdd,
  description: 'User submits lead form',
  testData: {
    content_name: 'Contact Form',
    content_category: 'lead-gen'
  }
}
```

#### **Customize Password Expiry**
```javascript
// Change from 1 hour to 24 hours
const expiryTime = Date.now() + (24 * 60 * 60 * 1000)
```

#### **Add More Metrics**
```javascript
// In calculateOverallMetrics()
metrics.someNewMetric = results.filter(r => r.someCondition).length
```

#### **Customize Scoring**
```javascript
// Change weightings (must sum to 100)
const score = Math.round(
  (metrics.pixelSuccess / metrics.totalEvents) * 30 +  // Changed from 25
  (metrics.capiSuccess / metrics.totalEvents) * 30 +   // Changed from 25
  (metrics.deduplicationSuccess / metrics.totalEvents) * 25 +  // Changed from 30
  (metrics.avgMatchQuality / 10) * 15  // Changed from 20
)
```

---

## Security Notes

1. **Password Storage:** Server-side only, never exposed to client
2. **Session Management:** 1-hour expiry, can't be extended without re-auth
3. **API Protection:** Password endpoint has no rate limiting (add if needed)
4. **Test Mode Flag:** `test_mode=true` param identifies test traffic
5. **Fake Data:** All test data is clearly fake (product IDs, prices)
6. **No Real Transactions:** Purchase event doesn't create real orders

---

## Production Deployment

### Pre-Deployment Checklist
- [ ] Set strong `ADMIN_TEST_PASSWORD` in production env vars
- [ ] Verify password API route deployed
- [ ] Test authentication works on production
- [ ] Confirm auto-redirect works with production URL
- [ ] Check all 5 events fire successfully
- [ ] Validate match quality scores improve (should be 6-8/10)
- [ ] Ensure responsive design works on all devices
- [ ] Review console for any error messages

### Post-Deployment Testing
```bash
# 1. Visit production page
https://maddycustom.com/test/ip-extraction

# 2. Enter password
# Should redirect with test params

# 3. Wait for test to complete
# Should show 100% green scores (or close)

# 4. Check match quality
# Should be 6-8/10 (higher with real ad traffic)

# 5. Test re-run button
# Should clear results and re-test

# 6. Test session expiry
# After 1 hour, should lock again
```

---

## Changelog

### Version 2.0 (Current)
- ✅ Complete redesign from health check to full test suite
- ✅ Password protection with 1-hour session
- ✅ Auto-redirect with fake tracking parameters
- ✅ Full event suite (PageView, ViewContent, AddToCart, InitiateCheckout, Purchase)
- ✅ Full-page loader with dynamic status
- ✅ Professional UI (grayscale theme, no emojis, icons only)
- ✅ Detailed analysis accordions
- ✅ Overall health score (0-100)
- ✅ Responsive design

### Version 1.0 (Deprecated - see page-old-backup.js)
- Basic health check
- Live Pixel/CAPI interceptors
- Real-time event tracking
- Coverage calculation

---

## Support

**For Issues:**
1. Check console for error messages
2. Review this guide
3. Test on localhost first
4. Verify environment variables set
5. Check API routes are deployed

**Common Questions:**
- **Q:** Why is match quality low on localhost?  
  **A:** Expected - no real user data. Production will score higher.

- **Q:** Can I customize the test events?  
  **A:** Yes! Add/edit entries in `TEST_EVENTS` array.

- **Q:** How do I change the password?  
  **A:** Update `ADMIN_TEST_PASSWORD` in `.env.local` and restart server.

- **Q:** Can I use this in production?  
  **A:** Yes! It's designed for production diagnostics.

- **Q:** Does this affect real tracking?  
  **A:** No - uses `test_mode=true` flag and fake data.

---

## Summary

This tool provides comprehensive validation of your Meta Pixel + CAPI integration with:
- **Password-protected access** for security
- **Realistic test conditions** via fake tracking params
- **Full event suite testing** covering all critical conversions
- **Professional UI** suitable for both tech and marketing teams
- **Detailed diagnostics** with expandable analysis per event
- **Overall health scoring** for quick status assessment

Perfect for pre-campaign checks, troubleshooting, stakeholder demos, and monthly audits.
