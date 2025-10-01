# Business Model - MaddyCustom

**Last Updated**: October 1, 2025

---

## 🏢 Business Overview

MaddyCustom operates a **dual business model** serving both individual consumers (D2C) and business clients (B2B) through an integrated e-commerce platform.

---

## 🛒 D2C (Direct-to-Consumer) Model

### Overview
The primary revenue stream comes from direct sales to individual customers through the online e-commerce platform.

### Customer Flow

#### 1. Discovery Phase
- **Entry Points**:
  - Organic search (SEO)
  - Social media (Instagram, Facebook)
  - Direct navigation
  - UTM campaigns
  - Word of mouth

- **Homepage Features**:
  - Hero carousel with featured products
  - Category grid for easy navigation
  - New arrivals showcase
  - Customer testimonials
  - Why MaddyCustom section

#### 2. Browsing Phase
- **Product Listings**:
  - Category-wise organization
  - Variant-based filtering
  - Search functionality
  - Sort options (price, popularity, new)
  - Tag-based filtering

- **Product Details**:
  - Multiple product images
  - Detailed descriptions
  - Pricing information
  - Availability status
  - Customer reviews
  - Related products

#### 3. Selection Phase
- **Add to Cart**:
  - Variant selection (for wraps)
  - Option selection (colors, sizes)
  - Quantity selection
  - Wrap finish selection (Matte/Glossy)
  - Design group recommendations

- **Cart Management**:
  - Item quantity adjustment
  - Item removal
  - Coupon application
  - Cart summary with pricing
  - Inventory verification

#### 4. Checkout Phase
- **Order Form**:
  - Contact information
  - Multiple address support
  - Address auto-complete
  - Extra fields (bike model, etc.)
  - Delivery instructions

- **Payment Selection**:
  - Full online payment (Razorpay)
  - Cash on Delivery (COD)
  - Partial payment options
  - COD extra charges display

#### 5. Payment Phase
- **Online Payment**:
  - Razorpay integration
  - Multiple payment methods
  - Secure payment gateway
  - Payment verification

- **Order Confirmation**:
  - Order ID generation
  - Email/SMS notification
  - Order tracking link
  - Estimated delivery date

#### 6. Fulfillment Phase
- **Order Processing**:
  - Inventory deduction
  - Shiprocket integration
  - Order status updates
  - Delivery tracking

- **Status Flow**:
  ```
  pending → orderCreated → processing → shipped → 
  onTheWay → delivered
  ```

#### 7. Post-Purchase Phase
- **Order Tracking**:
  - Real-time status updates
  - Shiprocket tracking integration
  - Estimated delivery updates

- **Customer Support**:
  - FAQ section
  - Email support
  - WhatsApp support
  - Order issues resolution

- **Returns/Replacements**:
  - 7-day replacement policy
  - Damaged product protection
  - Easy return process
  - Refund processing

---

## 💼 B2B (Business-to-Business) Model

### Overview
Secondary revenue stream focusing on bulk orders and business inquiries through a dedicated B2B portal.

### B2B Customer Types

#### 1. Fleet Owners
- Corporate vehicle fleets
- Taxi/cab aggregators
- Rental vehicle companies
- Logistics companies

#### 2. Dealers & Resellers
- Vehicle accessory shops
- Customization centers
- Auto dealers
- Bike showrooms

#### 3. Institutional Clients
- Corporate gifting
- Event organizers
- Marketing agencies
- Brand activations

### B2B Flow

#### 1. Entry & Discovery
- **B2B Portal**: Dedicated section at `/b2b`
- **Product Catalog**: Browse full product range
- **Bulk Inquiry Form**: Easy request submission

#### 2. Inquiry Process
```javascript
{
  businessName: "Company Name",
  contactName: "Person Name",
  contactEmail: "email@domain.com",
  contactPhone: "9876543210",
  role: "Procurement Manager",
  address: {
    line1, line2, city, state, pincode, country
  },
  items: [
    {
      product: ObjectId,
      option: ObjectId,
      sku: "string",
      name: "Product Name",
      quantity: 100,
      thumbnail: "image-url",
      wrapFinish: "Matte"
    }
  ],
  notes: "Additional requirements",
  status: "pending" // pending, review, quoted, closed
}
```

#### 3. Quote Generation
- **Review Process**:
  - Sales team reviews inquiry
  - Volume discount calculation
  - Custom pricing preparation
  - Quote document creation

- **Status Updates**:
  - `pending` → New inquiry received
  - `review` → Under evaluation
  - `quoted` → Quote sent to client
  - `closed` → Order confirmed or rejected

