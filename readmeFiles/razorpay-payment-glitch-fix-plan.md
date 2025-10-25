# Razorpay Payment Glitch - Fix Implementation Plan

**Target:** Increase payment completion from 10-20% to 60-75%  
**Timeline:** 3 phases over 2-3 days  
**Priority:** Critical (₹27L/month revenue recovery)

---

## 🎯 SUCCESS METRICS

**Before:**
- Payment Initiated → Purchase: 10-20%
- Mobile UPI success: ~5%
- Desktop success: ~40%
- Overall abandonment: 80-90%

**After (Target):**
- Payment Initiated → Purchase: 60-75%
- Mobile UPI success: ~50-60%
- Desktop success: ~80-90%
- Overall abandonment: 25-40%

---

## 📋 PHASE 1: EMERGENCY FIXES (HIGH PRIORITY)

**Timeline:** 4-6 hours  
**Impact:** Expected to recover 30-40% conversion

### Fix 1.1: Remove Forced UPI Intent Flow ⚡ CRITICAL

**Problem:** Forcing `method: 'upi'` and `flow: 'intent'` causes redirect loops on mobile web.

**Solution:**
```javascript
// src/lib/payments/makePayment.js
// BEFORE (REMOVE THESE LINES):
method: 'upi',
upi: {
  flow: 'intent',
},

// AFTER: Let Razorpay show all payment methods
// Remove method forcing entirely, or make it conditional:
const options = {
  key,
  name: 'Maddy Custom',
  currency: razorpayOrder.currency,
  amount: razorpayOrder.amount.toString(),
  order_id: razorpayOrder.id,
  description: 'Maddy Customers',
  image: logoUrl,
  notes: { orderId },
  theme: { color: '#000000' },
  
  // Only set method preferences, don't force
  config: {
    display: {
      blocks: {
        banks: {
          name: 'All payment methods',
          instruments: [
            { method: 'upi' },
            { method: 'card' },
            { method: 'netbanking' },
            { method: 'wallet' }
          ]
        }
      },
      sequence: ['block.banks'],
      preferences: {
        show_default_blocks: true
      }
    }
  },
  
  // handler, modal, prefill remain same...
}
```

**Testing:**
1. Test on Android Chrome with GPay
2. Test on iOS Safari with Paytm
3. Verify modal doesn't close on app switch
4. Confirm payment completes after returning from UPI app

**Expected Impact:** +30% conversion

---

### Fix 1.2: Add Razorpay Script Validation ⚡ CRITICAL

**Problem:** No check if Razorpay script is loaded before calling `new window.Razorpay()`.

**Solution:**
```javascript
// src/lib/payments/makePayment.js
export const makePayment = ({ customerName, customerMobile, orderId, razorpayOrder }) =>
  new Promise((resolve, reject) => {
    // ADD THIS CHECK AT THE START:
    if (typeof window === 'undefined') {
      return reject(new Error('Payment must be initiated from browser'));
    }
    
    if (!window.Razorpay) {
      console.error('Razorpay script not loaded');
      return reject(new Error('Payment system not ready. Please refresh and try again.'));
    }
    
    const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY;
    const logoUrl = `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/logos/maddy3logodark_rect.png`;
    
    if (!key || !logoUrl) {
      return reject(new Error('Payment configuration error'));
    }
    
    // Rest of the code...
  });
```

**Additional: Add Script Loading Helper**
```javascript
// src/lib/payments/ensureRazorpayLoaded.js
export const ensureRazorpayLoaded = () => {
  return new Promise((resolve, reject) => {
    // If already loaded, resolve immediately
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    
    // Wait for script to load (max 5 seconds)
    let attempts = 0;
    const maxAttempts = 50; // 50 * 100ms = 5 seconds
    
    const checkInterval = setInterval(() => {
      attempts++;
      
      if (window.Razorpay) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        reject(new Error('Razorpay script failed to load. Please refresh the page.'));
      }
    }, 100);
  });
};
```

