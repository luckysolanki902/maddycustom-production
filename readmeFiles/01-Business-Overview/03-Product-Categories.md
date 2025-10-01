# Product Categories - MaddyCustom

**Last Updated**: October 1, 2025

---

## 📦 Product Catalog Structure

The MaddyCustom platform organizes products in a **hierarchical structure** with multiple levels of categorization for efficient browsing and management.

---

## 🏗️ Category Hierarchy

```
Category (Top Level)
  └── SubCategory (Middle Level)
       └── SpecificCategory (Detailed Level)
            └── SpecificCategoryVariant (Variation Level)
                 └── Product (Individual SKU)
                      └── Option (Color/Size Variations)
```

---

## 🚗 Main Categories

### 1. Wraps
**Description**: Vehicle wrapping solutions for cars and bikes

#### Sub-Categories:
- **Car Wraps**
- **Bike Wraps**

#### Specific Categories (Examples):
- Pillar Wraps
- Roof Wraps
- Bonnet Wraps
- Car Fuel Cap Wrap
- Bike Tank Wraps
- Custom Car Neck Rest
- Custom Car Cuishions

#### Wrap Characteristics:
- **Inventory Mode**: On-Demand (no stock tracking)
- **Finish Options**: Matte, Glossy
- **Installation**: Self-install or professional
- **Material**: Premium vinyl, 3M quality
- **Warranty**: 2-3 years depending on type

---

### 2. Accessories
**Description**: Vehicle enhancement and utility products

#### Sub-Categories:
- **Car Accessories**
- **Bike Accessories**
- **Interior Accessories**
- **Exterior Accessories**

#### Product Types:
- Seat cushions and covers
- Floor mats
- Car fresheners
- Steering wheel covers
- Sunshades
- Phone holders
- Key chains
- Number plate frames

#### Accessory Characteristics:
- **Inventory Mode**: Inventory-tracked
- **Variants**: Multiple colors, sizes
- **Material**: Varies by product
- **Installation**: Mostly plug-and-play

---

### 3. Safety
**Description**: Vehicle and rider safety products

#### Product Types:
- Reflective stickers
- Safety tapes
- Visibility enhancers
- Emergency kits
- First aid kits
- Fire extinguishers

---

### 4. Minimal Personalization
**Description**: Simple customization products

#### Product Types:
- Custom name stickers
- Number stickers
- Logo stickers
- Decals
- Badges
- Emblems

---

### 5. Care Products
**Description**: Vehicle maintenance and care

#### Product Types:
- Cleaning kits
- Polishes
- Waxes
- Microfiber cloths
- Detailing products
- Dashboard cleaners

---

## 🏷️ Category Classification System

### Category (Top Level)
```javascript
{
  name: "Wraps",
  description: "Premium vehicle wrapping solutions",
  type: "string" // Stored as string reference
}
```

**Main Categories**:
- Wraps
- Accessories
- Safety
- Minimal Personalization
- Care

---

### SubCategory (Middle Level)
```javascript
{
  name: "Car Wraps",
  category: "Wraps",
  description: "Wrapping solutions for cars",
  type: "string" // Stored as string reference
}
```

**Common Sub-Categories**:
- Car Wraps, Bike Wraps
- Car Accessories, Bike Accessories
- Interior, Exterior
- Safety Gear
- Cleaning Products

---

