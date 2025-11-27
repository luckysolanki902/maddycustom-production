# Payment Webhook Logs Reference

## Log Messages for Successful Payment

### 1. Razorpay Webhook
```
[timestamp] Processing payment capture for 2 orders
[timestamp] Order 674... status -> allPaid
[timestamp] Calling centralized payment success handler
[timestamp] Processing 2 orders
[timestamp] ✅ Coupon usage incremented: WELCOME10
[timestamp] Deducting inventory for order 674...
  - Updating inventory for Option 673... x 1
[timestamp] ✅ Inventory deducted for order 674...
[timestamp] Creating Shiprocket order for 674...
[timestamp] ✅ Shiprocket order created: 123456
[timestamp] Sending analytics events for main order
✅ Funnel purchase event tracked successfully
✅ Meta Purchase event sent successfully via CAPI
✅ Google Ads Purchase event sent successfully
[timestamp] ✅ WhatsApp message sent to user 672...
```

### 2. PayU Webhook
```
🔔 [PayU Webhook] Incoming request
📦 [PayU Webhook] Payload parsed successfully
🔄 [PayU Webhook] Processing payment response...
[timestamp] Processing payment success for 2 orders
[timestamp] Order 674... status -> allPaid
[timestamp] Calling centralized payment success handler
[timestamp] Processing 2 orders
[timestamp] ✅ Coupon usage incremented: FIRST50
[timestamp] Deducting inventory for order 674...
  - Updating inventory for Product 671... x 2
[timestamp] ✅ Inventory deducted for order 674...
[timestamp] Creating Shiprocket order for 674...
[timestamp] ✅ Shiprocket order created: 123457
[timestamp] Sending analytics events for main order
✅ Funnel purchase event tracked successfully
✅ Meta Purchase event sent successfully via CAPI
✅ Google Ads Purchase event sent successfully
[timestamp] ✅ WhatsApp message sent to user 672...
✅ [PayU Webhook] Order updates applied successfully
```

## Log Messages for Failed Payment

### Razorpay
```
[timestamp] Order 674... status -> failed
Webhook processed successfully for orderId: 674...
```

### PayU
```
⚠️ [PayU Webhook] Payment failure received
[timestamp] Order 674... status -> failed
Payment failure processed
```

## Error Scenarios

### Missing Analytics Info
```
⚠️ No analyticsInfo available, skipping Meta CAPI event
```

### Inventory Update Issues
```
⚠️ Option 673... has no inventoryData reference
⚠️ Product 671... has no inventoryData reference
⚠️ Order item missing product/option reference
```

### Shiprocket Issues
```
⚠️ Order 674... missing address, skipping Shiprocket
❌ Shiprocket error: Invalid pincode
⚠️ Shiprocket response invalid or packaging error
```

### Analytics Event Failures
```
⚠️ Funnel purchase event failed: Network timeout
⚠️ Meta Purchase event failed: Invalid pixel ID
⚠️ Google Ads Purchase event failed: API error
```

### WhatsApp Notification Issues
```
⚠️ User not found for order 674...
❌ WhatsApp error: Template not found
Skipping WhatsApp (testing order)
```

## Structured Log Fields

### Common Fields (all logs)
```json
{
  "level": "info|warn|error",
  "timestamp": "2025-11-25T10:30:00.000Z",
  "component": "PaymentSuccess|RazorpayWebhook|PayUWebhook"
}
```

### Payment Processing
```json
{
  "orderCount": 2,
  "paymentProvider": "razorpay|payu",
  "orderIds": ["674...", "675..."],
  "txnId": "txn_123...",
  "paymentId": "pay_123..."
}
```

### Inventory Deduction
```json
{
  "orderId": "674...",
  "productId": "671...",
  "optionId": "673...",
  "quantity": 2
}
```

### Shiprocket Creation
```json
{
  "orderId": "674...",
  "shiprocketOrderId": "123456"
}
```

### Analytics Events
```json
{
  "orderId": "674...",
  "eventID": "uuid-v4",
  "value": 1599
}
```

### Errors
```json
{
  "error": "Error message",
  "stack": "Error stack trace",
  "orderId": "674...",
  "context": "Additional context"
}
```

## Monitoring & Alerts

### Critical Errors (Alert Required)
- Transaction rollback
- Hash verification failure
- Order not found

### Warnings (Monitor)
- Missing analyticsInfo
- Analytics event failures
- Shiprocket creation failures
- WhatsApp notification failures

### Success Metrics (Dashboard)
- Payment success rate
- Average processing time
- Analytics event success rate
- Shiprocket creation success rate

## Debugging Tips

### Check Order Status
1. Look for "Order X status -> Y" logs
2. Verify payment details update
3. Check inventoryDeducted flag

### Trace Payment Flow
1. Search by orderId or txnId
2. Follow chronological order of logs
3. Check for "centralized handler" invocation

### Analytics Issues
1. Check if analyticsInfo exists in order
2. Verify external_id and fbp values
3. Check Meta/Google API response status

### Shiprocket Issues
1. Verify address completeness
2. Check dimensions calculation
3. Look for packaging_box_error

## Log Search Queries

### Find All Orders for a User
```
component:RazorpayWebhook OR component:PayUWebhook userId:672...
```

### Find Failed Payments
```
"status -> failed"
```

### Find Analytics Failures
```
level:error AND (Meta OR Google)
```

### Find Shiprocket Errors
```
Shiprocket AND (error OR failed OR ⚠️)
```

### Find Inventory Issues
```
"no inventoryData" OR "inventory deduct"
```
