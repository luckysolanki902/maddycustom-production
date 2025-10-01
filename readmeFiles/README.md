# MaddyCustom - Complete Documentation Index

**Last Updated**: December 2024  
**Version**: 5.0.0  
**Platform**: Next.js 15 E-commerce Platform

---

## 📚 Documentation Structure

This documentation is organized into **8 main folders with subfolders** for easy navigation and focused learning:

## 📚 Documentation Structure

This documentation is organized into **8 main folders with subfolders** for easy navigation and focused learning:

---

### 📁 01-Business-Overview
**Business model, product categories, and brand identity**
- `01-Brand-Identity.md` - Company information, brand values, and vision
- `02-Business-Model.md` - B2C and B2B business models, revenue streams
- `03-Product-Categories.md` - Complete product catalog structure
- `04-Key-Features.md` - High-level platform features overview

---

### 📁 02-Technical-Architecture
**System architecture, tech stack, and infrastructure**
- `01-Tech-Stack.md` - Technologies: Next.js, React, MongoDB, Redux, AWS
- `02-Folder-Structure.md` - Project organization and conventions
- `03-State-Management.md` - Redux store architecture, slices, persistence
- `04-Routing-Structure.md` - Next.js App Router, dynamic routing

---

### 📁 03-Database-Models
**Complete database schema documentation organized by category**

#### 📂 Core-Models/
- **Product** - Product catalog with variants, pricing, images, inventory
- **Order** - Order management, payment, delivery tracking
- **User** - Customer accounts, authentication, addresses, wishlist
- **Inventory** - Stock tracking, reservations, low stock alerts
- **SpecificCategory** - Category definitions with custom fields
- **Combo** - Product bundles and combo offers
- **Option** - Product customization options

#### 📂 Marketing-Models/
- **Coupon** - Discount codes, promotional offers, usage tracking
- **Offer** - Site-wide banners, popups, promotional content
- **CampaignLog** - Marketing campaign performance tracking
- **HappyCustomer** - Customer testimonials and reviews
- **DisplayAssets** - Dynamic content management (banners, videos)

#### 📂 Analytics-Models/
- **FunnelEvent** - User journey tracking through sales funnel
- **MetaPixelEvent** - Facebook/Meta Pixel event tracking
- **GoogleAnalyticsEvent** - GA4 event tracking
- **VisitorSession** - Session tracking, engagement metrics
- **ProductAnalytics** - Product-level performance metrics

#### 📂 Communication-Models/
- **Notification** - Multi-channel notification system
- **NotificationTemplate** - Template management for notifications
- **EmailLog** - Email delivery tracking and analytics
- **SMSLog** - SMS delivery tracking and cost management
- **WhatsAppLog** - WhatsApp Business message tracking

---

### 📁 04-Core-Features
**Feature documentation and user flows**

#### 📂 Shopping-Experience/
- Product browsing and discovery
- Shopping cart system (Redux state management)
- Cart drawer (slide-out quick view)
- Product search and filters
- Product recommendations
- Wishlist management
- Gift wrapping and customization
- Mobile-optimized shopping
- Shipping countdown timer

#### 📂 Product-Discovery/
- Category navigation (3-level hierarchy)
- Advanced search system (fuzzy matching, instant results)
- Smart recommendations (design groups, frequently bought together)
- Sorting and filtering system
- New arrivals and featured products
- Product tagging system
- Visual discovery (image galleries, zoom)
- Product alerts (back-in-stock, price drops)
- Trending products and social proof

#### 📂 Business-Operations/
- Order management system
- Order splitting logic (inventory vs on-demand)
- Order status workflow
- Inventory tracking and management
- Inventory gate system
- Payment processing (Razorpay, COD)
- Shipping and logistics (Shiprocket integration)
- B2B features (bulk orders, credit management)
- Invoicing and refunds
- Business analytics and reports

---

### 📁 05-UI-Components
**Frontend component library guide**

#### 📂 Layout-Components/
- Header/Topbar, Footer, Sidebar
- Navigation menus, Breadcrumbs
- Layout wrappers

#### 📂 Product-Components/
- ProductCard, ProductGallery
- VariantSelector, PriceDisplay
- AddToCartButton, ProductTabs

#### 📂 Dialog-Components/
- CartDrawer - Slide-out cart panel
- RecommendationDrawer - Product suggestions with coupon unlock
- SearchCategoryDialog - Global search interface
- AuthDialog - Login/Register modals

#### 📂 Page-Components/
- Homepage sections (HeroCarousel, CategoryGrid, NewArrival)
- Category page components
- Product detail page sections
- Cart page components

#### 📂 Showcase-Components/
- Carousels, Testimonials
- OfferBanners, WhyMaddy section
- Social proof indicators

---

### 📁 06-API-Reference
**API endpoints and integration guides**

#### 📂 Product-APIs/
- Product CRUD operations
- Product search and filtering
- Category management
- Product recommendations

#### 📂 Order-APIs/
- Order creation and checkout
- Order status updates
- Order history and tracking
- Order splitting logic

#### 📂 User-APIs/
- Authentication (login, register, JWT)
- Profile management
- Address book CRUD
- Wishlist operations