### SpecificCategory (Detailed Level)
```javascript
{
  specificCategoryCode: "pb", // Unique code
  name: "Pillar B Wraps",
  description: "B-Pillar customization wraps",
  pageSlug: "/car-wraps/pillar-b",
  subCategory: "Car Wraps",
  category: "Wraps",
  available: true,
  
  // Configuration
  inventoryMode: "on-demand", // or "inventory"
  reviewFetchSource: "variant", // or "product", "specCat"
  seperateCategoryShipping: false,
  
  // Extra fields for order
  extraFields: [
    {
      fieldName: "bikeModel",
      fieldType: "String",
      question: "What's your bike model?"
    }
  ],
  
  // Product information tabs
  productInfoTabs: [
    {
      title: "Description",
      fetchSource: "Variant" // or "Product", "SpecCat"
    },
    {
      title: "How to Apply",
      fetchSource: "SpecCat"
    }
  ],
  
  // Variant selection
  useLetterMapping: false,
  letterMappingGroups: [],
  
  // Reviews
  tempReviewCount: 33,
  tempReviewDistribution: { 1: 0, 2: 0, 3: 9, 4: 11, 5: 13 },
  
  // Product card images
  commonProductCardImagesSource: "variant",
  commonProductCardImages: ["/images/..."],
  showDescriptionImagesInGallery: true
}
```

---

### SpecificCategoryVariant (Variation Level)
```javascript
{
  variantCode: "pb-carbon-black",
  variantType: "design", // or "vehicle", "style"
  name: "Carbon Black Design",
  title: "Premium Carbon Black Pillar B Wrap",
  subtitles: ["Matte Finish", "Easy Installation"],
  
  description: "Premium carbon fiber texture...",
  keywords: ["carbon", "black", "pillar", "b-pillar"],
  
  pageSlug: "/car-wraps/pillar-b/carbon-black",
  specificCategory: ObjectId("..."),
  
  // Display
  listLayout: "1", // or "2", "3" (different card layouts)
  thumbnail: "/images/variant-thumb.jpg",
  commonGalleryImages: ["/images/1.jpg", "/images/2.jpg"],
  defaultCarouselImages: ["/images/carousel/1.jpg"],
  
  // Features
  features: [
    {
      imageUrl: "/icons/waterproof.png",
      name: "Waterproof"
    },
    {
      imageUrl: "/icons/durable.png",
      name: "Long Lasting"
    }
  ],
  
  // Product description template
  productDescription: "Transform your {uniqueName}'s look with our premium {fullBikename} wrap",
  
  // Showcase
  showCase: [
    {
      available: true,
      url: "/videos/showcase.mp4"
    }
  ],
  
  // File paths
  designTemplateFolderPath: "/templates/pb/carbon",
  imageFolderPath: "/products/pb/carbon",
  
  // Brand pricing
  availableBrands: [
    {
      brandName: "Honda",
      brandLogo: "/logos/honda.png",
      brandBasePrice: 499
    }
  ],
  
  // Sizes (for accessories)
  sizes: {
    applicable: true,
    availableSizes: ["S", "M", "L", "XL"]
  },
  
  // Freebies
  freebies: {
    available: true,
    description: "Free installation kit",
    image: "/freebies/kit.jpg",
    weight: 50 // grams
  },
  
  // Custom template
  customTemplate: ObjectId("..."),
  
  // Packaging
  packagingDetails: {
    boxId: ObjectId("..."),
    productWeight: 100 // grams
  },
  
  // Product card images
  commonProductCardImages: ["/images/card1.jpg"],
  
  // Popup details
  popupDetails: ["Detail 1", "Detail 2"],
  
  // Reviews
  tempReviewCount: 45,
  tempReviewDistribution: { 1: 0, 2: 0, 3: 8, 4: 15, 5: 22 },
  
  available: true
}
```

---

