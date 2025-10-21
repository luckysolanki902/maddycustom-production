# Meta Pixel & Conversions API Implementation Guide

## Critical Fixes Implemented (October 21, 2025)

### Problem 1: Server sending client IP addresses with multiple users (53% of events affected)

**Root Cause:**
- The client-side code (`facebookPixels.js`) was fetching IP addresses from external services (ipify.org)
- All users on the same network/server would get the SAME IP address
- This caused Meta's attribution system to incorrectly associate multiple users with one IP

**Solution:**
1. Modified `getClientIp()` in `facebookPixels.js` to return `null` instead of fetching IP
2. Added `extractClientIpFromRequest()` function in `/api/meta/conversion-api/route.js`
3. Server now extracts the REAL client IP from request headers (X-Forwarded-For, X-Real-IP, CF-Connecting-IP, etc.)
4. Each user now has their unique IP address properly attributed

**Technical Implementation:**
```javascript
// Client-side (facebookPixels.js) - DO NOT fetch IP
const getClientIp = async () => {
  return null; // Server will extract from headers
};

// Server-side (conversion-api/route.js) - Extract from headers
const extractClientIpFromRequest = (request) => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim(); // First IP is the client
  }
  // Fallback to other headers...
};
```

### Problem 2: Low event coverage for InitiateCheckout (33%, need 75%)

**Root Cause Analysis:**
- Current implementation fires InitiateCheckout only when user submits contact info in OrderForm
- The pixel AND CAPI both fire, but there may be cases where the CAPI call fails silently
- Network issues, timeouts, or server errors can cause CAPI events to be lost

**Solution:**
- Event deduplication is already properly implemented (eventID is shared between pixel and CAPI)
- The coverage issue will improve once:
  1. IP address issue is fixed (better attribution)
  2. Error handling is improved
  3. Retry logic ensures events reach Meta

**Current Implementation (Correct):**
```javascript
// OrderForm.js - Contact info submission
await trackInitiateCheckout({
  eventID: uuidv4(), // Same ID for pixel and CAPI
  totalValue: totalCost,
  contents,
  contentName,
  contentCategory: 'checkout',
  numItems,
}, {
  email: data.email,
  phoneNumber: phoneToUse,
  firstName: data.name,
});
```

### Problem 3: Event Match Quality

**Current State:**
- Email, phone, and firstName are being sent
- External IDs are being used for cross-device tracking
- fbp and fbc cookies are being tracked

**Improvements Made:**
- Server-side now properly validates and hashes all user data
- Additional parameters added (city, state, country, zip, date_of_birth, gender) - ready for use when available
- Match quality scoring function added to track data completeness

## Best Practices Implemented

### 1. Redundant Event Setup ✅
- All events fire via BOTH Meta Pixel (browser) AND Conversions API (server)
- Same event parameters sent through both channels
- Proper deduplication using eventID

### 2. Deduplication ✅
- Every event gets a unique eventID (UUID v4)
- Same eventID used for both pixel and CAPI events
- Meta's system automatically deduplicates based on eventID

### 3. Real-Time Event Sending ✅
- Events are sent immediately when they occur
- No artificial delays or batching
- Timestamp validation ensures accurate event timing

### 4. Customer Information Parameters ✅
- Email (normalized and hashed)
- Phone (normalized and hashed)
- First name (hashed)
- External ID (persistent cross-device identifier)
- fbp (Facebook browser ID)
- fbc (Facebook click ID)
- Additional: city, state, country, zip (when available)

### 5. IP Address Handling ✅ **FIXED**
- Each user has their unique IP address
- Extracted from request headers on server-side
- No shared IPs across users

## Testing Checklist

After deployment, verify in Meta Events Manager:

### 1. Event Coverage
- [ ] InitiateCheckout coverage should increase from 33% to 75%+
- [ ] Check "Coverage" tab in Events Manager
- [ ] Verify both browser and server events are showing

### 2. IP Address Issue
- [ ] "Server sending client IP addresses with multiple users" error should disappear
- [ ] Check "Diagnostics" tab in Events Manager
- [ ] Wait 24-48 hours for diagnostics to update

### 3. Event Match Quality
- [ ] Check "Data Quality" tab in Events Manager
- [ ] Match quality score should improve over time
- [ ] More events should have customer information parameters

### 4. Deduplication
- [ ] Check "Events" tab and filter by specific eventID
- [ ] Should see BOTH pixel and server events with same eventID
- [ ] Final event count should not be doubled (deduplicated correctly)

## Event Flow Diagram

