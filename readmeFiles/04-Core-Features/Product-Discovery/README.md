# Product Discovery Features

This section documents features that help customers find the right products.

## Discovery Mechanisms

### 1. 🏷️ Category Navigation System

#### Category Hierarchy
Three-level category structure for organization.

**Levels:**
```
Category (Top Level)
  └─ SpecificCategory (Mid Level)
      └─ SubCategory (Detailed Level)
```

**Example:**
```
Home Decor
  └─ Wall Art
      ├─ Paintings
      ├─ Wall Hangings
      └─ Photo Frames
  └─ Lighting
      ├─ Table Lamps
      ├─ Floor Lamps
      └─ Ceiling Lights
```

**Implementation:**
- `src/models/Category.js`: Top-level categories
- `src/models/SpecificCategory.js`: Mid-level with custom fields
- `subCategory` field in Product model

**Navigation Components:**
- **CategoryGrid**: Homepage category tiles
- **MegaMenu**: Expandable navigation menu
- **Breadcrumbs**: Current location indicator
- **CategorySidebar**: Filter by category tree

---

#### Dynamic Category Pages
Each category has customized display.

**Features per Category:**
- **Custom Banner**: Category-specific hero image
- **Category Description**: SEO-rich text
- **Featured Products**: Curated selections
- **Filter Options**: Based on `extraFields`
  - Example: Wall Art → Size, Material, Style
- **Sort Options**: Relevant to category
- **Product Info Tabs**: Category-specific details

**Configuration:**
Category behavior defined in `SpecificCategory` model:
```javascript
{
  name: "Wall Art",
  extraFields: [
    { name: "size", type: "dropdown", values: ["Small", "Medium", "Large"] },
    { name: "material", type: "dropdown", values: ["Canvas", "Paper", "Wood"] },
    { name: "style", type: "dropdown", values: ["Modern", "Abstract", "Realistic"] }
  ],
  inventoryMode: "inventory", // or "on-demand"
  productInfoTabs: [
    { title: "Care Instructions", content: "..." },
    { title: "Shipping", content: "..." }
  ]
}
```

---

### 2. 🔎 Advanced Search System

#### Search Implementation (`src/components/dialogs/SearchCategoryDialog.js`)

**Search Capabilities:**
- **Text Search**: Product name, description, tags
- **SKU Search**: Direct product lookup
- **Category Search**: Find by category name
- **Fuzzy Matching**: Handles typos and variations

**Search Algorithm:**
```javascript
// Weighted search scoring
name match: 10 points
exact SKU match: 10 points
tag match: 5 points
category match: 3 points
description match: 1 point
```

**Search Features:**
- **Instant Results**: As-you-type search
- **Debouncing**: 300ms delay to reduce requests
- **Highlighting**: Matched terms highlighted
- **Suggestions**: "Did you mean...?" for typos
- **Recent Searches**: Last 5 searches saved
- **Popular Searches**: Trending search terms
- **Voice Search**: (Future feature)

---

#### Search Result Display

**Result Card:**
- Product thumbnail
- Product name (highlighted match)
- Price with discount indicator
- Category breadcrumb
- Availability status
- Quick view button
- Add to cart (quick action)

**Result Grouping:**
```
Products (12 results)
  ├─ Exact Matches (3)
  ├─ Related Products (7)
  └─ Suggested Products (2)

Categories (2 results)
  ├─ Wall Art (145 products)
  └─ Wall Decor (89 products)
```

**Empty State:**
- "No results found for [query]"
- Suggestions based on:
  - Similar products
  - Popular products
  - Recent searches
- Search tips

---

### 3. 🎯 Smart Product Recommendations

#### Recommendation Engine
Multiple recommendation strategies.

**Recommendation Types:**

1. **Design Group Recommendations**
   - Products with same `designGroupId`
   - Show in: RecommendationDrawer, Product page
   - Logic: Same design, different variants
   - Use case: "View this design in other colors"

2. **Related Products**
   - Same category + price range (±30%)
   - Show in: Product detail page bottom
   - Logic: Similar products customer might like
   - Use case: "Customers also viewed"

3. **Frequently Bought Together**
   - Based on order history analysis
   - Show in: Product page, Cart page
   - Logic: Products purchased together
   - Use case: "Complete the look"

