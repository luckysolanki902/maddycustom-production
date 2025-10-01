# Shopping Experience Features

This section documents the core customer-facing shopping features and user journey.

## Features Overview

### 1. 🛍️ Product Browsing & Discovery

#### Homepage (`src/app/page.js`)
The main entry point for customers.

**Components:**
- **HeroCarousel**: Rotating banners with promotional content
- **CategoryGrid**: Quick navigation to product categories
- **NewArrival**: Showcase of latest products
- **WhyMaddy**: Brand value propositions
- **Testimonials**: Customer reviews and social proof

**Features:**
- Dynamic content from `DisplayAssets` model
- Featured products highlighting
- Category-based navigation
- SEO-optimized meta tags

---

#### Shop Page (`src/app/shop/[...slug]/page.js`)
Dynamic routing for categories and products.

**URL Patterns:**
- `/shop` - All products
- `/shop/category` - Category listing
- `/shop/category/product-slug` - Product detail

**Features:**
- SSR (Server-Side Rendering) for SEO
- Dynamic breadcrumbs
- Category filtering
- Product listing with pagination
- Product detail view

**Product Listing Components:**
- ProductCard: Individual product display
- FilterSidebar: Category, price, attribute filters
- SortDropdown: Price, popularity, newest sorting
- PaginationControls: Navigate product pages

**Product Detail Components:**
- ProductGallery: Image carousel with zoom
- ProductInfo: Name, price, description
- VariantSelector: Size, color, material options
- AddToCartButton: Primary CTA
- ProductTabs: Description, specifications, reviews
- RelatedProducts: Recommendations based on designGroupId

---

### 2. 🛒 Shopping Cart System

#### Cart State Management (`src/store/slices/cartSlice.js`)
Redux slice for cart operations.

**State Structure:**
```javascript
{
  items: [
    {
      productId,
      name,
      price,
      quantity,
      image,
      selectedVariant: { size, color, material },
      wrapFinish: 'matte' | 'glossy' | null
    }
  ],
  totalItems: 5,
  totalPrice: 2499,
  inventoryGate: true, // Require inventory check
  appliedCoupon: { code, discount },
  shippingEstimate: 99
}
```

**Actions:**
- `addToCart`: Add product with variants
- `removeFromCart`: Remove item
- `updateQuantity`: Change item quantity
- `clearCart`: Empty cart
- `applyCoupon`: Apply discount code
- `toggleInventoryGate`: Enable/disable inventory checking

---

#### Cart Drawer (`src/components/dialogs/CartDrawer.js`)
Slide-out cart panel for quick view.

**Features:**
- Full-screen overlay on mobile
- Item list with thumbnails
- Quantity adjustment controls
- Remove item option
- Subtotal calculation
- "View Cart" button (opens full cart page)
- Continue shopping option

**UX Enhancements:**
- Auto-open on first add-to-cart
- Smooth slide animation
- Item count badge
- Empty cart state illustration

---

#### Cart Page (`src/app/viewcart/page.js`)
Full cart view and checkout preparation.

**Sections:**

1. **Cart Items Table:**
   - Product image and name
   - Selected variant details
   - Price per unit
   - Quantity selector
   - Remove button
   - Subtotal per item

2. **Wrap Finish Selection:**
   - Option for each item
   - Matte or Glossy finish
   - Visual samples
   - Price modifier

3. **Order Summary:**
   - Subtotal
   - Shipping estimate
   - Discount (if coupon applied)
   - Tax calculation
   - **Grand Total**

4. **Coupon Application:**
   - Input field for coupon code
   - "Apply" button
   - Success/error message
   - Coupon details display

5. **Checkout Button:**
   - Primary CTA
   - Disabled if cart empty
   - Redirects to order form

**Features:**
- Inventory gate check before checkout
- Out-of-stock warnings
- Quantity limits based on availability
- Save cart for later (logged-in users)
- Continue shopping link

---

### 3. 🔍 Product Search

#### Search Dialog (`src/components/dialogs/SearchCategoryDialog.js`)
Global search interface.

**Features:**
- Instant search with debouncing
- Search by:
  - Product name
  - SKU
  - Category
  - Tags
- Search results with:
  - Product image
  - Name and price
  - Category breadcrumb
  - Quick view option
- Recent searches (localStorage)
- Popular searches suggestions
- No results state with suggestions

**Implementation:**
- Fuzzy matching for typos
- Weighted search (name > tags > description)
- Client-side filtering for speed
- API fallback for comprehensive results

---

#### Filter & Sort System

**Filters Available:**
- **Category**: Hierarchical category tree
- **Price Range**: Min-max slider
- **Attributes**: Dynamic based on category
  - Size, Color, Material, etc.
- **Availability**: In stock only
- **Ratings**: Star rating filter
- **Brand**: If applicable

**Sort Options:**
- **Relevance** (default)
- **Price: Low to High**
- **Price: High to Low**
- **Newest First**
- **Most Popular** (by views/sales)
- **Best Rated**

**URL State Management:**
- Filter state in URL query params
- Shareable filtered URLs
- Browser back/forward support
- Clear filters option

---

### 4. 💡 Product Recommendations

#### Recommendation Drawer (`src/components/dialogs/RecommendationDrawer.js`)
Smart product suggestions during shopping.

**Trigger Points:**
- After adding product to cart
- On product detail page
- In cart view (cross-sell)

**Recommendation Logic:**
- **Same Design Group**: Products with same `designGroupId`
  - Different colors/variants of same design
  - Encourages design exploration
