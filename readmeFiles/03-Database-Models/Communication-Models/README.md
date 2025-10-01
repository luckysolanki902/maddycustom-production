# Communication Database Models

This section documents models for notifications, messaging, and customer communication.

## Models Included

### 1. **Notification** (`src/models/Notification.js`)
System notifications and alerts to users.

**Key Fields:**
- `userId` (reference to User - null for system-wide)
- `type`: 
  - `"order_confirmation"`
  - `"order_shipped"`
  - `"order_delivered"`
  - `"payment_reminder"`
  - `"low_stock_alert"`
  - `"promotional"`
  - `"system"`
- `title`, `message`
- `icon`, `image`
- `link` (notification action URL)
- `priority`: `"low"`, `"normal"`, `"high"`, `"urgent"`
- `read` (boolean)
- `readAt` (timestamp)
- `sentAt`, `createdAt`
- `expiresAt`
- `channels` (array: `"in-app"`, `"email"`, `"sms"`, `"whatsapp"`)
- `deliveryStatus` (object)
  - `inApp`, `email`, `sms`, `whatsapp` (each: `"pending"`, `"sent"`, `"failed"`)

**Special Features:**
- Multi-channel delivery tracking
- Priority-based notification system
- Read/unread status
- Expiration support
- Deep linking to relevant pages
- User-specific and broadcast modes

**Use Cases:**
- Order status updates
- Payment confirmations
- Shipping notifications
- Promotional announcements
- System alerts
- Admin notifications
- Low stock alerts

---

### 2. **NotificationTemplate** (`src/models/NotificationTemplate.js`)
Templates for consistent notification formatting.

**Key Fields:**
- `name` (template identifier)
- `type` (notification type)
- `subject` (for email/SMS)
- `bodyTemplate` (with variable placeholders)
- `emailTemplate` (HTML template)
- `smsTemplate` (plain text)
- `whatsappTemplate` (formatted text with WhatsApp template ID)
- `variables` (array of available placeholders)
  - `{ name: 'orderNumber', type: 'string', required: true }`
  - `{ name: 'totalAmount', type: 'number', required: true }`
- `channels` (array: applicable delivery channels)
- `isActive`

**Special Features:**
- Variable placeholder system
- Channel-specific templates
- Template versioning
- Dynamic content rendering
- Multi-language support (future)

**Use Cases:**
- Standardized order confirmations
- Consistent brand messaging
- Easy template updates
- A/B testing different messages
- Localized content (future)

**Example Template:**
```
Name: order_confirmation
Subject: "Order #{orderNumber} Confirmed"
Body: "Hi {customerName}, your order #{orderNumber} for ₹{totalAmount} has been confirmed. Expected delivery: {deliveryDate}."
Variables: [orderNumber, customerName, totalAmount, deliveryDate]
```

---

### 3. **CustomTemplate** (`src/models/CustomTemplate.js`)
User-generated or admin-created custom message templates.

**Key Fields:**
- `userId` (creator - null for admin templates)
- `name`, `description`
- `templateType`: `"email"`, `"sms"`, `"whatsapp"`
- `content` (template content)
- `variables` (custom placeholders)
- `category`: `"marketing"`, `"transactional"`, `"support"`
- `isPublic` (shareable template)
- `usageCount`
- `lastUsed`

**Special Features:**
- User-created templates
- Template sharing
- Usage analytics
- Template categories
- Custom variable definitions

**Use Cases:**
- Marketing email templates
- Custom SMS campaigns
- WhatsApp message templates
- Support response templates
- B2B customer templates

---

### 4. **EmailLog** (`src/models/EmailLog.js`)
Tracks all email communications.

**Key Fields:**
- `to`, `from`, `cc`, `bcc`
- `subject`
- `body` (HTML or plain text)
- `templateId` (reference to NotificationTemplate)
- `userId` (recipient user)
- `orderId` (related order - if applicable)
- `status`: `"queued"`, `"sent"`, `"delivered"`, `"bounced"`, `"failed"`
- `provider`: `"aws-ses"`, `"sendgrid"`, `"smtp"`
- `providerMessageId`
- `sentAt`, `deliveredAt`, `openedAt`
- `opened`, `clicked` (tracking)
- `errorMessage`

**Special Features:**
- Delivery tracking
- Open/click tracking
- Error logging
- Provider integration
- Retry mechanism

**Use Cases:**
- Email delivery monitoring
- Bounce rate tracking
- Engagement analytics
- Delivery troubleshooting
- Compliance logging

---

### 5. **SMSLog** (`src/models/SMSLog.js`)
Tracks SMS communications.

**Key Fields:**
- `phoneNumber`
- `message`
- `templateId` (reference to NotificationTemplate)
- `userId` (recipient user)
- `orderId` (related order - if applicable)
- `status`: `"queued"`, `"sent"`, `"delivered"`, `"failed"`
- `provider`: `"twilio"`, `"msg91"`, `"textlocal"`
- `providerMessageId`
- `sentAt`, `deliveredAt`
- `cost` (SMS cost)
- `errorMessage`

**Special Features:**
- Delivery confirmation
- Cost tracking
- Provider integration
- DLR (Delivery Receipt) tracking
- Error logging

**Use Cases:**
- OTP delivery
- Order notifications
- Delivery updates
- Payment reminders
- Marketing messages

---

### 6. **WhatsAppLog** (`src/models/WhatsAppLog.js`)
Tracks WhatsApp Business API messages.

