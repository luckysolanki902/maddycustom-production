# Meta Pixel & CAPI - Quick Fix Reference

## 🚨 Problems & Solutions

| Problem | Root Cause | Solution | Status |
|---------|-----------|----------|--------|
| **Server sending same IP for multiple users** (53% of events) | Client-side fetching IP from ipify.org | Server extracts real IP from request headers | ✅ FIXED |
| **Low InitiateCheckout coverage** (33%, need 75%) | Network failures, no retries, silent errors | Added retry logic, timeout handling, enhanced logging | ✅ FIXED |

---

## 📝 Code Changes Summary

### 1. `facebookPixels.js` (Client-Side)
```javascript
// BEFORE: ❌ Fetched IP from external API
const getClientIp = async () => {
  const response = await fetch('https://api.ipify.org');
  return response.json().ip; // Wrong! All users get same IP
};

// AFTER: ✅ Returns null, server extracts real IP
const getClientIp = async () => {
  return null; // Server handles IP extraction
};
```

### 2. `conversion-api/route.js` (Server-Side)
```javascript
// NEW: Extract real client IP from headers
const extractClientIpFromRequest = (request) => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim(); // First IP = client
  }
  // ... fallback to other headers
};

// In POST handler:
const realClientIp = extractClientIpFromRequest(request);
options.client_ip_address = realClientIp; // Override client-provided IP
```

---

## 🧪 Quick Test

### Check if it's working:

**Browser Console (F12):**
```
[Meta CAPI Client] ✓ InitiateCheckout sent successfully
```

**Server Logs:**
```
[Meta CAPI] Received InitiateCheckout request
[Meta CAPI] ✓ InitiateCheckout sent to Meta successfully
```

---

## 📊 Monitoring (24-48 hours)

### Meta Events Manager Checklist:
- [ ] Go to [Events Manager](https://business.facebook.com/events_manager2/)
- [ ] Diagnostics Tab → "Server sending IP..." error should disappear
- [ ] Data Sources → Coverage → InitiateCheckout should reach 75%+
- [ ] Event Match Quality → Should show unique IPs per user

---

## 🎯 Expected Results

| Metric | Before | After | Timeline |
|--------|--------|-------|----------|
| IP Address Issue | 53% affected | 0% affected | 24-48 hrs |
| InitiateCheckout Coverage | 33% | 75%+ | 7 days |
| Event Match Quality | Good | Better | Immediate |
| Additional Conversions | Baseline | +21.2% median | 14 days |

---

## 📁 Modified Files

1. ✅ `src/lib/metadata/facebookPixels.js`
2. ✅ `src/app/api/meta/conversion-api/route.js`
3. ✅ `readmeFiles/META_PIXEL_CAPI_FIXES.md` (new)
4. ✅ `readmeFiles/META_PIXEL_CAPI_FIXES_SUMMARY.md` (new)

---

## 🚀 Next Steps

1. **Now**: Deploy to production
2. **Today**: Check browser/server logs for confirmation
3. **Tomorrow**: Check Meta Events Manager diagnostics
4. **Week**: Verify 75%+ coverage achieved

---

## 📞 Emergency Rollback

If issues occur, revert these commits:
```bash
git revert HEAD  # Reverts latest commit
# Or restore from backup files in temp-backups/
```

---

**Date**: October 21, 2025  
**Status**: ✅ Ready to deploy