#### 4. Order Execution
- **Separate Processing**:
  - Custom order workflow
  - Bulk production planning
  - Quality checks
  - Bulk shipping arrangements

- **Payment Terms**:
  - Net 30/60 payment terms
  - Advance + balance options
  - Bank transfer
  - Purchase orders

---

## 💰 Revenue Streams

### Primary Revenue (B2C)

#### 1. Product Sales
- **Car Wraps**: Premium, mid-range, budget options
- **Bike Wraps**: Full vehicle, partial, accents
- **Accessories**: Seat cushions, fresheners, floor mats
- **Personalization**: Custom stickers, nameplates
- **Safety Gear**: Helmets, visibility products

#### 2. Upselling
- **Design Groups**: Matching product recommendations
- **Combos**: Bundled offers
- **Top Bought Products**: Cross-sell suggestions
- **Recommendations**: AI-powered suggestions

#### 3. Service Add-ons
- **Fast Delivery**: Premium delivery options
- **Installation Support**: Video guides, assistance
- **Custom Design**: Personalization fees

### Secondary Revenue (B2B)

#### 1. Bulk Orders
- Volume-based pricing
- Minimum order quantities
- Custom production runs

#### 2. B2B Services
- Fleet customization
- Corporate branding
- Event supplies
- Dealer support

---

## 📊 Pricing Strategy

### B2C Pricing

#### Dynamic Pricing Model
```javascript
Product Price Components:
- Base Price (cost + margin)
- MRP (Maximum Retail Price)
- Selling Price (discounted)
- Delivery Cost (₹100 default, free above threshold)
- COD Charges (if applicable)
- Extra Charges (per order basis)
```

#### Discount Mechanisms
1. **Coupons**:
   - Percentage off
   - Flat discount
   - Free delivery
   - Minimum cart value requirements

2. **Offers**:
   - Category-specific
   - Product-specific
   - Time-limited
   - First-time user

3. **Combos**:
   - Pre-bundled products
   - Bundle discounts
   - Recommended combinations

### B2B Pricing

#### Bulk Discount Tiers
```javascript
Quantity Tiers:
- 1-50 units: Standard B2B price
- 51-100 units: 10% additional discount
- 101-500 units: 15% additional discount
- 500+ units: Custom negotiation
```

#### Volume Pricing
- Based on order value
- Seasonal pricing
- Contract pricing
- Loyalty discounts

---

## 📦 Inventory Management

### Inventory Modes

#### 1. Inventory-Tracked Products
- **Real-time Stock**: Actual quantity tracking
- **Reserved Quantity**: Cart reservations
- **Available Quantity**: For sale
- **Reorder Level**: Automated alerts
- **Stock Status**: In-stock, out-of-stock, low-stock

#### 2. On-Demand Products
- **No Inventory**: Wraps, custom items
- **Made-to-Order**: Production on order
- **Always Available**: No stock limitations
- **Lead Time**: Production + shipping

### Stock Verification
```javascript
At Checkout:
1. Verify inventory availability
2. Reserve quantities
3. Check inventory limits
4. Handle out-of-stock items
5. Suggest alternatives
```

---

## 🚚 Fulfillment Strategy

### Order Splitting

#### Multi-Category Orders
```javascript
Scenario: Order contains:
- Category A (seperateCategoryShipping: true)
- Category B (standard shipping)

Result:
- 2 separate Shiprocket orders
- Same payment, different shipments
- Linked orders in system
- Unified tracking for customer
```

#### Split Order Fields
```javascript
{
  orderGroupId: "unique-group-id",
  linkedOrderIds: [ObjectId, ObjectId],
  isMainOrder: true/false
}
```

### Shipping Integration

#### Shiprocket Integration
- **Automatic Order Sync**: Order placed → Shiprocket
- **Label Generation**: Automatic shipping labels
- **Tracking**: Real-time tracking updates
- **Status Sync**: Delivery status updates

#### Delivery Timeline
- **Standard**: 5-7 days
- **Express**: 3-5 days (select locations)
- **B2B Bulk**: 10-15 days

---

## 💳 Payment Processing

### Payment Methods

#### 1. Online Payment (Razorpay)
- **Options**:
  - Credit/Debit Cards
  - UPI
  - Net Banking
  - Wallets (Paytm, PhonePe, etc.)
  - EMI options

- **Flow**:
  ```
  Create Razorpay Order → Customer Payment → 
  Webhook Verification → Order Confirmation
  ```

#### 2. Cash on Delivery
- **COD Charges**: Extra fee applies
- **Payment on Delivery**: Customer pays courier
- **Verification**: Amount collection confirmation

