# Core Database Models

This section documents the fundamental database models that power the MaddyCustom e-commerce platform.

## Models Included

### 1. **Product** (`src/models/Product.js`)
The central model for all products in the system.

**Key Fields:**
- `name`, `description`, `shortDescription`
- `category`, `specificCategory`, `subCategory`
- `MRP`, `price` (selling price)
- `images` (array of image URLs)
- `sku`, `hsn`
- `designGroupId` (links related designs)
- `inventoryData` (reference to Inventory model)
- `isActive`, `isFeatured`, `isNewArrival`
- `tags`, `seoKeywords`
- `views`, `purchases` (analytics counters)

**Special Features:**
- Automatic slug generation from product name
- Image management with validation
- Category hierarchy (category → specificCategory → subCategory)
- Design grouping for variant recommendations
- Inventory integration with optional tracking

**Use Cases:**
- Product listing pages
- Product detail pages
- Search and filtering
- Inventory management
- Recommendations based on designGroupId

---

### 2. **SpecificCategory** (`src/models/SpecificCategory.js`)
Defines product categories with customizable fields and behavior.

**Key Fields:**
- `name`, `description`
- `categoryId` (parent category reference)
- `extraFields` (dynamic product attributes like material, size, color)
- `letterMapping` (customizes letter options for products)
- `inventoryMode`: `"on-demand"` or `"inventory"`
- `productInfoTabs` (custom tabs for product pages)
- `isActive`

**Special Features:**
- Dynamic field definitions for products (size, color, material, etc.)
- Inventory mode control per category
- Custom product information tabs
- Letter mapping for customizable products

**Use Cases:**
- Category-specific product filtering
- Dynamic form generation for product attributes
- Inventory tracking configuration
- Product page customization

---

### 3. **Inventory** (`src/models/Inventory.js`)
Tracks stock levels and inventory management.

**Key Fields:**
- `productId` (reference to Product)
- `sku`
- `availableQuantity`
- `reservedQuantity` (items in pending orders)
- `reorderLevel` (low stock threshold)
- `lastAvailableQuantity` (previous stock level)
- `lastUpdated`

**Special Features:**
- Reserved quantity tracking for cart items
- Low stock alerts with reorderLevel
- Historical tracking with lastAvailableQuantity
- Automatic updates during order flow

**Use Cases:**
- Stock availability checks
- Cart validation ("inventory gate")
- Admin inventory management
- Low stock alerts
- Order fulfillment tracking

---

### 4. **Order** (`src/models/Order.js`)
Complete order lifecycle management.

**Key Fields:**
- `userId` (reference to User)
- `orderGroupId` (groups split orders)
- `items` (array of ordered products with details)
- `totalPrice`, `shippingFee`, `discount`, `finalAmount`
- `shippingAddress` (embedded address object)
- `paymentMethod`: `"razorpay"` or `"cod"`
- `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature`
- `paymentStatus`: `"pending"`, `"completed"`, `"failed"`
- `deliveryStatus`: `"processing"`, `"shipped"`, `"delivered"`, `"cancelled"`
- `shiprocketOrderId`, `shiprocketShipmentId`
- `courierName`, `awbCode`, `trackingUrl`

**Special Features:**
- Multi-order splitting (orderGroupId)
- Payment gateway integration (Razorpay)
- Logistics tracking (Shiprocket)
- Status workflow management
- Delivery partner integration

**Use Cases:**
- Order creation and checkout
- Payment processing
- Order tracking
- Admin order management
- Shipping label generation
- Multi-order handling for mixed inventory modes

---

### 5. **User** (`src/models/User.js`)
User accounts and authentication.

**Key Fields:**
- `name`, `email`, `phoneNumber`
- `password` (hashed)
- `role`: `"customer"`, `"admin"`, `"b2b"`
- `addresses` (array of saved addresses)
- `wishlist` (array of product IDs)
- `orders` (array of order IDs)
- `b2bDetails` (business information for B2B users)

**Special Features:**
- Role-based access control
- Multiple saved addresses
- Wishlist management
- Order history tracking
- B2B customer support

**Use Cases:**
- User authentication
- Profile management
- Address book
- Order history
- B2B customer management

---

### 6. **Combo** (`src/models/Combo.js`)
Product bundles and combo offers.

**Key Fields:**
- `name`, `description`
- `products` (array of product IDs with quantities)
- `originalPrice`, `comboPrice`
- `discount` (calculated)
- `images`
- `isActive`, `isFeatured`
- `validFrom`, `validUntil`

**Special Features:**
- Multi-product bundling
- Automatic discount calculation
- Time-limited offers
- Bundle inventory checking

**Use Cases:**
- Bundle product offerings
- Promotional campaigns
- Cross-selling strategies
- Volume discounts

---

### 7. **Option** (`src/models/Option.js`)
Customization options for products (colors, finishes, etc.).

**Key Fields:**
- `name`, `type`
- `values` (array of available options)
- `priceModifier` (additional cost)
- `applicableCategories`

**Special Features:**
- Dynamic option management
- Price modifications based on selection
- Category-specific availability

**Use Cases:**
- Product customization
- Variant selection
- Dynamic pricing
- Option management

---

## Relationships

```
User ──┬─→ Order (userId)
       └─→ wishlist (product IDs)

Product ──┬─→ SpecificCategory (specificCategory)
          ├─→ Inventory (inventoryData)
          └─→ designGroupId (groups related products)

Order ──┬─→ User (userId)
        ├─→ orderGroupId (groups split orders)
        └─→ items[] → Product details

Inventory ──→ Product (productId)

Combo ──→ Products[] (product bundle)

SpecificCategory ──→ Category (parent)
```

## Database Operations

### Common Patterns:
1. **Product Retrieval with Category:**
   ```javascript
   const product = await Product.findOne({ slug })
     .populate('specificCategory')
     .lean();
   ```

2. **Order Creation with Inventory:**
   ```javascript
   const order = await Order.create(orderData);
   await Inventory.updateOne(
     { productId },
     { $inc: { reservedQuantity: quantity } }
   );
   ```

3. **Category-based Product Filtering:**
   ```javascript
   const products = await Product.find({ 
     specificCategory: categoryId,
     isActive: true 
   });
   ```

---

## Next Steps
- Read individual model files for complete schema definitions
- Check `/src/models/` directory for model implementations
- Review API endpoints that use these models in `06-API-Reference`
