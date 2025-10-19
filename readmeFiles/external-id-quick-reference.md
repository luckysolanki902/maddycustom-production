# External ID Quick Reference

## 🚀 Quick Start

### Check if it's working

**Browser Console:**
```javascript
// Check external_id
localStorage.getItem('mc_external_id')
// Expected: "d0f2a7c3-1234-4567-89ab-0123456789ab"

// Check cookie
document.cookie.split(';').find(c => c.includes('mc_external_id'))
// Expected: "mc_external_id=d0f2a7c3-..."
```

**Meta Events Manager:**
1. Go to Events Manager > Test Events
2. Visit your site
3. Check event details → Should show `external_id: 1`

---

## 📁 Files Modified

| File | Purpose | Changes |
|------|---------|---------|
| `src/lib/utils/externalIdManager.js` | **NEW** - Generate & manage persistent external_id | +250 lines |
| `src/lib/metadata/facebookPixels.js` | Include external_id in Pixel events | +10 lines |
| `src/app/api/meta/conversion-api/route.js` | Read external_id from cookie | +30 lines |
| `src/lib/utils/userDataEnhancer.js` | Use persistent external_id | -15 +10 lines |

---

## 🔑 Key Functions

### externalIdManager.js

```javascript
import { getExternalId, setExternalIdCookie, clearExternalId } from '@/lib/utils/externalIdManager';

// Get external ID (auto-generates if doesn't exist)
const id = getExternalId(); // "d0f2a7c3-1234-..."

// Set cookie manually (auto happens on getExternalId)
setExternalIdCookie();

// Clear for testing
clearExternalId();
```

### How it works

```
1. User visits → externalIdManager auto-initializes
2. Generate UUID → d0f2a7c3-1234-4567-89ab-0123456789ab
3. Store in localStorage as 'mc_external_id'
4. Set cookie 'mc_external_id' (365 days)
5. Browser Pixel reads from localStorage → includes in events
6. Server CAPI reads from cookie → includes in events
7. Meta sees SAME ID on both → deduplicates perfectly
```

---

## 🧪 Testing Commands

### Browser Console

```javascript
// Test 1: Check if external_id exists
localStorage.getItem('mc_external_id')

// Test 2: Check if cookie is set
document.cookie

// Test 3: Manual generation
import { getExternalId } from '@/lib/utils/externalIdManager';
getExternalId()

// Test 4: Clear and regenerate
import { clearExternalId, getExternalId } from '@/lib/utils/externalIdManager';
clearExternalId();
getExternalId(); // Should generate new UUID
```

### Network Tab (Browser DevTools)

1. Filter: `facebook.com/tr`
2. Trigger event (AddToCart, etc.)
3. Check payload → should include `external_ids` array

### Server Logs

```bash
# Search for external_id logs
grep "External ID" logs/*.log

# Check Meta CAPI debug logs
grep "\[Meta CAPI\] Dispatch" logs/*.log
```

---

## 📊 Success Criteria Checklist

- [ ] **Browser external_id coverage:** 95%+ in Events Manager
- [ ] **Server external_id coverage:** 95%+ in Events Manager
- [ ] **Deduplication rate:** 80%+ in Events Manager > Diagnostics
- [ ] **Match Quality Score:** 7.0+ average
- [ ] **localStorage:** Shows `mc_external_id` with UUID
- [ ] **Cookie:** Shows `mc_external_id` with SAME UUID
- [ ] **Persistence:** UUID survives browser restart
- [ ] **Events:** No longer double-counted

---

## 🐛 Common Issues & Fixes

### Issue: external_id not in browser events

**Check:**
```javascript
localStorage.getItem('mc_external_id') // Should return UUID
```

**Fix:**
1. Clear cache and reload
2. Check for JavaScript errors in console
3. Verify `externalIdManager.js` is imported in `facebookPixels.js`

### Issue: external_id not in server events

**Check:**
```javascript
document.cookie // Should include 'mc_external_id'
```

**Fix:**
1. Verify cookie is set: `setExternalIdCookie()`
2. Check cookie expiration (365 days)
3. Verify `getExternalIdFromCookie(request)` is called in CAPI route

### Issue: Different external_id in browser vs server

**Diagnose:**
```javascript
// Browser
const browserId = localStorage.getItem('mc_external_id');
console.log('Browser:', browserId);

// Server (check logs)
// Look for: [External ID] Cookie ID: <uuid>
```

**Fix:**
1. Ensure cookie is set BEFORE first event
2. Check cookie domain/path settings
3. Verify cookie is not blocked

### Issue: Low deduplication rate

**Possible Causes:**
- Timing: Browser event before cookie set
- Cookie blocked: Third-party restrictions
- eventID mismatch: Different UUIDs

**Fix:**
1. Ensure `getExternalId()` called early
2. Use first-party cookie (same domain)
3. Pass same eventID to browser and server

---

## 📈 Monitoring

### Daily Checks

**Meta Events Manager:**
- Event Match Quality: Target 7.0+
- Deduplication Rate: Target 80%+
- external_id Coverage: Browser & Server 95%+

### Weekly Review

**Diagnostics Tab:**
- Event Match Quality trend (should improve)
- Deduplication rate trend (should increase)
- Coverage by parameter (external_id high)

### Monthly Analysis

**Ads Manager:**
- Compare conversion rates before/after
- Check Cost Per Conversion (should improve)
- Check ROAS (should improve)

---

## 🔐 Privacy

- external_id is random UUID (not PII)
- localStorage: Clears when user clears browser data
- Cookie: 365-day expiration
- User can clear: `clearExternalId()`

---

## 📞 Quick Help

1. Check localStorage and cookie values
2. Check browser console for `[FB Pixel]` logs
3. Check server logs for `[Meta CAPI]` logs
4. Check Meta Events Manager > Test Events
5. See full docs: `readmeFiles/external-id-deduplication.md`

---

## 🎯 Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Browser external_id | 0% | 100% ✅ |
| Server external_id | 100% (wrong ID) | 100% (same ID) ✅ |
| Deduplication | 0% | 90-95% ✅ |
| Match Quality | 3-5/10 | 7-9/10 ✅ |
| Event Accuracy | ~50% | 95-100% ✅ |

---

**Status:** ✅ Production Ready  
**Last Updated:** October 19, 2025  
**Version:** 1.0.0
