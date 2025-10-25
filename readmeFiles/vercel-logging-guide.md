# Vercel Logging Guide

## Overview

Vercel automatically captures all `console.log`, `console.error`, `console.warn`, and `console.info` statements from your serverless functions. These logs are available in the Vercel dashboard under **Logs**.

## Accessing Logs in Vercel

### Via Dashboard:
1. Go to https://vercel.com/dashboard
2. Select your project (maddycustom-production)
3. Click on **Logs** tab
4. Filter by:
   - **Deployment** (specific deploy)
   - **Branch** (main, staging, etc.)
   - **Time range** (last hour, day, week)
   - **Log level** (errors, warnings, info)
   - **Search** (keyword search)

### Via CLI:
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# View real-time logs
vercel logs maddycustom-production --follow

# View logs for specific function
vercel logs maddycustom-production --filter="api/checkout"

# View last 100 logs
vercel logs maddycustom-production -n 100
```

## Structured Logging

We've implemented a structured logger at `src/lib/utils/logger.js` that provides:

### Basic Usage:
```javascript
import { logger, paymentLogger, orderLogger } from '@/lib/utils/logger';

// Info level
logger.info('User action completed', { userId: '123', action: 'login' });

// Error level
logger.error('Database connection failed', { error: err.message });

// Payment-specific
paymentLogger.payment('Payment initiated', {
  orderId: 'ORD123',
  amount: 599,
  method: 'UPI'
});

// With context
const checkoutLogger = logger.child('Checkout');
checkoutLogger.info('Order created', { orderId: 'ORD123' });
```

### Log Levels:
- **debug** - Development only, detailed debugging info
- **info** - General information (user actions, API calls)
- **warn** - Warning, something unexpected but not critical
- **error** - Errors that need attention
- **payment** - Payment-specific events (with 💰 prefix)
- **webhook** - Webhook events (with 🔔 prefix)

### Production Format:
In production on Vercel, logs are automatically JSON-formatted:
```json
{
  "timestamp": "2025-10-25T10:30:45.123Z",
  "level": "payment",
  "context": "Payment",
  "message": "[Payment] 💰 Payment initiated",
  "data": {
    "orderId": "ORD123",
    "amount": 599,
    "method": "UPI"
  },
  "environment": "production",
  "runtime": "server"
}
```

## Payment Flow Logging

All payment-related functions now include comprehensive logging:

### 1. Payment Initiation (makePayment.js):
```javascript
[Payment] Initializing payment for order: ORD123
[Payment] Razorpay script already loaded
[Payment] Opening Razorpay modal...
```

### 2. Payment Success:
```javascript
[Payment] Payment successful, verifying...
  { orderId: 'ORD123', paymentId: 'pay_ABC123' }
[Payment] Verification successful
```

### 3. Payment Dismissal:
```javascript
[Payment] Modal dismissed
  { paymentStarted: false, orderId: 'ORD123' }
[Payment] Starting 10s grace period for payment completion...
[Payment] Grace period ended, checking payment status with server...
[Payment] Status check result:
  { isPaid: true, paymentStatus: 'allPaid' }
[Payment] Payment confirmed by webhook! Recovering...
```

### 4. Payment Failure:
```javascript
[Payment] Payment failed: Insufficient funds
```

### 5. Script Loading:
```javascript
[Razorpay] Waiting for script to load...
[Razorpay] Script loaded after 200ms
```

## API Endpoint Logging

### Order Status Check (`/api/checkout/order/status/[orderId]`):
```javascript
// Success
{
  "level": "info",
  "message": "[Payment] Checking order status",
  "data": { "orderId": "ORD123" }
}
{
  "level": "info",
  "message": "[Payment] Order status retrieved",
  "data": {
    "orderId": "ORD123",
    "paymentStatus": "allPaid",
    "isPaid": true,
    "hasPaymentId": true
  }
}

