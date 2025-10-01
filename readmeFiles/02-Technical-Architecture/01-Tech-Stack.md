# Technical Architecture - MaddyCustom Platform

**Last Updated**: October 1, 2025  
**Version**: 4.0.0

---

## 🏗️ Technology Stack

### Frontend
- **Framework**: Next.js 15.0.0 (App Router)
- **UI Library**: React 18.3.1
- **State Management**: Redux Toolkit 2.3.0 + Redux Persist 6.0.0
- **UI Components**: Material-UI (MUI) 6.1.5
- **Styling**: CSS Modules + Emotion (CSS-in-JS)
- **Animations**: Framer Motion 12.12.1 + React Spring 9.7.4
- **Forms**: React Hook Form 7.53.1
- **File Upload**: React Dropzone 14.3.5
- **Charts**: Recharts 3.1.0
- **Carousel**: Swiper 11.1.14
- **Image Optimization**: Next.js Image Component
- **Fonts**: Google Fonts (Krona One, Jost, Montserrat)

### Backend
- **Runtime**: Node.js (via Next.js API Routes)
- **Database**: MongoDB 6.10.0 (via Mongoose 8.8.2)
- **ORM**: Mongoose
- **API**: REST (Next.js API Routes)
- **Middleware**: Custom middleware + Next.js middleware

### Third-Party Services

#### Payment
- **Razorpay**: Payment gateway (2.9.5)
- **Methods**: Cards, UPI, Net Banking, Wallets, COD

#### Communication
- **Twilio**: SMS (5.4.5)
- **MSG91**: SMS and OTP
- **AiSensy**: WhatsApp messaging
- **Nodemailer**: Email (6.10.0)

#### Cloud & Storage
- **AWS S3**: Image and asset storage (@aws-sdk/client-s3: 3.740.0)
- **CloudFront**: CDN for static assets
- **AWS SES**: Email service (@aws-sdk/client-ses: 3.777.0)

#### Shipping
- **Shiprocket**: Logistics and order fulfillment

#### Analytics
- **Meta Pixel**: Facebook/Instagram tracking
- **Google Analytics**: GA4 (via googleapis: 144.0.0)
- **Google Tag Manager**: Tag management
- **Custom Funnel Tracking**: In-house analytics system

#### AI/ML
- **OpenAI**: GPT integration (4.90.0)

#### Development
- **Vercel**: Hosting and deployment
- **GitHub**: Version control

---

## 📁 Project Structure

