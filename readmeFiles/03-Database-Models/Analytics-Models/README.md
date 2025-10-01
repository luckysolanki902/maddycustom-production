# Analytics Database Models

This section documents models used for tracking user behavior, analytics, and business intelligence.

## Models Included

### 1. **FunnelEvent** (`src/models/FunnelEvent.js`)
Tracks user journey through the sales funnel.

**Key Fields:**
- `sessionId` (unique session identifier)
- `userId` (reference to User - optional)
- `eventType`: 
  - `"page_view"`
  - `"product_view"`
  - `"add_to_cart"`
  - `"remove_from_cart"`
  - `"begin_checkout"`
  - `"add_shipping_info"`
  - `"add_payment_info"`
  - `"purchase"`
- `eventData` (flexible object for event-specific data)
  - For product_view: `{ productId, productName, category, price }`
  - For add_to_cart: `{ productId, quantity, price, cartValue }`
  - For purchase: `{ orderId, revenue, items[] }`
- `timestamp`
- `source`, `medium`, `campaign` (UTM parameters)
- `deviceType`, `browser`, `platform`
- `referrer`

**Special Features:**
- Session-based tracking
- Anonymous and authenticated tracking
- UTM parameter capture
- Device and browser detection
- Funnel stage identification
- Event metadata storage

**Use Cases:**
- Conversion funnel analysis
- Drop-off point identification
- User journey mapping
- A/B test measurement
- Marketing attribution
- Behavior analytics

---

### 2. **MetaPixelEvent** (`src/models/MetaPixelEvent.js`)
Tracks Facebook/Meta Pixel events for advertising.

**Key Fields:**
- `eventName`: `"PageView"`, `"ViewContent"`, `"AddToCart"`, `"InitiateCheckout"`, `"Purchase"`
- `eventId` (unique event identifier for deduplication)
- `userId` (Meta user ID)
- `fbp`, `fbc` (Facebook browser cookies)
- `eventSourceUrl`
- `eventData` (custom parameters)
  - `content_ids` (product IDs)
  - `content_type` (product/product_group)
  - `value`, `currency`
  - `num_items`
- `timestamp`
- `testEventCode` (for testing)
- `status`: `"pending"`, `"sent"`, `"failed"`

**Special Features:**
- Server-side event tracking
- Event deduplication with eventId
- Browser cookie integration (fbp, fbc)
- Test event support
- Retry mechanism for failed events
- Custom parameters support

**Use Cases:**
- Facebook advertising optimization
- Conversion tracking for Meta ads
- Retargeting campaigns
- Lookalike audience building
- Ad performance measurement
- CAPI (Conversions API) integration

---

### 3. **GoogleAnalyticsEvent** (`src/models/GoogleAnalyticsEvent.js`)
Tracks Google Analytics 4 (GA4) events.

**Key Fields:**
- `clientId` (GA4 client identifier)
- `sessionId`
- `userId` (optional)
- `eventName`: 
  - `"page_view"`
  - `"view_item"`
  - `"add_to_cart"`
  - `"begin_checkout"`
  - `"purchase"`
- `eventParams` (GA4 event parameters)
  - `page_location`, `page_title`
  - `items[]` (product data)
  - `value`, `currency`
  - `transaction_id`
- `timestamp`
- `userProperties` (custom user dimensions)
- `status`: `"pending"`, `"sent"`, `"failed"`

**Special Features:**
- GA4 measurement protocol support
- Server-side event tracking
- E-commerce event structure
- Custom user properties
- Event parameter flexibility
- Batch processing capability

**Use Cases:**
- Google Analytics tracking
- E-commerce analytics
- User behavior analysis
- Traffic source attribution
- Conversion tracking
- Custom dimension tracking

---

### 4. **VisitorSession** (`src/models/VisitorSession.js`)
Tracks visitor sessions and engagement.

**Key Fields:**
- `sessionId` (unique session identifier)
- `userId` (reference to User - if logged in)
- `startTime`, `lastActivityTime`
- `duration` (calculated)
- `pageViews` (count)
- `pages` (array of visited pages with timestamps)
- `source`, `medium`, `campaign` (UTM parameters)
- `device`, `browser`, `platform`, `screenResolution`
- `ipAddress`, `location` (country, city)
- `events` (array of session events)
- `exitPage`
- `bounced` (boolean - single page visit)
- `converted` (boolean - completed purchase)
- `conversionValue`

**Special Features:**
- Session duration tracking
- Page sequence tracking
- Bounce rate calculation
- Conversion tracking
- Geographic information
- Device fingerprinting
- UTM attribution

**Use Cases:**
- Session analysis
- User engagement metrics
- Bounce rate tracking
- Page flow analysis
- Traffic source performance
- Conversion rate optimization
- Geographic targeting

---

### 5. **ProductAnalytics** (`src/models/ProductAnalytics.js`)
Tracks product-level performance metrics.

**Key Fields:**
- `productId` (reference to Product)
- `date` (daily aggregation)
- `views`, `uniqueViews`
- `cartAdds`, `cartRemoves`
- `purchases`, `revenue`
- `conversionRate` (calculated)
- `averageOrderValue`
- `returnRate`
- `wishlistAdds`
- `shareCount`
- `sources` (traffic source breakdown)