// Error
{
  "level": "error",
  "message": "[Payment] Status check failed",
  "data": {
    "orderId": "ORD123",
    "error": "Database connection timeout",
    "stack": "Error: timeout\n  at..."
  }
}
```

## Monitoring Payment Issues

### Search Queries in Vercel Dashboard:

1. **All payment events:**
   ```
   [Payment]
   ```

2. **Payment failures:**
   ```
   "Payment failed" OR "Payment] Payment failed"
   ```

3. **Recovered payments:**
   ```
   "Payment confirmed by webhook! Recovering"
   ```

4. **Script loading issues:**
   ```
   "Razorpay script not loaded" OR "Razorpay script failed to load"
   ```

5. **Modal dismissals:**
   ```
   "Modal dismissed"
   ```

6. **Order status checks:**
   ```
   "Checking order status"
   ```

7. **Verification errors:**
   ```
   "Verification failed" OR "Verification error"
   ```

## Real-time Monitoring

### Set up Vercel Integrations:

1. **Slack Integration:**
   - Go to Vercel Dashboard > Settings > Integrations
   - Add Slack
   - Configure to send error alerts to #tech-alerts channel

2. **Webhook Integration:**
   - Create webhook endpoint for critical errors
   - Configure to trigger on:
     - Deployment errors
     - Function errors
     - High error rates

3. **Log Drains (Enterprise):**
   If you upgrade to Vercel Enterprise, you can drain logs to:
   - Datadog
   - Logflare
   - Axiom
   - Custom HTTP endpoint

## Performance Metrics

Vercel also provides:
- Function execution time
- Cold start metrics
- Memory usage
- Request count
- Error rate

Access via: **Dashboard > Analytics**

## Best Practices

1. **Always log critical events:**
   - Payment initiated
   - Payment success/failure
   - Order creation
   - Webhook received
   - User authentication

2. **Include context:**
   ```javascript
   // Bad
   logger.error('Payment failed');
   
   // Good
   logger.error('Payment failed', {
     orderId: 'ORD123',
     userId: 'USER456',
     amount: 599,
     error: err.message,
     paymentMethod: 'UPI'
   });
   ```

3. **Use appropriate log levels:**
   - Don't use `error` for expected failures (like user cancellation)
   - Use `warn` for unexpected but non-critical issues
   - Use `info` for normal flow tracking

4. **Avoid logging sensitive data:**
   - Don't log passwords, API keys, credit card numbers
   - Hash or mask user emails if needed
   - Don't log full Razorpay responses (may contain sensitive data)

5. **Log before and after critical operations:**
   ```javascript
   logger.info('Creating order', { userId, cartTotal });
   const order = await createOrder(data);
   logger.info('Order created successfully', { orderId: order._id });
   ```

## Troubleshooting

### Logs not appearing?
1. Check if function is actually executing (add `console.log` at entry point)
2. Verify deployment is successful
3. Check correct deployment in Logs filter
4. Wait 1-2 minutes for logs to appear

### Too many logs?
1. Add log level filtering in production
2. Use debug level for verbose logs
3. Implement log sampling for high-traffic endpoints

### Logs missing context?
1. Use structured logger instead of plain console.log
2. Always include orderId, userId, or relevant IDs
3. Use logger.child() for contextual logging

## Example: Complete Payment Flow Logs

```javascript
// User submits order
[OrderForm] Ensuring Razorpay script is loaded...
[Razorpay] Script already loaded
[OrderForm] Razorpay script confirmed loaded
[Payment] Initializing payment for order: 67123abc
[Payment] Opening Razorpay modal...

// User selects UPI and switches to GPay
[Payment] Modal dismissed { paymentStarted: false, orderId: '67123abc' }
[Payment] Starting 10s grace period for payment completion...

// Webhook arrives (different function)
[Webhook] 🔔 Razorpay webhook received { event: 'payment.captured' }
[Webhook] Payment captured for order: 67123abc

// Status check (10 seconds later)
[Payment] Grace period ended, checking payment status with server...
[Payment] Checking order status { orderId: '67123abc' }
[Payment] Order status retrieved {
  orderId: '67123abc',
  paymentStatus: 'allPaid',
  isPaid: true
}
[Payment] Payment confirmed by webhook! Recovering...

// OrderForm receives success
[OrderForm] Payment recovered from webhook!
```

This complete log trail helps you:
- Verify payment flow
- Debug issues
- Track timing
- Identify patterns
- Monitor success rates

## Alert Setup

Create alerts for:
1. Payment failure rate > 5%
2. Razorpay script not loading
3. Verification failures
4. Database errors
5. High latency (>3s for payment operations)

Configure via Vercel Dashboard > Settings > Alerts (Pro plan required)