```
maddycustom/
├── public/                          # Static assets
│   ├── images/                      # Product images, assets
│   │   ├── assets/                  # Icons, logos, graphics
│   │   │   ├── icons/              # Icon files
│   │   │   └── logos/              # Brand logos
│   │   └── metadata/               # SEO images
│   ├── videos/                      # Product videos
│   └── seo/                         # SEO files (sitemap, robots)
│
├── src/
│   ├── app/                         # Next.js 15 App Router
│   │   ├── layout.js               # Root layout
│   │   ├── page.js                 # Homepage
│   │   ├── error.js                # Error boundary
│   │   ├── not-found.js            # 404 page
│   │   ├── loading.js              # Loading state
│   │   ├── manifest.js             # PWA manifest
│   │   ├── robots.js               # Robots.txt generator
│   │   ├── sitemap.js              # Sitemap generator
│   │   │
│   │   ├── about-us/               # Static pages
│   │   ├── contact-us/
│   │   ├── faqs/
│   │   ├── termsandconditions/
│   │   │
│   │   ├── shop/                   # Product pages
│   │   │   └── [...slug]/          # Dynamic product routes
│   │   │       └── page.js
│   │   │
│   │   ├── orders/                 # Order management
│   │   │   ├── [orderId]/
│   │   │   └── track/
│   │   │
│   │   ├── user/                   # User account
│   │   │   ├── login/
│   │   │   ├── profile/
│   │   │   └── orders/
│   │   │
│   │   ├── viewcart/               # Cart page (redirects)
│   │   │
│   │   ├── b2b/                    # B2B portal
│   │   │
│   │   └── api/                    # API Routes
│   │       ├── admin/              # Admin operations
│   │       ├── analytics/          # Analytics tracking
│   │       ├── auth/               # Authentication
│   │       ├── checkout/           # Checkout flow
│   │       ├── inventory/          # Inventory management
│   │       ├── notifications/      # Notification system
│   │       ├── order/              # Order processing
│   │       ├── products/           # Product APIs
│   │       ├── user/               # User management
│   │       └── webhooks/           # External webhooks
│   │
│   ├── components/                 # React components
│   │   ├── layouts/                # Layout components
│   │   │   ├── Topbar.js
│   │   │   ├── Sidebar.js
│   │   │   ├── Footer.js
│   │   │   └── ReduxProvider.js
│   │   │
│   │   ├── full-page-comps/       # Page-level components
│   │   │   ├── ProductsPage.js    # Product listing
│   │   │   ├── ProductIdPage.js   # Product detail
│   │   │   └── ViewCart.js        # Cart view
│   │   │
│   │   ├── dialogs/               # Modals and drawers
│   │   │   ├── CartDrawer.js
│   │   │   ├── RecommendationDrawer.js
│   │   │   └── SearchCategoryDialog.js
│   │   │
│   │   ├── cards/                 # Card components
│   │   │   ├── ProductCard.js
│   │   │   └── CategoryCard.js
│   │   │
│   │   ├── showcase/              # Display components
│   │   │   ├── carousels/
│   │   │   ├── sliders/
│   │   │   ├── products/          # Product showcase
│   │   │   │   └── TopBoughtProducts.js
│   │   │   └── banners/
│   │   │
│   │   ├── page-sections/         # Homepage sections
│   │   │   └── homepage/
│   │   │       ├── HeroCarousel.js
│   │   │       ├── CategoryGrid.js
│   │   │       ├── NewArrival.js
│   │   │       ├── WhyMaddy.js
│   │   │       └── VoiceOfCustomers.js
│   │   │
│   │   ├── analytics/             # Analytics components
│   │   │   ├── FunnelClientBridge.js
│   │   │   ├── UTMCapture.js
│   │   │   └── GoogleTagManager.js
│   │   │
│   │   ├── Forms/                 # Form components
│   │   ├── utils/                 # Utility components
│   │   ├── animations/            # Animation components
│   │   ├── contexts/              # Context providers
│   │   └── notifications/         # Notification components
│   │
│   ├── contexts/                  # React contexts
│   │   ├── PageContext.js
│   │   └── ScrollContext.js
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── useCaptureUTM.js
│   │   ├── useHistoryState.js
│   │   ├── usePageType.js
│   │   └── useScrollNavigation.js
│   │
│   ├── store/                     # Redux store
│   │   ├── index.js              # Store configuration
│   │   └── slices/               # Redux slices
│   │       ├── cartSlice.js
│   │       ├── uiSlice.js
│   │       ├── utmSlice.js
│   │       ├── variantsSlice.js
│   │       ├── orderFormSlice.js
│   │       ├── userBehaviorSlice.js
│   │       ├── b2bSlice.js
│   │       └── notificationSlice.js
│   │
│   ├── models/                    # Mongoose models
│   │   ├── Product.js
│   │   ├── Order.js
│   │   ├── User.js
│   │   ├── Inventory.js
│   │   ├── SpecificCategory.js
│   │   ├── SpecificCategoryVariant.js
│   │   ├── B2BOrder.js
│   │   ├── Coupon.js
│   │   ├── Notification.js
│   │   ├── analytics/
│   │   │   ├── FunnelSession.js
│   │   │   └── FunnelEvent.js
│   │   └── ...
│   │
│   ├── lib/                       # Utility libraries
│   │   ├── analytics/             # Analytics utilities
│   │   │   ├── funnelClient.js   # Client-side funnel tracking
│   │   │   ├── funnelService.js  # Server-side funnel service
│   │   │   └── pageClassifier.js # Page type classification
│   │   │
│   │   ├── api/                   # API utilities
│   │   ├── aws.js                 # AWS SDK configuration
│   │   ├── constants/             # Constants
│   │   │   ├── seoConsts.js
│   │   │   ├── productsPageConsts.js
│   │   │   └── typewriterCategories.js
│   │   │
│   │   ├── crypto/                # Encryption utilities
│   │   ├── email/                 # Email utilities
│   │   ├── merchant/              # Payment utilities
│   │   ├── metadata/              # SEO metadata
│   │   │   ├── create-metadata.js
│   │   │   └── json-lds.js       # Schema.org structured data
│   │   │
│   │   ├── middleware/            # Custom middleware
│   │   │   └── connectToDb.js    # MongoDB connection
│   │   │
│   │   ├── payments/              # Payment processing
│   │   │   └── makePayment.js
│   │   │
│   │   ├── server/                # Server utilities
│   │   └── utils/                 # General utilities
│   │       └── fetchutils.js     # Data fetching
│   │
│   ├── styles/                    # Global styles
│   │   └── globals.css
│   │
│   └── middleware.js              # Next.js middleware
│
├── scripts/                       # Utility scripts
│   ├── create-default-templates.js
│   ├── inspect-funnel-events.mjs
│   └── warm-cache.js
│
├── readmeFiles/                   # Documentation
│   ├── README.md                  # Main documentation index
│   ├── 01-Overview/               # Business overview
│   ├── 02-Architecture/           # Technical architecture
│   ├── 03-Data-Models/            # Database schemas
│   ├── 04-Features/               # Feature documentation
│   ├── 05-Components/             # Component documentation
│   ├── 06-APIs/                   # API documentation
│   ├── 07-Analytics/              # Analytics documentation
│   └── 08-Development/            # Developer guides
│
├── tests/                         # Test files
├── .env.local                     # Environment variables
├── .gitignore
├── next.config.mjs                # Next.js configuration
├── jsconfig.json                  # JavaScript configuration
├── package.json                   # Dependencies
└── vercel.json                    # Vercel configuration
```