**Special Features:**
- Daily metric aggregation
- Performance KPI tracking
- Conversion rate calculation
- Revenue tracking
- Traffic source attribution
- Engagement metrics

**Use Cases:**
- Product performance dashboards
- Inventory planning
- Marketing optimization
- A/B testing product changes
- Pricing strategy analysis
- Product recommendation tuning

---

## Analytics Architecture

### Event Flow:

```
Frontend Action
    ↓
Client-side Tracking (useTracker hook)
    ↓
Analytics Context Manager
    ↓
[Split to multiple destinations]
    ↓
┌──────────────┬─────────────────┬──────────────────┐
│              │                 │                  │
FunnelEvent    MetaPixelEvent   GoogleAnalyticsEvent
(Database)     (Database + FB)   (Database + GA4)
```

### Data Pipeline:

```
1. Event Capture
   - Client-side: Browser events, user interactions
   - Server-side: API requests, backend operations

2. Event Enrichment
   - Add UTM parameters from session
   - Attach user information if authenticated
   - Append device/browser data
   - Include timestamp and session ID

3. Event Storage
   - Store in MongoDB for analysis
   - Queue for external services (Meta, GA4)

4. Event Processing
   - Aggregate daily metrics
   - Calculate conversion rates
   - Build user segments
   - Generate reports

5. Event Forwarding
   - Send to Meta Pixel API
   - Send to Google Analytics 4
   - Send to other integrations
```

---

## Key Metrics Tracked

### Funnel Metrics:
- **Page Views**: Total site traffic
- **Product Views**: Product detail page visits
- **Add to Cart Rate**: (Add to Cart / Product Views)
- **Checkout Initiation**: Users who start checkout
- **Purchase Completion**: Successful orders
- **Overall Conversion Rate**: (Purchases / Page Views)

### E-commerce Metrics:
- **Revenue**: Total sales value
- **Average Order Value (AOV)**: Revenue / Orders
- **Cart Abandonment Rate**: (Carts - Orders) / Carts
- **Product Performance**: Views, conversions per product
- **Category Performance**: Views, revenue per category

### User Engagement:
- **Session Duration**: Average time on site
- **Pages per Session**: Average page views
- **Bounce Rate**: Single-page sessions
- **Return Visitor Rate**: Returning / Total users

### Marketing Attribution:
- **Source Performance**: Traffic and conversions by source
- **Campaign ROI**: Revenue per campaign
- **Channel Effectiveness**: Conversion rate by channel
- **Customer Acquisition Cost (CAC)**: Ad spend / New customers

---

## Integration Points

### Frontend Tracking:
- `src/components/analytics/FunnelClientBridge.js`: Client-side event capture
- `src/contexts/PageContext.js`: Page view tracking
- `src/hooks/useTracker.js`: Custom tracking hook

### Backend Processing:
- `src/lib/analytics/trackFunnelEvent.js`: Server-side funnel tracking
- `src/lib/analytics/trackMetaPixel.js`: Meta Pixel server events
- `src/lib/analytics/trackGoogleAnalytics.js`: GA4 server events

### Data Analysis:
- Aggregate queries for dashboards
- Export to BI tools (Power BI, Tableau)
- Custom reports for stakeholders

---

## Privacy & Compliance

### GDPR Considerations:
- User consent tracking
- Data anonymization options
- Right to deletion support
- Cookie consent management

### Data Retention:
- Raw events: 90 days
- Aggregated metrics: 2 years
- User profiles: Until account deletion

### PII Handling:
- Hash email addresses
- Anonymize IP addresses (last octet)
- No sensitive data in event metadata
- Secure storage of user data

---

## Analytics Queries

### Common Analytics Queries:

1. **Conversion Funnel:**
   ```javascript
   const funnelStages = await FunnelEvent.aggregate([
     { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
     { $group: { _id: '$eventType', count: { $sum: 1 } } },
     { $sort: { count: -1 } }
   ]);
   ```

2. **Product Performance:**
   ```javascript
   const topProducts = await ProductAnalytics.find({
     date: { $gte: startDate, $lte: endDate }
   }).sort({ revenue: -1 }).limit(10);
   ```

3. **Session Analysis:**
   ```javascript
   const avgSessionDuration = await VisitorSession.aggregate([
     { $match: { startTime: { $gte: startDate } } },
     { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
   ]);
   ```

4. **Campaign Attribution:**
   ```javascript
   const campaignPerformance = await FunnelEvent.aggregate([
     { $match: { eventType: 'purchase', campaign: { $exists: true } } },
     { $group: { 
       _id: '$campaign', 
       conversions: { $sum: 1 },
       revenue: { $sum: '$eventData.revenue' }
     } }
   ]);
   ```

---

## Dashboards & Reports

### Available Dashboards:
1. **Real-time Analytics**: Live visitor count, current conversions
2. **Sales Dashboard**: Daily/weekly/monthly revenue, orders, AOV
3. **Product Dashboard**: Top products, category performance
4. **Funnel Dashboard**: Conversion rates, drop-off points
5. **Marketing Dashboard**: Campaign performance, traffic sources
6. **User Dashboard**: New vs returning, geographic distribution

---

## Next Steps
- Explore funnel tracking implementation in `07-Analytics-Tracking/`
- Review analytics components in `05-UI-Components/`
- Check analytics API endpoints in `06-API-Reference/`