4. **Category Trending**
   - Most viewed/purchased in category
   - Show in: Category pages, Homepage
   - Logic: Popular products in timeframe
   - Use case: "Trending in Wall Art"

5. **Personalized Recommendations**
   - Based on browsing history
   - Show in: Homepage, Account page
   - Logic: User interests + behavior
   - Use case: "Recommended for you"

---

#### Recommendation Drawer System
Special drawer with coupon unlock feature.

**Trigger:** After adding product to cart

**Display:**
- Products from same `designGroupId`
- 3-6 product cards
- Quick add to cart
- Variant selectors

**Coupon Unlock Feature:**
```
Progress Bar: [████░░░░░░] 1/2 items

"Add 1 more item from this collection 
to unlock a 10% discount!"

Unlocked: "🎉 Coupon DESIGN10 unlocked!"
```

**Logic:**
- Check designGroupId of added product
- Count cart items with same designGroupId
- Threshold: 2+ items = unlock coupon
- Auto-apply coupon when unlocked
- Show success animation

**Benefits:**
- Increases average order value
- Encourages design exploration
- Creates excitement
- Gamifies shopping

---

### 4. 🏆 Product Sorting & Filtering

#### Sort Options

**Available Sorts:**
1. **Relevance** (Default)
   - Search: Match score
   - Browse: Featured + new arrivals

2. **Price: Low to High**
   - Ascending price order
   - Use case: Budget shoppers

3. **Price: High to Low**
   - Descending price order
   - Use case: Premium seekers

4. **Newest First**
   - By `createdAt` date
   - Use case: Trend followers

5. **Most Popular**
   - By `views` or `purchases` count
   - Use case: Social proof seekers

6. **Best Rated** (if reviews enabled)
   - By average rating
   - Use case: Quality seekers

**Implementation:**
```javascript
// URL: /shop/wall-art?sort=price-low
const sortOptions = {
  'relevance': { isFeatured: -1, isNewArrival: -1, createdAt: -1 },
  'price-low': { price: 1 },
  'price-high': { price: -1 },
  'newest': { createdAt: -1 },
  'popular': { views: -1, purchases: -1 }
};
```

---

#### Filter System

**Filter Types:**

1. **Category Filter**
   - Hierarchical tree
   - Multi-select
   - Shows product count per category

2. **Price Range Filter**
   - Slider (min-max)
   - Quick ranges: Under ₹500, ₹500-₹1000, etc.
   - Input fields for exact values

3. **Dynamic Attribute Filters**
   - Based on `SpecificCategory.extraFields`
   - Examples:
     - Size: Small, Medium, Large
     - Color: Red, Blue, Green
     - Material: Wood, Metal, Canvas
   - Multi-select checkboxes

4. **Availability Filter**
   - In Stock Only
   - Include Out of Stock
   - Pre-order Available

5. **Rating Filter** (if reviews enabled)
   - 4+ stars, 3+ stars, etc.
   - Star icons for visual selection

6. **Brand Filter** (if applicable)
   - Brand list with counts
   - Multi-select

**Filter UI:**
- Collapsible sections
- "Show More" for long lists
- Active filter badges
- Clear all filters button
- Filter count indicator

**URL State:**
```
/shop/wall-art?
  filters[size]=medium,large&
  filters[color]=blue&
  price_min=500&
  price_max=2000&
  in_stock=true&
  sort=price-low
```

---

### 5. 🆕 New Arrivals & Featured Products

#### New Arrivals Section
Showcase latest products.

**Identification:**
- `isNewArrival: true` in Product model
- Or: Products created in last 30 days
- Display: Homepage, Shop page banner

**Display Options:**
- Horizontal scrollable carousel
- Grid layout with "NEW" badge
- Dedicated "New Arrivals" page

**Features:**
- "New" badge on product cards
- Sort by newest first by default
- Email notification subscribers (future)

---

#### Featured Products
Curated product highlights.

**Identification:**
- `isFeatured: true` in Product model
- Manually selected by admin
- Can be category-specific

**Display Locations:**
- Homepage hero section
- Category page top
- Search results (prioritized)
- Recommendation slots

**Use Cases:**
- Seasonal promotions
- High-margin products
- Limited edition items
- Brand collaborations