```
User Action
    ↓
┌─────────────────────────────────────────┐
│   Browser (Client-Side)                  │
│                                          │
│  1. Generate eventID (UUID)              │
│  2. Collect user data (email, phone)     │
│  3. Fire Meta Pixel event                │
│     fbq('track', 'InitiateCheckout',     │
│         params, { eventID })             │
│                                          │
│  4. Send to Server CAPI                  │
│     POST /api/meta/conversion-api        │
│     Body: { eventName, options }         │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│   Server (Next.js API)                   │
│                                          │
│  1. Extract real client IP from headers  │
│     (X-Forwarded-For, X-Real-IP, etc.)  │
│  2. Override client-provided IP          │
│  3. Hash customer information            │
│  4. Build Facebook ServerEvent           │
│  5. Send to Meta Conversions API         │
│     (with retry logic)                   │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│   Meta's System                          │
│                                          │
│  1. Receive browser pixel event          │
│  2. Receive server CAPI event            │
│  3. Deduplicate based on eventID         │
│  4. Match user based on IP, email,       │
│     phone, fbp, fbc, external_id        │
│  5. Attribute to ad campaigns            │
│  6. Optimize ad delivery                 │
└─────────────────────────────────────────┘
```

## Code Architecture

### Client-Side (`facebookPixels.js`)
- **Purpose**: Fire browser pixel events and prepare data for server
- **Responsibilities**:
  - Generate unique eventID
  - Collect user data (email, phone, name)
  - Fire browser pixel via `fbq()`
  - Send event to server API
  - NO IP fetching (server handles this)

### Server-Side (`/api/meta/conversion-api/route.js`)
- **Purpose**: Send server events to Meta with proper attribution
- **Responsibilities**:
  - Extract real client IP from request headers
  - Hash customer information parameters
  - Build ServerEvent with UserData and CustomData
  - Send to Facebook Conversions API
  - Handle retries and errors

### Key Functions

#### `trackEvent(name, formData, otherOptions)`
Main tracking function that orchestrates both pixel and CAPI events.

#### `extractClientIpFromRequest(request)`
**CRITICAL**: Extracts real client IP from request headers to fix multi-user IP issue.

#### `hashData(data)` & `hashIdentifier(value)`
Hash customer information parameters (email, phone, name) for privacy.

#### `createContents(product)`
Creates Facebook Content objects for event data.

## Monitoring & Maintenance

### Daily Checks
1. Monitor Events Manager for new diagnostics
2. Check event coverage ratios
3. Verify no new errors appear

### Weekly Reviews
1. Review event match quality trends
2. Check conversion attribution
3. Analyze ad performance correlation

### Monthly Audits
1. Full code review of tracking implementation
2. Verify all events are firing correctly
3. Update customer information parameters as needed
4. Review Meta's latest best practices

## Common Issues & Solutions

### Issue: Events not appearing in Events Manager
**Solution**: 
- Check network tab for failed API calls
- Verify FB_PIXEL_ACCESS_TOKEN is set
- Check server logs for errors

### Issue: Low event match quality
**Solution**:
- Collect more customer information parameters
- Ensure email and phone are properly formatted
- Add city, state, country when available

### Issue: Events appearing twice (not deduplicated)
**Solution**:
- Verify same eventID is used for pixel and CAPI
- Check that eventID format is correct
- Ensure both events fire within 24 hours of each other

### Issue: "Invalid parameter" errors
**Solution**:
- Validate all parameters before sending
- Check data types (strings, numbers, arrays)
- Ensure currency is 3-letter ISO code (e.g., "INR")

## References

- [Meta Pixel Documentation](https://developers.facebook.com/docs/meta-pixel)
- [Conversions API Documentation](https://developers.facebook.com/docs/marketing-api/conversions-api/)
- [Best Practices for Conversions API](https://www.facebook.com/business/help/308855623839366)
- [Event Deduplication Guide](https://www.facebook.com/business/help/823677331451951)
- [Event Match Quality Guide](https://www.facebook.com/business/help/765081237991954)

## Change Log

### October 21, 2025 - Critical Fixes
1. **Fixed IP Address Issue**: Server now extracts real client IP from request headers instead of using client-provided IP
2. **Improved Event Coverage**: Enhanced error handling and retry logic for CAPI events
3. **Enhanced Match Quality**: Added support for additional customer information parameters
4. **Better Validation**: Added comprehensive validation for all event parameters
5. **Documentation**: Created comprehensive implementation guide

---

**Next Steps:**
1. Deploy changes to production
2. Monitor Meta Events Manager for 24-48 hours
3. Verify both diagnostics errors are resolved
4. Document results and share with team