**Key Fields:**
- `phoneNumber`
- `message`
- `templateName` (WhatsApp approved template)
- `templateParams` (variable values)
- `mediaUrl` (image/video/document)
- `userId` (recipient user)
- `orderId` (related order - if applicable)
- `status`: `"queued"`, `"sent"`, `"delivered"`, `"read"`, `"failed"`
- `provider`: `"aisensy"`, `"twilio"`, `"360dialog"`
- `providerMessageId`
- `sentAt`, `deliveredAt`, `readAt`
- `errorMessage`

**Special Features:**
- Template message support
- Media attachments
- Read receipts
- Delivery tracking
- Interactive messages (future)

**Use Cases:**
- Order confirmations
- Shipping updates
- Customer support
- Marketing campaigns
- Rich media sharing

---

## Communication Workflows

### Order Confirmation Flow:
```
1. Order created
2. Fetch NotificationTemplate: "order_confirmation"
3. Render template with order variables
4. Create Notification in database
5. Send via configured channels:
   - Email → EmailLog (AWS SES)
   - SMS → SMSLog (MSG91)
   - WhatsApp → WhatsAppLog (AiSensy)
   - In-app → User notification center
6. Track delivery status
7. Update notification deliveryStatus
```

### Notification Priority System:
```
Urgent (P0):
  - Payment failures
  - Order cancellations
  - Critical system alerts

High (P1):
  - Order confirmations
  - Shipping updates
  - Payment reminders

Normal (P2):
  - Delivery confirmations
  - Product recommendations
  - Newsletter

Low (P3):
  - Promotional offers
  - General updates
  - Tips & tutorials
```

### Multi-Channel Delivery:
```javascript
// Example: Send order confirmation via all channels
const notification = await Notification.create({
  userId: order.userId,
  type: 'order_confirmation',
  title: 'Order Confirmed',
  message: `Order #${order.orderNumber} confirmed`,
  channels: ['in-app', 'email', 'sms', 'whatsapp'],
  priority: 'high'
});

// Email
await sendEmail({
  template: 'order_confirmation',
  variables: { orderNumber, totalAmount, ... }
});

// SMS
await sendSMS({
  template: 'order_confirmation_sms',
  variables: { orderNumber, customerName }
});

// WhatsApp
await sendWhatsApp({
  templateName: 'order_confirmation_approved',
  params: [orderNumber, totalAmount]
});
```

---

## Integration Points

### Email Service (AWS SES):
- Configuration: `src/lib/email/emailService.js`
- Template rendering: `src/lib/email/templates/`
- Bounce handling: Webhook endpoint
- Open/click tracking: Pixel + link tracking

### SMS Service (MSG91/Twilio):
- Configuration: `src/lib/sms/smsService.js`
- OTP generation: `src/lib/sms/otp.js`
- DLR webhook: Delivery status updates
- Cost optimization: Template caching

### WhatsApp Business (AiSensy):
- Configuration: `src/lib/whatsapp/whatsappService.js`
- Template management: Approved templates list
- Media upload: S3 integration
- Interactive messages: Button templates

---

## Notification System Features

### In-App Notifications:
- Real-time updates via WebSocket (future)
- Notification center UI component
- Badge count on notification icon
- Mark as read/unread
- Archive old notifications

### Email Features:
- HTML responsive templates
- Plain text fallback
- Attachment support
- Unsubscribe links
- Open/click tracking

### SMS Features:
- Unicode support (multilingual)
- Link shortening
- Opt-out handling
- Cost monitoring
- Rate limiting

### WhatsApp Features:
- Template messages (pre-approved)
- Media messages (images, PDFs)
- Quick reply buttons
- List messages
- Location sharing (future)

---

## Best Practices

### Template Design:
1. Keep messages concise and clear
2. Use personalization variables
3. Include clear call-to-action
4. Test on multiple devices/clients
5. A/B test subject lines and content

### Delivery Optimization:
1. Respect user preferences
2. Implement frequency capping
3. Schedule non-urgent messages
4. Use appropriate priority levels
5. Handle failures gracefully with retries

### Compliance:
1. Include unsubscribe links (email)
2. Respect opt-out requests (SMS/WhatsApp)
3. Follow GDPR guidelines
4. Maintain communication logs
5. Get consent for marketing messages

### Monitoring:
1. Track delivery rates per channel
2. Monitor bounce/fail rates
3. Analyze open/click rates
4. Alert on delivery issues
5. Regular template performance review

---

## Notification Hooks & Events

### Frontend Hook:
```javascript
// src/hooks/useNotificationSystem.js
const { notifications, markAsRead, deleteNotification } = useNotificationSystem();
```

### Backend Events:
```javascript
// Order confirmation
eventBus.emit('order.created', { order });

// Shipping update
eventBus.emit('order.shipped', { order, trackingUrl });

// Payment reminder
eventBus.emit('payment.reminder', { order });
```

---

## Admin Tools

### Notification Management:
- Send broadcast notifications
- View notification logs
- Monitor delivery metrics
- Test templates
- Manage user preferences

### Template Management:
- Create/edit templates
- Preview with sample data
- Version control
- A/B test variants
- Approve WhatsApp templates

### Analytics Dashboard:
- Delivery rate by channel
- Open rate (email)
- Click-through rate
- Bounce rate
- Cost per notification

---

## Next Steps
- Review notification components in `05-UI-Components/Notifications/`
- Check notification APIs in `06-API-Reference/`
- Explore notification templates in `src/models/NotificationTemplate.js`
- See notification system summary: `NOTIFICATION_SYSTEM_SUMMARY.md`