#### 📂 Payment-APIs/
- Razorpay integration
  - Create order
  - Verify payment
  - Capture payment
- COD handling
- Refund processing

#### 📂 Admin-APIs/
- Product management
- Order management
- Inventory updates
- User management
- Bulk operations
- Report generation

#### 📂 Webhook-APIs/
- Razorpay webhooks (payment events)
- Shiprocket webhooks (shipment tracking)
- Webhook security (signature verification)

---

### 📁 07-Analytics-Tracking
**Analytics implementation and tracking**

- **Funnel Tracking System**
  - Event types: page_view, product_view, add_to_cart, purchase
  - Client-side and server-side tracking
  - Session management
  - Conversion funnel analysis

- **Meta Pixel Integration**
  - Facebook Conversions API (CAPI)
  - Event deduplication
  - Standard events (PageView, ViewContent, Purchase)
  - Custom parameters

- **Google Analytics 4**
  - GA4 Measurement Protocol
  - E-commerce events
  - Custom dimensions
  - User properties

- **UTM Parameter Capture**
  - Campaign tracking
  - Source/medium/campaign attribution
  - Session-based UTM storage
  - Conversion attribution

- **Custom Event Tracking**
  - Recommendation views
  - Coupon applications
  - Filter usage
  - Search queries

---

### 📁 08-Developer-Guide
**Development workflows and best practices**

- **Getting Started**
  - Prerequisites (Node.js, MongoDB)
  - Clone and install
  - Environment setup
  - Database seeding

- **Development Workflow**
  - Local development server
  - File structure navigation
  - Component development
  - API route creation

- **Code Standards**
  - Naming conventions
  - Component patterns
  - State management patterns
  - API design patterns

- **Testing & Debugging**
  - Component testing
  - API testing
  - Debugging tools
  - Performance monitoring

- **Deployment Process**
  - Vercel deployment
  - Environment configuration
  - Database migration
  - Production checklist

---

## 🚀 Quick Start Paths

### For Business Stakeholders:
1. Start with **01-Business-Overview/** to understand the platform
2. Review **04-Core-Features/** for feature capabilities
3. Check **03-Database-Models/Marketing-Models/** for marketing tools

### For Developers (New):
1. Read **QUICKSTART.md** for rapid setup
2. Review **02-Technical-Architecture/** for system overview
3. Explore **08-Developer-Guide/** for development workflow
4. Check **03-Database-Models/** to understand data structure

### For Frontend Developers:
1. Review **02-Technical-Architecture/03-State-Management.md**
2. Explore **05-UI-Components/** for component library
3. Check **04-Core-Features/Shopping-Experience/** for UX flows

### For Backend Developers:
1. Review **03-Database-Models/** for schemas
2. Check **06-API-Reference/** for endpoints
3. Explore **04-Core-Features/Business-Operations/** for logic

### For Data Analysts:
1. Review **03-Database-Models/Analytics-Models/**
2. Check **07-Analytics-Tracking/** for tracking implementation
3. Explore **04-Core-Features/Business-Operations/** for reports

---

## 📖 Legacy Documentation

The following legacy documentation files are preserved for reference:
- **funnel_tracking.md** - Original funnel tracking documentation (now in 07-Analytics-Tracking/)
- **funnel_tracking_update.md** - Latest funnel updates (integrated into new docs)
- **multi-order-splitting.md** - Order splitting feature (now in 04-Core-Features/Business-Operations/)
- **webhook-improvements.md** - Webhook system enhancements (now in 06-API-Reference/Webhook-APIs/)

---

## 📊 Documentation Status

See **DOCUMENTATION-STATUS.md** for:
- Completion status of each section
- Planned documentation
- Recent updates
- Contribution guidelines

See **COMPLETION-SUMMARY.md** for:
- Phase 1 completion report
- Word count and file statistics
- Quality metrics
- Next phase planning

---

## 🔍 Finding What You Need

### Quick Search Guide:
- **"How do I..."** → Start with **04-Core-Features/**
- **"What is..."** → Check **03-Database-Models/**
- **"Where is the API for..."** → Go to **06-API-Reference/**
- **"How to track..."** → See **07-Analytics-Tracking/**
- **"Setup and run..."** → Read **08-Developer-Guide/**

### Navigation Tips:
- Each subfolder has its own **README.md** with detailed content
- Use the folder names to quickly identify the category you need
- Start with overview files (01-*.md) in each folder
- Follow cross-references between related documents

---

## 🤝 Contributing to Documentation

To improve this documentation:
1. Identify gaps or outdated information
2. Create/update markdown files following the structure
3. Update this index if adding new folders
4. Update DOCUMENTATION-STATUS.md with your changes
5. Use clear headings, code examples, and diagrams where helpful

---

## 📞 Support

For questions or clarifications:
- Check **08-Developer-Guide/05-Troubleshooting.md** for common issues
- Review relevant subfolder README files
- Contact the development team for technical support

---

**Happy Learning! 🚀**

---

## 📞 Support

For technical support or documentation questions:
- **Email**: contact.maddycustoms@gmail.com
- **Instagram**: [@maddycustom](https://www.instagram.com/maddycustom/)
- **Website**: [www.maddycustom.com](https://www.maddycustom.com)