---

## 🔄 Application Flow

### 1. User Journey Flow
```
Landing (/) 
  → Browse Products (/shop/...)
    → View Product Details (/shop/.../product)
      → Add to Cart (Redux State)
        → View Cart (Drawer)
          → Checkout (Order Form)
            → Payment (Razorpay/COD)
              → Order Confirmation
                → Order Tracking (/orders/[orderId])
```

### 2. Data Flow

#### Client-Side
```
User Action 
  → Component Event
    → Redux Action
      → State Update
        → Component Re-render
          → UI Update
```

#### Server-Side
```
API Request 
  → Route Handler (/app/api/...)
    → Validation (Zod/Custom)
      → Database Connection (MongoDB)
        → Model Operation (Mongoose)
          → Response
            → Client Update
```

---

## 🗄️ Database Architecture

### MongoDB Collections

#### Core Collections
- **products**: Product catalog
- **options**: Product variations (color, size)
- **specificcategories**: Detailed categories
- **specificcategoryvariants**: Category variants
- **orders**: Customer orders
- **b2borders**: Bulk inquiries
- **users**: Customer accounts
- **inventories**: Stock tracking

#### Marketing Collections
- **coupons**: Discount coupons
- **offers**: Promotional offers
- **combos**: Product bundles
- **displayassets**: Homepage content

#### Analytics Collections
- **funnelsessions**: User sessions
- **funnelevents**: Tracking events
- **utmhistories**: Campaign tracking
- **processedEvents**: Event deduplication

#### Communication Collections
- **notifications**: User notifications
- **notificationtemplates**: Message templates

#### Support Collections
- **reviews**: Product reviews
- **supportrequests**: Customer inquiries
- **faqs**: Frequently asked questions

---

## 🔐 State Management

### Redux Store Structure

```javascript
{
  cart: {
    items: [],
    inventoryGate: {}
  },
  ui: {
    isSidebarOpen: false,
    isCartDrawerOpen: false,
    isRecommendationDrawerOpen: false,
    // ... other UI states
  },
  utm: {
    utmDetails: {},
    history: []
  },
  variants: {
    cache: {},
    lastUpdated: {}
  },
  orderForm: {
    addresses: [],
    selectedAddress: null,
    // ... form data
  },
  userBehavior: {
    timeSpent: {},
    scrollPositions: {},
    // ... behavior data
  },
  b2b: {
    selectedProducts: [],
    // ... B2B state
  },
  // ... other slices
}
```

### Persistence
- **redux-persist**: Persists cart, UTM, user preferences
- **Storage**: LocalStorage for web
- **Whitelist**: Selective persistence of slices

---

## 🌐 API Architecture

### API Route Structure
```
/api/
├── admin/              # Admin operations
├── analytics/          # Tracking endpoints
│   └── track-funnel   # Funnel event tracking
├── auth/              # Authentication
│   ├── send-otp
│   └── verify-otp
├── checkout/          # Checkout flow
│   ├── create-order
│   ├── verify-payment
│   └── bestcoupon
├── inventory/         # Inventory management
│   └── verify
├── notifications/     # Notifications
│   ├── create
│   └── process
├── order/            # Order operations
│   ├── create
│   └── update-status
├── products/         # Product APIs
│   ├── by-category
│   ├── by-slug
│   └── search
├── user/             # User management
│   ├── check
│   ├── create
│   └── update
└── webhooks/         # External webhooks
    ├── razorpay
    └── shiprocket
```

