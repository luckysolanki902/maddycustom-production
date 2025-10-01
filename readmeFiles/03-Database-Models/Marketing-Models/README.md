# Marketing Database Models

This section documents database models related to marketing, promotions, campaigns, and customer engagement.

## Models Included

### 1. **Coupon** (`src/models/Coupon.js`)
Discount codes and promotional offers.

**Key Fields:**
- `code` (unique coupon code)
- `description`
- `discountType`: `"percentage"` or `"fixed"`
- `discountValue`
- `minPurchaseAmount`
- `maxDiscountAmount` (cap for percentage discounts)
- `validFrom`, `validUntil`
- `usageLimit`, `usedCount`
- `isActive`
- `applicableCategories` (category restrictions)
- `applicableProducts` (product restrictions)

**Special Features:**
- Multiple discount types (percentage/fixed)
- Usage limits and tracking
- Category/product restrictions
- Minimum purchase requirements
- Time-bound validity
- Maximum discount caps

**Use Cases:**
- Promotional campaigns
- Seasonal sales
- First-time buyer discounts
- Cart value incentives
- Category-specific promotions
- Recommendation drawer unlocks

---

### 2. **Offer** (`src/models/Offer.js`)
Site-wide promotional banners and offers.

**Key Fields:**
- `title`, `description`
- `offerType`: `"banner"`, `"popup"`, `"inline"`
- `discountText` (e.g., "50% OFF")
- `image`, `mobileImage`
- `ctaText`, `ctaLink`
- `priority` (display order)
- `targetAudience`: `"all"`, `"new"`, `"returning"`
- `displayLocations` (array: homepage, shop, cart)
- `validFrom`, `validUntil`
- `isActive`

**Special Features:**
- Multi-format support (banner, popup, inline)
- Responsive images (desktop/mobile)
- Audience targeting
- Location-based display
- Priority-based ordering
- Time-bound visibility

**Use Cases:**
- Homepage hero banners
- Flash sale announcements
- Popup promotions
- Category-specific offers
- Cart abandonment incentives

---

### 3. **CampaignLog** (`src/models/CampaignLog.js`)
Tracks marketing campaign performance.

**Key Fields:**
- `campaignName`
- `source`, `medium`, `campaign` (UTM parameters)
- `userId` (reference to User)
- `sessionId`
- `events` (array of tracked events)
  - `eventType`: `"page_view"`, `"add_to_cart"`, `"purchase"`, etc.
  - `timestamp`
  - `metadata` (additional event data)
- `totalRevenue`
- `conversionStatus`: `"active"`, `"converted"`, `"abandoned"`

**Special Features:**
- UTM parameter tracking
- Event timeline recording
- Revenue attribution
- Session tracking
- Conversion funnel analysis

**Use Cases:**
- Marketing campaign ROI analysis
- Attribution modeling
- User journey tracking
- A/B test measurement
- Campaign optimization

---

### 4. **HappyCustomer** (`src/models/HappyCustomer.js`)
Customer testimonials and reviews display.

**Key Fields:**
- `name`
- `review`, `rating`
- `image`, `videoUrl`
- `productId` (reference to Product - optional)
- `orderNumber`
- `location`
- `isFeatured`, `isVerified`
- `displayOrder`
- `approvalStatus`: `"pending"`, `"approved"`, `"rejected"`

**Special Features:**
- Video/image testimonials
- Product-specific reviews
- Verification system
- Featured review highlighting
- Admin approval workflow

**Use Cases:**
- Homepage testimonials
- Product page social proof
- Marketing materials
- Trust building
- SEO-rich content

---

### 5. **DisplayAssets** (`src/models/DisplayAssets.js`)
Dynamic content management for banners, images, videos.