**Update OrderForm.js:**
```javascript
// src/components/dialogs/OrderForm.js
import { ensureRazorpayLoaded } from '@/lib/payments/ensureRazorpayLoaded';

// In onSubmitAddressDetails, before makePayment:
if (razorpayOrder && amountDueOnline > 0) {
  try {
    // Ensure Razorpay is loaded first
    await ensureRazorpayLoaded();
    
    // Track payment initiated analytics...
    
    const paymentResult = await makePayment({
      customerName: orderForm.userDetails.name || '',
      customerMobile: orderForm.userDetails.phoneNumber,
      orderId: createdOrderId,
      razorpayOrder,
    });
    
    // Handle result...
  } catch (scriptError) {
    setIsPaymentProcessing(false);
    setPurchaseInitiated(false);
    showSnackbar(scriptError.message || 'Failed to load payment system. Please refresh.', 'error');
    return;
  }
}
```

**Testing:**
1. Slow 3G simulation
2. Fast navigation to checkout
3. Verify proper error message if script not loaded

**Expected Impact:** +10% conversion (eliminate script race conditions)

---

### Fix 1.3: Improve Modal Dismiss Detection ⚡ HIGH PRIORITY

**Problem:** Can't distinguish between user cancellation vs. app switching.

**Solution:**
```javascript
// src/lib/payments/makePayment.js

export const makePayment = ({ customerName, customerMobile, orderId, razorpayOrder }) =>
  new Promise((resolve, reject) => {
    // ... previous validations ...
    
    let paymentStarted = false;
    let modalDismissTime = null;
    
    const options = {
      // ... all options ...
      
      handler: async (resp) => {
        paymentStarted = true; // Payment completed successfully
        
        try {
          const ver = await fetch('/api/checkout/order/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_signature: resp.razorpay_signature,
              orderId,
            }),
          });

          if (ver.status === 200) {
            resolve(resp);
          } else {
            const { message } = await ver.json();
            reject(new Error(`Payment verification failed: ${message || 'Unknown'}`));
          }
        } catch (err) {
          reject(new Error(`Verification error: ${err.message}`));
        }
      },
      
      modal: {
        ondismiss: () => {
          modalDismissTime = Date.now();
          
          // If payment handler already fired, don't treat as cancellation
          if (paymentStarted) {
            return;
          }
          
          // Give user 10 seconds to complete payment in external app
          // Before treating it as cancellation
          setTimeout(() => {
            if (!paymentStarted) {
              // Still no payment, check with server
              checkPaymentStatus(orderId)
                .then((status) => {
                  if (status.paid) {
                    resolve({ 
                      razorpay_payment_id: status.paymentId,
                      recovered: true 
                    });
                  } else {
                    resolve({ cancelled: true });
                  }
                })
                .catch(() => {
                  resolve({ cancelled: true });
                });
            }
          }, 10000); // 10 second grace period
        },
      },
      
      prefill: {
        name: customerName,
        contact: customerMobile,
        email: '',
      },
    };

    const rz = new window.Razorpay(options);
    rz.open();

    rz.on('payment.failed', (resp) => {
      paymentStarted = false;
      const msg = resp?.error?.description || 'Unknown error';
      reject(new Error(`Payment failed: ${msg}`));
    });
  });

// Helper function to check payment status
async function checkPaymentStatus(orderId) {
  try {
    const response = await fetch(`/api/checkout/order/status/${orderId}`);
    const data = await response.json();
    return {
      paid: data.paymentStatus === 'allPaid' || data.paymentStatus === 'paidPartially',
      paymentId: data.paymentDetails?.razorpayDetails?.paymentId
    };
  } catch (error) {
    console.error('Status check failed:', error);
    return { paid: false };
  }
}
```

**Create Status Check API:**
```javascript
// src/app/api/checkout/order/status/[orderId]/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';

export async function GET(request, { params }) {
  try {
    await connectToDatabase();
    const { orderId } = params;
    
    const order = await Order.findById(orderId)
      .select('paymentStatus paymentDetails.razorpayDetails')
      .lean();
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      paymentStatus: order.paymentStatus,
      paymentDetails: order.paymentDetails
    });
  } catch (error) {
    console.error('Order status check error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
```

**Testing:**
1. Open Razorpay modal
2. Switch to GPay
3. Complete payment in GPay
4. Return to browser
5. Verify payment recognized as successful (not cancelled)

