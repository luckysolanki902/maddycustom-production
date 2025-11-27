# Migration & Deployment Checklist

## Pre-Deployment Verification

### ✅ Code Review
- [x] Client-side tracking capture utility created
- [x] Order model updated with analyticsInfo field
- [x] Centralized payment success handler implemented
- [x] Razorpay webhook refactored
- [x] PayU webhook refactored
- [x] Comprehensive logging added
- [x] Documentation created

### ✅ Files Created/Modified
**New Files:**
- [x] `src/lib/analytics/trackingCapture.js`
- [x] `src/lib/payments/handlePaymentSuccess.js`
- [x] `docs/payments/CENTRALIZED_WEBHOOK_IMPLEMENTATION.md`
- [x] `docs/payments/WEBHOOK_LOGS_REFERENCE.md`

**Modified Files:**
- [x] `src/models/Order.js` - Added analyticsInfo field
- [x] `src/app/api/webhooks/razorpay/verify-payment/route.js` - Refactored
- [x] `src/lib/payments/payu/responseProcessor.js` - Refactored
- [x] `src/components/dialogs/OrderForm.js` - Already has tracking capture

## Deployment Steps

### 1. Database Migration
**Note:** MongoDB schema is flexible, no migration needed. The new `analyticsInfo` field will be added to new orders automatically.

**Verify:**
```javascript
// Test that existing orders still work
db.orders.findOne()
```

### 2. Deploy Backend Changes
```bash
# 1. Pull latest code
git pull origin develop

# 2. Install dependencies (if any new ones)
npm install

# 3. Build
npm run build

# 4. Deploy
# (Use your deployment process)
```

### 3. Environment Variables
**Verify these exist:**
- `NEXT_PUBLIC_APP_URL` - For Meta CAPI callback
- `RAZORPAY_WEBHOOK_SECRET` - For Razorpay signature verification
- `PAYU_MERCHANT_KEY` - For PayU hash verification
- `PAYU_SALT` - For PayU hash verification

### 4. Test Order Flow
**Test Case 1: New Order with Tracking Data**
1. Create a new order from browser
2. Verify `analyticsInfo` is captured in order document
3. Check browser console for "📊 Captured client tracking data"

**Test Case 2: Razorpay Payment Success**
1. Complete payment via Razorpay
2. Check webhook logs for centralized handler invocation
3. Verify inventory deducted, Shiprocket created, analytics sent

**Test Case 3: PayU Payment Success**
1. Complete payment via PayU
2. Check webhook logs for centralized handler invocation
3. Verify inventory deducted, Shiprocket created, analytics sent

**Test Case 4: Payment Failure**
1. Trigger payment failure
2. Verify order status updated to "failed"
3. Verify no inventory deducted

## Post-Deployment Monitoring

### Immediate (First Hour)
- [ ] Monitor error logs for any new errors
- [ ] Check successful payment completions
- [ ] Verify analytics events in Meta Events Manager
- [ ] Verify analytics events in Google Ads

### First Day
- [ ] Compare payment success rate with historical data
- [ ] Check Shiprocket order creation rate
- [ ] Monitor WhatsApp notification delivery
- [ ] Review structured logs for patterns

### First Week
- [ ] Analyze Meta CAPI event quality score
- [ ] Check Google Ads conversion tracking accuracy
- [ ] Review any edge cases or errors
- [ ] Gather feedback from CS team

## Rollback Plan

### If Issues Arise
1. **Identify the issue:**
   - Check error logs
   - Identify affected orders
   - Determine severity

2. **Quick Fix (if possible):**
   - Fix critical bugs
   - Deploy hotfix
   - Monitor closely

3. **Full Rollback (if needed):**
   ```bash
   # Revert to previous commit
   git revert <commit-hash>
   
   # Deploy previous version
   npm run build
   # Deploy
   ```

4. **Manual Order Processing:**
   - If orders are stuck, manually process them
   - Update inventory manually if needed
   - Create Shiprocket orders manually

## Known Limitations

### 1. IP Address Capture
- Uses external API (ipify.org)
- May fail in some network configurations
- Fallback: Order will still be created without IP

### 2. Analytics Events
- Non-critical - failures don't block payment
- Retry mechanism not implemented yet
- Manual review needed for failed events

### 3. External ID
- First-time users get generated ID
- Updates to email/phone hash when provided
- Consider localStorage for persistence across sessions

## Success Criteria

### Metrics to Track
- **Order Processing:** 100% of payments processed correctly
- **Inventory:** 100% accuracy in deduction
- **Shiprocket:** >95% creation success rate
- **Analytics Events:** >90% delivery success rate
- **WhatsApp:** >90% delivery success rate

### Quality Indicators
- No payment processing errors
- No duplicate inventory deductions
- Clean, searchable logs
- Improved Meta/Google attribution data

## Support & Troubleshooting

### Common Issues

**Issue:** Missing analyticsInfo in orders
- **Cause:** Client-side capture failed
- **Impact:** No Meta CAPI events with advanced matching
- **Solution:** Check browser console, verify ipify.org is accessible

**Issue:** Duplicate inventory deduction
- **Cause:** Webhook called multiple times
- **Impact:** Inventory count incorrect
- **Solution:** Check inventoryDeducted flag, manually adjust if needed

**Issue:** Shiprocket creation fails
- **Cause:** Invalid address, missing dimensions
- **Impact:** Manual shipping setup needed
- **Solution:** Check logs, create order manually in Shiprocket

**Issue:** Analytics events not appearing
- **Cause:** API failures, invalid credentials
- **Impact:** Attribution data incomplete
- **Solution:** Check Meta/Google dashboards, verify credentials

### Debug Commands

**Check order analyticsInfo:**
```javascript
db.orders.findOne({ _id: ObjectId('674...') }, { analyticsInfo: 1 })
```

**Find orders without analyticsInfo:**
```javascript
db.orders.find({ analyticsInfo: null }).count()
```

**Find orders with inventory issues:**
```javascript
db.orders.find({ 
  paymentStatus: { $in: ['allPaid', 'paidPartially'] },
  inventoryDeducted: false 
})
```

## Next Steps

### Immediate Improvements
1. Add retry mechanism for failed analytics events
2. Implement event queue for async processing
3. Add monitoring dashboard for webhook health

### Future Enhancements
1. Server-side IP detection using Cloudflare headers
2. Enhanced external_id with localStorage persistence
3. A/B testing for attribution data quality
4. Parallel operations for better performance

## Team Notification

**Before Deployment:**
- [ ] Notify CS team of deployment
- [ ] Share monitoring dashboard access
- [ ] Provide troubleshooting guide

**After Deployment:**
- [ ] Send deployment summary
- [ ] Share log search queries
- [ ] Schedule review meeting

---

## Sign-Off

**Developer:** ___________ **Date:** ___________

**QA:** ___________ **Date:** ___________

**DevOps:** ___________ **Date:** ___________

**Product Owner:** ___________ **Date:** ___________