#### 3. Partial Payment
- **Online + COD Mix**: Part online, part COD
- **Minimum Online**: Required percentage
- **Balance on Delivery**: Remaining amount

### Payment Status Tracking
```javascript
Payment States:
- pending: Awaiting payment
- failed: Payment attempt failed
- paidPartially: Part paid online
- allPaid: Fully paid online
- allToBePaidCod: Full COD
```

---

## 🎯 Marketing & Customer Acquisition

### Acquisition Channels

#### 1. Organic Search (SEO)
- **Keywords**: Vehicle customization, car wraps, bike accessories
- **Content**: Product pages, blogs, guides
- **Technical SEO**: Fast loading, mobile-optimized
- **Local SEO**: India-focused keywords

#### 2. Social Media
- **Instagram**: Primary platform (6,500+ followers)
- **Content**: Product showcases, customer photos, reels
- **Engagement**: Comments, DMs, stories
- **Influencer**: Partnerships and collaborations

#### 3. Paid Advertising
- **Meta Ads**: Facebook, Instagram campaigns
- **Google Ads**: Search, Display, Shopping
- **UTM Tracking**: Campaign performance measurement
- **Retargeting**: Cart abandonment, product views

#### 4. Word of Mouth
- **Customer Reviews**: On-site reviews
- **Referral Program**: (Future implementation)
- **Social Sharing**: Customer showcases
- **Community Building**: Enthusiast groups

### Retention Strategies

#### 1. Email Marketing
- **Order Confirmations**: Automated emails
- **Shipping Updates**: Delivery notifications
- **Newsletter**: New products, offers
- **Abandoned Cart**: Recovery emails

#### 2. SMS Marketing
- **OTP**: Login verification
- **Order Updates**: Status notifications
- **Promotional**: Offers and discounts
- **Reminders**: Cart abandonment

#### 3. WhatsApp Marketing
- **Customer Support**: Query resolution
- **Updates**: Order and delivery status
- **Notifications**: Restock alerts
- **Engagement**: Personal touch

#### 4. Push Notifications
- **Browser Notifications**: (Future)
- **App Notifications**: (Future)
- **Restock Alerts**: Notify Me system

---

## 📈 Growth Strategy

### Short-term (6-12 months)
1. **Expand Product Range**: New categories and designs
2. **Improve Conversion**: Optimize checkout flow
3. **Enhance UX**: Better product discovery
4. **Social Growth**: Reach 10,000+ followers
5. **Customer Retention**: Loyalty program

### Medium-term (1-2 years)
1. **Mobile App**: Dedicated iOS/Android app
2. **AR Preview**: Virtual try-on for wraps
3. **Franchise Model**: Partner locations
4. **International**: Export to nearby countries
5. **Marketplace**: Multi-vendor platform

### Long-term (3-5 years)
1. **Market Leader**: #1 in India
2. **Technology**: AI-powered customization
3. **Manufacturing**: In-house production
4. **Ecosystem**: Complete vehicle care platform
5. **Sustainability**: Eco-friendly products

---

## 🔄 Business Metrics

### Key Performance Indicators (KPIs)

#### Revenue Metrics
- **GMV** (Gross Merchandise Value)
- **Average Order Value** (AOV)
- **Monthly Recurring Revenue** (MRR)
- **Customer Lifetime Value** (CLV)

#### Operational Metrics
- **Orders per Month**
- **Fulfillment Rate**
- **Delivery Time (Average)**
- **Return/Replacement Rate**

#### Marketing Metrics
- **Customer Acquisition Cost** (CAC)
- **Conversion Rate**
- **Cart Abandonment Rate**
- **Traffic Sources**
- **UTM Performance**

#### Customer Metrics
- **Customer Satisfaction** (CSAT)
- **Net Promoter Score** (NPS)
- **Repeat Purchase Rate**
- **Review Rating (Average)**

---

## 🎁 Value Propositions

### For Customers
- **Wide Selection**: 100+ products across categories
- **Quality Assurance**: Premium materials, guaranteed quality
- **Fast Delivery**: 7-day commitment
- **Easy Returns**: Hassle-free replacement policy
- **Competitive Pricing**: Value for money
- **Personalization**: Unique customization options

### For Business Partners
- **Bulk Discounts**: Volume-based pricing
- **Custom Solutions**: Tailored products
- **Dedicated Support**: B2B assistance
- **Flexible Terms**: Payment and delivery options
- **Quality Consistency**: Reliable product quality
- **Partnership Growth**: Long-term relationships

---

*Building India's largest vehicle personalization ecosystem*