### API Patterns

#### Request/Response
```javascript
// Request
POST /api/resource
{
  data: {},
  metadata: {}
}

// Success Response
{
  success: true,
  data: {},
  message: "Success"
}

// Error Response
{
  success: false,
  error: "Error message",
  details: {}
}
```

---

## 🎨 Frontend Architecture

### Component Hierarchy

```
App (layout.js)
├── ReduxProvider
│   └── ScrollProvider
│       ├── AnalyticsComponents
│       │   ├── UTMCapture
│       │   ├── FunnelClientBridge
│       │   └── GoogleTagManager
│       │
│       ├── LayoutComponents
│       │   ├── Topbar
│       │   ├── Sidebar
│       │   └── Footer
│       │
│       ├── DialogComponents
│       │   ├── CartDrawer
│       │   ├── RecommendationDrawer
│       │   └── SearchCategoryDialog
│       │
│       ├── UtilityComponents
│       │   ├── TopLoadingBar
│       │   ├── FloatingActionBar
│       │   ├── CartInitializer
│       │   └── TimeTracker
│       │
│       └── PageContent (children)
```

### Rendering Strategy

#### Static Generation (SSG)
- Homepage
- Static pages (About, FAQs, Terms)
- Product category pages

#### Server-Side Rendering (SSR)
- Product detail pages (dynamic data)
- Order tracking pages
- User account pages

#### Client-Side Rendering (CSR)
- Cart drawer
- Recommendation drawer
- Search dialog
- User interactions

---

## 🔒 Security Architecture

### Authentication
- **OTP-based**: SMS verification via MSG91/Twilio
- **Session Management**: Server-side sessions
- **Token Encryption**: Crypto module for sensitive data

### API Security
- **CORS**: Configured for specific origins
- **Rate Limiting**: Preventing abuse
- **Input Validation**: Zod schemas
- **SQL Injection**: MongoDB (NoSQL) - less vulnerable
- **XSS Protection**: React's built-in escaping

### Payment Security
- **PCI Compliance**: Razorpay handles card data
- **Webhook Verification**: Signature validation
- **HTTPS**: All production traffic encrypted
- **Environment Variables**: Sensitive data in .env

---

## 📊 Performance Optimization

### Frontend Optimizations
- **Code Splitting**: Dynamic imports
- **Image Optimization**: Next.js Image component
- **Lazy Loading**: React.lazy for components
- **Memoization**: React.memo, useMemo, useCallback
- **CDN**: CloudFront for static assets
- **Font Optimization**: Google Fonts with display: swap

### Backend Optimizations
- **Database Indexing**: Mongoose indexes
- **Query Optimization**: Lean queries, field selection
- **Caching**: Redis (future), in-memory caching
- **Connection Pooling**: MongoDB connection pool
- **API Response Caching**: ISR revalidation

### Bundle Size
- **Tree Shaking**: Automatic with Next.js
- **Code Minification**: Production builds
- **Dynamic Imports**: Reduce initial bundle
- **Selective Dependencies**: Only what's needed

---

## 🔍 SEO Architecture

### Technical SEO
- **Meta Tags**: Dynamic metadata generation
- **Structured Data**: Schema.org JSON-LD
- **Sitemap**: Dynamic sitemap generation
- **Robots.txt**: Automated generation
- **Canonical URLs**: Proper canonicalization
- **Open Graph**: Social media optimization

### Content SEO
- **Keywords**: Strategic keyword placement
- **Descriptions**: Unique meta descriptions
- **Alt Tags**: Image alt text
- **Headings**: Proper H1-H6 hierarchy
- **Internal Linking**: Cross-linking products

---

## 📈 Scalability Considerations

### Current Architecture
- **Vercel**: Auto-scaling serverless
- **MongoDB Atlas**: Managed database scaling
- **CloudFront**: Global CDN distribution
- **Shiprocket**: Third-party logistics

### Future Scaling
- **Microservices**: Break down monolith
- **Message Queue**: RabbitMQ/SQS for async tasks
- **Read Replicas**: Database read scaling
- **Load Balancer**: Multi-region deployment
- **Caching Layer**: Redis for frequent queries

---

*Robust, scalable architecture powering India's leading vehicle personalization platform*