### Product (Individual SKU)
```javascript
{
  name: "Honda Activa 6G", // Vehicle/Product name
  title: "Carbon Black Pillar B Wrap for Honda Activa 6G",
  
  // Images
  images: [
    "/products/activa-6g/1.jpg",
    "/products/activa-6g/2.jpg"
  ],
  
  // Categorization
  category: "Wraps",
  subCategory: "Bike Wraps",
  specificCategory: ObjectId("..."),
  specificCategoryVariant: ObjectId("..."),
  
  // Identification
  sku: "PB-ACT6G-CB-001",
  pageSlug: "/bike-wraps/pillar-b/carbon-black/honda-activa-6g",
  
  // Pricing
  MRP: 799,
  price: 599,
  deliveryCost: 100,
  
  // Search & Discovery
  mainTags: ["activa", "honda", "6g", "pillar"],
  searchKeywords: ["honda activa 6g wrap", "activa pillar wrap"],
  
  // Design
  designTemplate: {
    designCode: "PB-CB-001",
    imageUrl: "/templates/pb-cb-001.jpg"
  },
  designGroupId: ObjectId("..."), // For recommendations
  
  // Display
  displayOrder: 1, // Sort order in listings
  
  // Availability
  available: true,
  v: false, // Variant flag
  
  // Source
  productSource: "inhouse", // or "marketplace"
  brand: ObjectId("..."), // For marketplace products
  
  // Inventory
  inventoryData: ObjectId("..."), // Reference to Inventory model
  
  // Sync
  lastSyncedToGoogle: Date,
  
  timestamps: true
}
```

---

### Option (Color/Size Variation)
```javascript
{
  name: "Matte Black",
  optionType: "color", // or "size", "finish"
  
  // Product reference
  product: ObjectId("..."),
  
  // Images
  images: ["/options/matte-black-1.jpg"],
  thumbnail: "/options/matte-black-thumb.jpg",
  
  // Pricing (optional, inherits from product if not specified)
  price: 599,
  MRP: 799,
  
  // Identification
  sku: "PB-ACT6G-CB-MB",
  
  // Inventory
  inventoryData: ObjectId("..."),
  
  // Availability
  available: true,
  
  timestamps: true
}
```

---

## 🎨 Design Groups

**Purpose**: Group related products for cross-selling and recommendations

### Design Group Structure
```javascript
{
  _id: ObjectId("DES12345XX"), // Format: DES + 5 digits + 2 letters
  name: "Carbon Fiber Collection",
  description: "Matching carbon fiber wraps",
  products: [
    ObjectId("..."),
    ObjectId("..."),
    ObjectId("...")
  ]
}
```

### Usage
- **Recommendation Drawer**: Shows products from same design group
- **Product Page**: "Customers also bought" section
- **Top Bought Products**: Prioritizes design group products
- **Cart**: Design group matching suggestions

---

## 🏭 Inventory Management

### Inventory Modes

#### 1. On-Demand (Wraps)
```javascript
{
  inventoryMode: "on-demand",
  // No inventory tracking
  // Always shown as available
  // Made-to-order production
}
```

**Categories**: Wraps (all types)

#### 2. Inventory-Tracked (Accessories)
```javascript
{
  inventoryMode: "inventory",
  inventoryData: {
    availableQuantity: 50,
    reservedQuantity: 5,
    reorderLevel: 10,
    lastAvailableQuantity: 45
  }
}
```

**Categories**: Accessories, Safety Products, Care Products

### Stock Status
- **In Stock**: `availableQuantity > 0`
- **Out of Stock**: `availableQuantity <= 0`
- **Low Stock**: `availableQuantity <= reorderLevel`
- **Reserved**: `reservedQuantity` (cart reservations)

---

## 📋 Product Information Tabs

Products can have detailed information in tabs:

### Tab Types
1. **Description**: Product details, features, benefits
2. **How to Apply**: Installation instructions, video guides

### Tab Configuration
```javascript
productInfoTabs: [
  {
    title: "Description",
    fetchSource: "Product" // or "Variant", "SpecCat"
  }
]
```

### Storage Model: ProductInfoTab
```javascript
{
  title: "Description",
  product: ObjectId("..."), // If fetchSource is Product
  specificCategoryVariant: ObjectId("..."), // If Variant
  specificCategory: ObjectId("..."), // If SpecCat
  
  content: {}, // EditorJS format
  images: ["/images/desc1.jpg"]
}
```

---

## 🎯 Product Features