**Expected Impact:** +15% conversion (reduce false cancellations)

---

### Fix 1.4: Import Razorpay Script in Layout

**Problem:** Razorpay component exists but not imported in layout.js

**Solution:**
```javascript
// src/app/layout.js
import Razorpay from '@/components/analytics/Razorpay'; // ADD THIS

export default function RootLayout({ children }) {
  // ...
  return (
    <html lang="en" className={`${kronaOne.className} ${jost.className} ${montserrat.className}`}>
      <head>
        <meta name="facebook-domain-verification" content="a6ebwo6vcn6vvdob84g9gfwmdo3joc" />
        <link rel="preconnect" href="https://www.youtube.com" />
        <AnalyticsHead />
        <Razorpay /> {/* ADD THIS - Load Razorpay script globally */}
        
        {/* JSON-LD Structured Data */}
        {/* ... */}
      </head>
      <body>
        {/* ... */}
      </body>
    </html>
  );
}
```

**Expected Impact:** +5% (ensure script always available)

---

## 📋 PHASE 2: PAYMENT RECOVERY (MEDIUM PRIORITY)

**Timeline:** 6-8 hours  
**Impact:** Expected to recover additional 15-20% conversion

### Fix 2.1: Persist Payment State

**Create Payment State Manager:**
```javascript
// src/lib/payments/paymentStateManager.js
const STORAGE_KEY = 'maddy_payment_state';

export const savePaymentState = (state) => {
  try {
    const data = {
      ...state,
      timestamp: Date.now(),
      expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save payment state:', error);
  }
};

export const getPaymentState = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    
    // Check if expired
    if (Date.now() > data.expiresAt) {
      clearPaymentState();
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Failed to get payment state:', error);
    return null;
  }
};

export const clearPaymentState = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear payment state:', error);
  }
};

export const updatePaymentState = (updates) => {
  const current = getPaymentState();
  if (current) {
    savePaymentState({ ...current, ...updates });
  }
};
```

**Update OrderForm.js:**
```javascript
// src/components/dialogs/OrderForm.js
import { savePaymentState, getPaymentState, clearPaymentState } from '@/lib/payments/paymentStateManager';

// Before creating order:
const onSubmitAddressDetails = useCallback(async (data) => {
  // ... existing validation ...
  
  // Save payment intent
  savePaymentState({
    status: 'initiated',
    orderData: finalOrderPayload,
    timestamp: Date.now()
  });
  
  const [orderCreationResponse] = await Promise.all([
    axios.post('/api/checkout/order/create', finalOrderPayload),
    addressAddPromise
  ]);
  
  const { orderId: createdOrderId, razorpayOrder, amountDueOnline } = orderCreationResponse.data;
  
  // Update state with orderId
  savePaymentState({
    status: 'order_created',
    orderId: createdOrderId,
    razorpayOrder,
    amountDueOnline,
    userDetails: orderForm.userDetails
  });
  
  if (razorpayOrder && amountDueOnline > 0) {
    // ... existing payment flow ...
    
    // On success
    clearPaymentState();
    
    // On cancellation
    updatePaymentState({ status: 'cancelled', cancelledAt: Date.now() });
  }
  
  // ... rest of the code ...
}, [/* deps */]);
```

---

### Fix 2.2: Add Payment Resume Component