**Key Fields:**
- `type`: `"banner"`, `"video"`, `"image"`, `"carousel"`
- `title`, `description`
- `assetUrl`, `thumbnailUrl`
- `displayLocation`: `"homepage"`, `"shop"`, `"product"`, `"category"`
- `targetCategory`, `targetProduct`
- `ctaText`, `ctaLink`
- `priority` (display order)
- `startDate`, `endDate`
- `isActive`

**Special Features:**
- Multi-media support
- Location-based targeting
- Category/product targeting
- Scheduled display periods
- Priority ordering

**Use Cases:**
- Dynamic homepage content
- Seasonal banners
- Product showcase videos
- Category headers
- Promotional carousels

---

### 6. **offer_ref** (`src/models/offer_ref.js`)
Legacy offer reference system (potentially deprecated).

**Purpose:** Links offers to specific products or categories for backward compatibility.

**Key Fields:**
- `offerId` (reference to Offer)
- `productId` (reference to Product)
- `categoryId` (reference to Category)
- `isActive`

**Note:** This model may be part of an older system. Check if still in active use.

---

## Marketing Workflows

### Coupon Application Flow:
```
1. User enters coupon code at checkout
2. Validate: code exists, active, not expired, usage limit
3. Check: minimum purchase, category/product restrictions
4. Calculate: discount based on type (percentage/fixed)
5. Apply: discount to order total
6. Increment: usedCount
7. Create: order with coupon details
```

### Campaign Tracking Flow:
```
1. User visits site with UTM parameters
2. Capture: source, medium, campaign from URL
3. Create: CampaignLog entry with sessionId
4. Track: page_view event
5. Monitor: add_to_cart, checkout events
6. Record: purchase event with revenue
7. Update: conversionStatus to "converted"
8. Analyze: campaign ROI and attribution
```

### Offer Display Logic:
```
1. Fetch active offers for current page location
2. Filter by: validFrom/validUntil date range
3. Filter by: targetAudience (new/returning user)
4. Sort by: priority field
5. Select: highest priority offer
6. Display: based on offerType (banner/popup/inline)
```

---

## Integration Points

### With Core Models:
- **Coupon → Order**: Discount applied during checkout
- **CampaignLog → User**: Attribution tracking per user
- **HappyCustomer → Product**: Product-specific testimonials
- **DisplayAssets → Category/Product**: Targeted content display

### With Analytics:
- Campaign tracking feeds into analytics dashboards
- Coupon usage tracked for marketing ROI
- Offer impressions and click-through rates

### With Frontend:
- `src/components/dialogs/RecommendationDrawer.js`: Coupon unlock feature
- `src/components/showcase/OfferBanner.js`: Dynamic offer display
- `src/components/showcase/Testimonials.js`: Happy customer showcase

---

## Admin Management

Marketing models are typically managed through admin interfaces:

1. **Coupon Management:**
   - Create/edit coupon codes
   - Set validity periods and usage limits
   - Monitor coupon usage statistics
   - Deactivate expired/overused coupons

2. **Campaign Management:**
   - Configure UTM tracking parameters
   - Monitor campaign performance
   - Analyze conversion funnels
   - Generate campaign reports

3. **Content Management:**
   - Upload promotional banners
   - Schedule seasonal content
   - Manage testimonials approval
   - Update homepage carousels

---

## Best Practices

1. **Coupon Security:**
   - Use unique, hard-to-guess codes
   - Implement rate limiting on validation
   - Track abuse patterns
   - Set reasonable usage limits

2. **Campaign Tracking:**
   - Standardize UTM parameter naming
   - Track full user journey, not just conversions
   - Store attribution data with orders
   - Regular campaign data cleanup

3. **Content Display:**
   - Optimize image sizes for performance
   - Test responsive display on mobile
   - Use priority ordering strategically
   - Schedule content changes in advance

---

## Next Steps
- Review marketing API endpoints in `06-API-Reference/`
- Check campaign tracking implementation in `07-Analytics-Tracking/`
- Explore frontend marketing components in `05-UI-Components/`