- **Frequently Bought Together**: Based on order history
- **Similar Products**: Category + price range match
- **Trending in Category**: Popular products in same category

**Coupon Unlock Feature:**
Special in-drawer offer system:
```
"Add one more item from this collection 
to unlock a 10% discount coupon!"
```

**Features:**
- Product cards with quick add
- Price display
- Variant selection inline
- Coupon progress indicator
- "Continue Shopping" or "Go to Cart" options

---

#### Related Products Section
On product detail pages.

**Display:**
- Horizontal scrollable carousel
- 4-6 product cards
- Quick view option
- Add to wishlist button

**Logic:**
- Products in same `designGroupId`
- Same category products
- Recently viewed products

---

### 5. 🎯 Personalization Features

#### Wishlist System

**Features:**
- Heart icon on product cards
- Add/remove from wishlist
- Wishlist page with saved items
- Move to cart option
- Share wishlist (future)
- Price drop alerts (future)

**Storage:**
- Logged-in: Database (`User.wishlist`)
- Guest: localStorage with sync on login

---

#### Recently Viewed Products

**Features:**
- Track last 10 viewed products
- Display in sidebar or dedicated section
- Quick navigation to revisit products
- Clear history option

**Implementation:**
- localStorage for guests
- Database tracking for logged-in users
- Exclude from recommendations to avoid duplicates

---

### 6. 🎁 Gift Wrapping & Customization

#### Wrap Finish Selection
Per-item customization option.

**Options:**
- **Matte Finish**: Premium matte paper
- **Glossy Finish**: Shiny glossy paper
- **No Wrap**: Standard packaging

**UI:**
- Radio buttons with visual samples
- Price difference indicator
- Preview image of wrap styles
- Selection saved in cart item

---

#### Letter/Text Customization
For customizable products.

**Features:**
- Text input for custom letters
- Character limit display
- Preview rendering
- Font selection (if applicable)
- Color selection (if applicable)
- Additional cost calculation

**Implementation:**
- `letterMapping` from `SpecificCategory`
- Validation of allowed characters
- Preview generation
- Custom text saved in order item details

---

### 7. 📱 Mobile Shopping Experience

#### Responsive Design
Optimized for all devices.

**Mobile-Specific Features:**
- Touch-friendly buttons (min 44x44px)
- Swipeable product galleries
- Full-screen search
- Bottom navigation for key actions
- Collapsible filters
- Sticky "Add to Cart" button
- Quick product view (bottom sheet)

#### Progressive Web App (PWA)
Installable web app capabilities.

**Features:**
- Add to home screen
- Offline product browsing (cached)
- Push notifications (order updates)
- Fast loading with service worker
- App-like experience

**Configuration:**
- `src/app/manifest.js`: PWA manifest
- Service worker for caching
- Offline fallback page

---

### 8. 🚚 Shipping Countdown Timer

#### Cart Timer (`src/store/slices/uiSlice.js`)
Urgency indicator for same-day shipping.

**Features:**
- "Order in next 2h 34m for same-day dispatch"
- Real-time countdown
- Different messages based on time:
  - Before 3 PM: Same-day shipping
  - After 3 PM: Next-day shipping
- Creates urgency to complete purchase

**Implementation:**
- Redux state: `shippingTimer`
- Countdown component in cart
- Time-zone aware calculations

---

## User Journey Maps

### First-Time Visitor Journey:
```
1. Land on Homepage
   ↓
2. Browse Categories or Hero Carousel
   ↓
3. Click Category → Product Listing
   ↓
4. Apply Filters → Find Product
   ↓
5. View Product Details
   ↓
6. Select Variant (size, color)
   ↓
7. Add to Cart → Cart Drawer Opens
   ↓
8. See Recommendations → Add More (optional)
   ↓
9. View Cart → Review Items
   ↓
10. Apply Coupon (if available)
   ↓
11. Proceed to Checkout
   ↓
12. Fill Order Form → Complete Purchase
```

### Returning Customer Journey:
```
1. Land on Homepage
   ↓
2. Check Recently Viewed or Wishlist
   ↓
3. Direct to Product (knows what they want)
   ↓
4. Quick Add to Cart
   ↓
5. Checkout (saved address pre-filled)
   ↓
6. Complete Purchase Faster
```

---

## Performance Optimizations

### Product Listing:
- Server-side rendering for SEO
- Image lazy loading
- Pagination (20 items per page)
- Cached category data
- Debounced filtering

### Product Detail:
- Priority image loading (first image)
- Related products lazy load
- Reviews loaded on scroll
- Variant images preloaded on hover

### Cart Operations:
- Optimistic UI updates
- Background inventory checks
- Debounced quantity updates
- Local storage cart backup

---

## Analytics Integration

### Tracked Events:
- `product_view`: Product detail page view
- `add_to_cart`: Item added to cart
- `remove_from_cart`: Item removed
- `view_cart`: Cart page visited
- `begin_checkout`: Checkout initiated
- `recommendation_view`: Recommendations shown
- `coupon_applied`: Discount code used
- `variant_changed`: Product variant selected

### Data Captured:
- Product ID, name, price, category
- Variant selections
- Cart value at each stage
- Time spent on product pages
- Recommendation click-through rate
- Coupon effectiveness

---

## Next Steps
- Explore checkout flow in `Business-Operations/`
- Review UI components in `05-UI-Components/`
- Check shopping APIs in `06-API-Reference/Product-APIs/`
- See product discovery features in `Product-Discovery/`