**Create Resume Payment Component:**
```javascript
// src/components/payments/ResumePaymentBanner.js
'use client';
import { useState, useEffect } from 'react';
import { Alert, Button, Box, Typography, CircularProgress } from '@mui/material';
import { Payment, Refresh } from '@mui/icons-material';
import { getPaymentState, clearPaymentState } from '@/lib/payments/paymentStateManager';
import { makePayment, ensureRazorpayLoaded } from '@/lib/payments/makePayment';

export default function ResumePaymentBanner() {
  const [pendingPayment, setPendingPayment] = useState(null);
  const [checking, setChecking] = useState(false);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    const state = getPaymentState();
    if (state && state.status === 'order_created') {
      // Check if order still pending
      checkOrderStatus(state.orderId).then((orderStatus) => {
        if (orderStatus.paymentStatus === 'pending') {
          setPendingPayment(state);
        } else {
          clearPaymentState();
        }
      });
    }
  }, []);

  const handleResume = async () => {
    if (!pendingPayment) return;
    
    setResuming(true);
    try {
      await ensureRazorpayLoaded();
      
      const result = await makePayment({
        customerName: pendingPayment.userDetails.name,
        customerMobile: pendingPayment.userDetails.phoneNumber,
        orderId: pendingPayment.orderId,
        razorpayOrder: pendingPayment.razorpayOrder
      });
      
      if (result.cancelled) {
        setResuming(false);
        return;
      }
      
      // Payment successful
      clearPaymentState();
      setPendingPayment(null);
      window.location.href = `/orders?highlight=${pendingPayment.orderId}`;
    } catch (error) {
      console.error('Resume payment failed:', error);
      setResuming(false);
      alert('Failed to resume payment. Please try again.');
    }
  };

  const handleDismiss = () => {
    clearPaymentState();
    setPendingPayment(null);
  };

  if (!pendingPayment) return null;

  return (
    <Alert
      severity="warning"
      icon={<Payment />}
      sx={{
        position: 'fixed',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        minWidth: 320,
        maxWidth: 600,
        boxShadow: 3
      }}
      action={
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            onClick={handleResume}
            disabled={resuming}
            startIcon={resuming ? <CircularProgress size={16} /> : <Refresh />}
          >
            Resume
          </Button>
          <Button size="small" color="inherit" onClick={handleDismiss}>
            Dismiss
          </Button>
        </Box>
      }
    >
      <Typography variant="body2" fontWeight="600">
        You have a pending payment
      </Typography>
      <Typography variant="caption">
        Order #{pendingPayment.orderId.slice(-8)} • ₹{pendingPayment.amountDueOnline}
      </Typography>
    </Alert>
  );
}

async function checkOrderStatus(orderId) {
  const response = await fetch(`/api/checkout/order/status/${orderId}`);
  return response.json();
}
```

**Add to Layout:**
```javascript
// src/app/layout.js
import ResumePaymentBanner from '@/components/payments/ResumePaymentBanner';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ReduxProvider>
          <ResumePaymentBanner /> {/* ADD THIS */}
          {/* ... rest of layout ... */}
        </ReduxProvider>
      </body>
    </html>
  );
}
```

**Expected Impact:** +10% conversion (recover abandoned payments)

---

### Fix 2.3: Add Payment Status Polling

**Create Polling Hook:**
```javascript
// src/hooks/usePaymentStatusPolling.js
import { useState, useEffect, useRef } from 'react';

export const usePaymentStatusPolling = (orderId, enabled = false) => {
  const [status, setStatus] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef(null);
  const attemptsRef = useRef(0);
  const maxAttempts = 30; // Poll for 30 seconds (30 attempts × 1s)

  useEffect(() => {
    if (!enabled || !orderId) {
      return;
    }

    setIsPolling(true);
    attemptsRef.current = 0;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/checkout/order/status/${orderId}`);
        const data = await response.json();

        if (data.paymentStatus === 'allPaid' || data.paymentStatus === 'paidPartially') {
          setStatus({ success: true, data });
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          return true;
        }

        attemptsRef.current++;
        if (attemptsRef.current >= maxAttempts) {
          setStatus({ success: false, timeout: true });
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        attemptsRef.current++;
        if (attemptsRef.current >= maxAttempts) {
          setStatus({ success: false, error });
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
        }
      }
    };

    // Initial poll
    pollStatus();

    // Start polling every 1 second
    intervalRef.current = setInterval(pollStatus, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [orderId, enabled]);

  return { status, isPolling };
};
```

**Use in OrderForm:**
```javascript
// After modal dismisses with cancelled status
const [pollOrderId, setPollOrderId] = useState(null);
const { status: pollingStatus, isPolling } = usePaymentStatusPolling(pollOrderId, !!pollOrderId);

// Handle polling result
useEffect(() => {
  if (pollingStatus?.success) {
    showSnackbar('Payment Successful!', 'success');
    // Proceed with success flow
    handlePaymentSuccess(pollOrderId);
    setPollOrderId(null);
  } else if (pollingStatus?.timeout) {
    showSnackbar('Payment status unclear. Check your orders page.', 'info');
    setPollOrderId(null);
  }
}, [pollingStatus]);