### Common Features Across Products

#### 1. Multiple Images
- Product gallery
- Zoom functionality
- Image slider
- Video showcase (optional)

#### 2. Variant Selection
- Color options
- Size options
- Finish options (for wraps)
- Brand options (for generic products)

#### 3. Pricing Display
- MRP (strikethrough)
- Selling Price (highlighted)
- Discount percentage
- Delivery cost
- Total price calculation

#### 4. Availability
- In-stock / Out-of-stock status
- Low stock warning
- Notify Me (for out-of-stock)
- Expected restock date

#### 5. Reviews & Ratings
- Average rating
- Review count
- Customer reviews
- Rating distribution
- Review images

#### 6. Product Details
- SKU display
- Category breadcrumbs
- Tags and keywords
- Features list
- Specifications

---

## 🚀 Product Discovery

### Search & Filter

#### 1. Category Navigation
- Main categories
- Sub-categories
- Specific categories
- Variant listings

#### 2. Search
- Product name search
- SKU search
- Keyword search
- Tag search
- Voice search (future)

#### 3. Filters
- Category filter
- Sub-category filter
- Tag filter
- Price range
- Availability
- Sort options (price, popularity, new)

#### 4. Pagination
- 12 items per page (default)
- Load more
- Page navigation
- Quick jump

---

## 📦 Packaging & Shipping

### Packaging
```javascript
{
  packagingDetails: {
    boxId: ObjectId("..."),
    productWeight: 100 // grams
  }
}
```

### Box Model: PackagingBox
```javascript
{
  name: "Small Box",
  dimensions: {
    length: 20, // cm
    width: 15,
    height: 10
  },
  weight: 50, // grams (box weight)
  maxWeight: 500 // grams (max product weight)
}
```

### Shipping Categories
- **Standard**: Regular products
- **Separate Shipping**: Products with `seperateCategoryShipping: true`
- **Combined**: Products that can ship together

---

## 🎁 Special Features

### 1. Freebies
```javascript
{
  freebies: {
    available: true,
    description: "Free installation kit included",
    image: "/freebies/kit.jpg",
    weight: 50 // Added to package weight
  }
}
```

### 2. Custom Templates
- Pre-designed wrap templates
- Design code reference
- Template preview images
- Customization options

### 3. Brand Variations
```javascript
{
  availableBrands: [
    {
      brandName: "Honda",
      brandLogo: "/logos/honda.png",
      brandBasePrice: 499
    },
    {
      brandName: "Yamaha",
      brandLogo: "/logos/yamaha.png",
      brandBasePrice: 549
    }
  ]
}
```

### 4. Size Variations
```javascript
{
  sizes: {
    applicable: true,
    availableSizes: ["S", "M", "L", "XL", "XXL"]
  }
}
```

---

## 📊 Product Analytics

### Tracked Metrics
- **Views**: Product page views
- **Add to Cart**: Times added to cart
- **Purchases**: Order count
- **Revenue**: Total sales value
- **Reviews**: Review count and average rating
- **Conversion Rate**: View to purchase
- **Bounce Rate**: View without action

### Top Products
- **Top Bought**: Best-selling products
- **Top Viewed**: Most viewed products
- **Top Rated**: Highest rated products
- **Trending**: Recently popular products

---

## 🔄 Product Lifecycle

### States
1. **Draft**: Not visible to customers
2. **Active**: `available: true`, visible and purchasable
3. **Inactive**: `available: false`, not purchasable
4. **Out of Stock**: Inventory depleted, "Notify Me" available
5. **Discontinued**: No longer offered

### Status Management
```javascript
// Activate product
product.available = true;

// Deactivate product
product.available = false;

// Mark variant unavailable
variant.available = false;

// Out of stock (inventory-tracked only)
inventory.availableQuantity = 0;
```

---

*Comprehensive product catalog powering India's leading vehicle personalization platform*