---

### 6. 📊 Product Tagging System

#### Tag Management
Flexible product categorization.

**Tag Types:**
- **Style Tags**: Modern, Vintage, Minimalist
- **Occasion Tags**: Wedding, Birthday, Festival
- **Material Tags**: Wood, Metal, Fabric
- **Color Tags**: Blue, Red, Multicolor
- **Feature Tags**: Handmade, Eco-friendly, Customizable

**Tag Usage:**
- Search enhancement
- Filter options
- Related product matching
- SEO keywords
- Social media tagging

**Implementation:**
```javascript
// Product model
tags: ['modern', 'wall-art', 'canvas', 'large', 'abstract']

// Tag-based search
db.products.find({ tags: { $in: ['modern', 'minimalist'] } })
```

---

### 7. 🎨 Visual Discovery

#### Product Image Gallery
Rich visual experience.

**Features:**
- Multiple product images (4-10)
- Primary image + variants
- Zoom on hover (desktop)
- Full-screen lightbox
- 360° view (future)
- Video showcase (if available)

**Image Optimization:**
- Lazy loading
- Responsive images (srcset)
- WebP format with fallback
- CDN delivery (CloudFront)
- Compression without quality loss

---

#### Visual Search (Future Feature)
Search by uploading image.

**Planned Features:**
- Upload or drag-drop image
- AI-based visual similarity matching
- Show visually similar products
- Filter by color, style, category
- Reverse image search

---

### 8. 🔔 Product Alerts & Notifications

#### Back-in-Stock Alerts
Notify when out-of-stock product available.

**User Flow:**
1. View out-of-stock product
2. Click "Notify Me" button
3. Enter email/phone
4. Receive notification when restocked

**Implementation:**
- Store: `productId` + `userContact` in database
- Trigger: Inventory update hook
- Send: Email/SMS/WhatsApp notification
- Unsubscribe: After notification or manual opt-out

---

#### Price Drop Alerts
Track products for price reductions.

**User Flow:**
1. View product
2. Click "Track Price" (wishlist + alert)
3. Receive notification on price drop

**Logic:**
- Monitor product price changes
- Alert if price drops by X% (e.g., 10%+)
- Weekly digest of tracked products
- Include coupon opportunities

---

### 9. 📱 Trending & Social Proof

#### Trending Products Widget
Show popular items in real-time.

**Metrics:**
- Most viewed (last 24 hours)
- Most added to cart (last 7 days)
- Most purchased (last 30 days)
- Fastest selling (velocity)

**Display:**
- "🔥 Trending Now" section
- Trending badge on product cards
- Homepage carousel
- Category pages

---

#### Social Proof Indicators
Build trust and urgency.

**Indicators:**
- "X people viewing this now"
- "Sold X units in last 24 hours"
- "Only X items left in stock"
- "⭐ X verified buyers"
- "Added to Y carts today"

**Implementation:**
- Real-time counters (WebSocket)
- Cached aggregations
- Privacy-respecting (no personal data)
- Dynamic updates

---

## Discovery Analytics

### Tracked Metrics:
- **Search Analytics:**
  - Top search queries
  - No-result searches (opportunity to add products)
  - Search-to-purchase conversion
  - Average results per search

- **Category Performance:**
  - Category page views
  - Products viewed per category
  - Category conversion rates
  - Popular category paths

- **Recommendation Effectiveness:**
  - Recommendation impressions
  - Click-through rates
  - Add-to-cart from recommendations
  - Revenue from recommendations

- **Filter Usage:**
  - Most used filters
  - Filter combinations
  - Clear filter rate
  - Filter-to-purchase path

---

## SEO Optimization

### Product SEO:
- Dynamic meta titles/descriptions
- Structured data (Product schema)
- Optimized URLs (slugs)
- Image alt texts
- Rich snippets (price, availability, ratings)

### Category SEO:
- Category descriptions (keyword-rich)
- Internal linking structure
- Category meta tags
- Sitemap inclusion
- Canonical URLs

---

## Next Steps
- Explore shopping cart in `Shopping-Experience/`
- Review checkout flow in `Business-Operations/`
- Check product APIs in `06-API-Reference/Product-APIs/`
- See UI components in `05-UI-Components/Product-Components/`