// When payment result is cancelled
if (paymentResult.cancelled) {
  // Start polling for 30 seconds before giving up
  setPollOrderId(createdOrderId);
  showSnackbar('Checking payment status...', 'info');
  // Don't immediately return, let polling complete
}
```

**Expected Impact:** +8% conversion (catch webhook-confirmed payments)

---

## 📋 PHASE 3: UX IMPROVEMENTS (LOW PRIORITY)

**Timeline:** 4-6 hours  
**Impact:** Expected to improve experience and add 5-10% conversion

### Fix 3.1: Add Retry Mechanism

**Update OrderForm.js:**
```javascript
const [paymentError, setPaymentError] = useState(null);
const [canRetry, setCanRetry] = useState(false);

// When payment fails/cancels
if (paymentResult.cancelled) {
  setPaymentError('Payment was not completed');
  setCanRetry(true);
  setIsPaymentProcessing(false);
  setPurchaseInitiated(false);
  return; // Don't close form
}

// Add retry button in UI
{canRetry && paymentError && (
  <Alert 
    severity="warning" 
    action={
      <Button 
        size="small" 
        onClick={() => {
          setCanRetry(false);
          setPaymentError(null);
          // Trigger payment again without recreating order
          handleRetryPayment(lastOrderId, lastRazorpayOrder);
        }}
      >
        Retry Payment
      </Button>
    }
  >
    {paymentError}
  </Alert>
)}
```

---

### Fix 3.2: Better Error Messages

**Create Error Message Mapper:**
```javascript
// src/lib/payments/paymentErrorMessages.js
export const getPaymentErrorMessage = (error) => {
  const errorMap = {
    'Payment configuration error': 'We couldn\'t set up the payment system. Please refresh and try again.',
    'Payment system not ready': 'Payment gateway is loading. Please wait a moment and try again.',
    'Razorpay script not loaded': 'Payment system didn\'t load properly. Please refresh the page.',
    'Payment failed': 'Payment couldn\'t be processed. Please try another payment method.',
    'Payment verification failed': 'Payment was received but couldn\'t be verified. Our team will check and confirm.',
    'Verification error': 'Couldn\'t verify your payment. Please check your orders page in 5 minutes.',
    'Network error': 'Connection lost. Please check your internet and try again.'
  };

  const errorString = error?.message || String(error);
  
  // Check for partial matches
  for (const [key, message] of Object.entries(errorMap)) {
    if (errorString.includes(key)) {
      return message;
    }
  }
  
  return 'Something went wrong. Please try again or contact support if the issue persists.';
};
```

**Use in OrderForm:**
```javascript
catch (paymentError) {
  const userMessage = getPaymentErrorMessage(paymentError);
  showSnackbar(userMessage, 'error');
  setPaymentError(userMessage);
  setCanRetry(true);
}
```

---

### Fix 3.3: Payment Method Guidance

**Add helper text before payment:**
```javascript
{razorpayOrder && amountDueOnline > 0 && (
  <Alert severity="info" sx={{ mb: 2 }}>
    <Typography variant="body2" fontWeight="600">
      Payment Options Available:
    </Typography>
    <Typography variant="caption" component="div">
      • UPI (GPay, PhonePe, Paytm)
      <br />
      • Cards (Credit/Debit)
      <br />
      • Net Banking
      <br />
      • Wallets
    </Typography>
    <Typography variant="caption" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
      💡 Tip: Keep your payment app (GPay/PhonePe) ready before proceeding
    </Typography>
  </Alert>
)}
```

---

## 🧪 TESTING CHECKLIST

### Device Testing:
- [ ] Android Chrome (UPI GPay)
- [ ] Android Chrome (UPI PhonePe)
- [ ] Android Firefox (UPI)
- [ ] iOS Safari (UPI Paytm)
- [ ] Desktop Chrome (All methods)
- [ ] Desktop Safari (All methods)

### Scenario Testing:
- [ ] Normal payment flow (success)
- [ ] User cancels payment (close modal)
- [ ] Payment fails (insufficient funds)
- [ ] Network disconnects mid-payment
- [ ] Script loads slowly
- [ ] Fast navigation to checkout
- [ ] Resume payment after dismissal
- [ ] Multiple payment attempts
- [ ] Webhook arrives before frontend response
- [ ] Webhook arrives after frontend response

### Edge Cases:
- [ ] User switches apps during payment
- [ ] Browser crashes during payment
- [ ] User opens multiple payment modals
- [ ] Session expires during payment
- [ ] Cart changes after order creation
- [ ] Coupon expires during payment

---

## 📊 MONITORING & METRICS

### Add Analytics Events:
```javascript
// Track payment funnel
funnelClient.track('payment_modal_opened', { orderId, amount });
funnelClient.track('payment_method_selected', { method, orderId });
funnelClient.track('payment_completed', { orderId, method, duration });
funnelClient.track('payment_failed', { orderId, error, method });
funnelClient.track('payment_cancelled', { orderId, reason });
funnelClient.track('payment_resumed', { orderId });
funnelClient.track('payment_recovered_by_polling', { orderId });
```

### Server-Side Logging:
```javascript
// Log payment events
console.log('[Payment] Modal opened:', { orderId, timestamp });
console.log('[Payment] Script validation:', { loaded: !!window.Razorpay });
console.log('[Payment] Method selected:', { method, orderId });
console.log('[Payment] Webhook received:', { orderId, status });
console.log('[Payment] Status check:', { orderId, status, attempts });
```

---

## 🚀 DEPLOYMENT STRATEGY

### Phase 1 (Emergency Fixes):
1. Deploy to staging
2. Test all devices
3. Monitor for 2 hours
4. Deploy to production (low-traffic time)
5. Monitor for 24 hours

### Phase 2 (Payment Recovery):
1. Test with real payments in staging
2. Verify localStorage works across browsers
3. Test resume flow
4. Deploy to production
5. A/B test with 50% traffic

### Phase 3 (UX Improvements):
1. Gather user feedback on Phase 1 & 2
2. Iterate on error messages
3. Deploy gradually

---

## 📈 EXPECTED RESULTS

### Week 1 (Phase 1 Complete):
- Conversion: 10-20% → 40-50%
- Mobile UPI success: 5% → 35-40%
- Customer complaints: ↓70%

### Week 2 (Phase 2 Complete):
- Conversion: 40-50% → 55-65%
- Recovered payments: 15-20/day
- Revenue recovery: ₹30,000-40,000/day

### Week 3 (Phase 3 Complete):
- Conversion: 55-65% → 60-75%
- Customer satisfaction: ↑80%
- Support tickets: ↓60%

---

## 🔄 ROLLBACK PLAN

If issues arise:

1. **Immediate Rollback:**
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Feature Flags:**
   ```javascript
   const USE_NEW_PAYMENT_FLOW = process.env.NEXT_PUBLIC_NEW_PAYMENT_FLOW === 'true';
   
   if (USE_NEW_PAYMENT_FLOW) {
     // New implementation
   } else {
     // Old implementation
   }
   ```

3. **Gradual Rollout:**
   - Start with 10% of users
   - Monitor for issues
   - Increase to 50%, then 100%

---

## 📝 SUCCESS CRITERIA

### Must Have (Phase 1):
- ✅ Removed forced UPI intent
- ✅ Script validation added
- ✅ Modal dismiss detection improved
- ✅ Conversion > 35%

### Should Have (Phase 2):
- ✅ Payment state persisted
- ✅ Resume payment UI added
- ✅ Status polling implemented
- ✅ Conversion > 55%

### Nice to Have (Phase 3):
- ✅ Retry mechanism
- ✅ Better error messages
- ✅ Payment guidance
- ✅ Conversion > 65%

---

**Next Steps:**
1. Review and approve this plan
2. Start with Phase 1 implementation
3. Test thoroughly on staging
4. Deploy during low-traffic hours
5. Monitor and iterate

**Estimated Total Time:** 14-20 hours (2-3 days)  
**Estimated Revenue Impact:** ₹27,00,000/month recovery
