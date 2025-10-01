# Business Operations Features

This section documents backend business operations including order management, inventory, payments, and B2B features.

## Operations Overview

### 1. 📦 Order Management System

#### Order Creation Flow
Complete checkout to order pipeline.

**Steps:**
```
1. Cart Review → View Cart Page
2. Inventory Gate Check
   - Verify all items in stock
   - Reserve quantities
   - Handle out-of-stock items
3. User Auth Check
   - Login/Register or Guest checkout
4. Order Form
   - Shipping address
   - Contact details
   - Delivery preferences
5. Payment Method Selection
   - Razorpay (Credit/Debit/UPI/Wallets)
   - Cash on Delivery (COD)
6. Order Splitting Logic
   - Check inventory modes per product
   - Split if mixed (on-demand + inventory)
7. Order Creation
   - Create Order document(s)
   - Generate order numbers
   - Link via orderGroupId if split
8. Payment Processing
   - Razorpay: Create payment order
   - COD: Mark pending
9. Confirmation
   - Order confirmation page
   - Email/SMS/WhatsApp notifications
   - Funnel tracking: purchase event
```

---

#### Order Splitting System
Handles mixed inventory mode orders.

**Scenario:**
```
Cart:
- Product A (Inventory Mode: inventory) - ₹500
- Product B (Inventory Mode: on-demand) - ₹800

Result: Split into 2 orders
Order 1: Product A (₹500) - Ready to ship
Order 2: Product B (₹800) - Custom made, longer delivery
```

**Implementation:**
```javascript
const inventoryItems = cartItems.filter(item => 
  item.specificCategory.inventoryMode === 'inventory'
);
const onDemandItems = cartItems.filter(item => 
  item.specificCategory.inventoryMode === 'on-demand'
);

const orderGroupId = generateOrderGroupId();

if (inventoryItems.length > 0) {
  await createOrder({ 
    items: inventoryItems, 
    orderGroupId,
    type: 'inventory' 
  });
}

if (onDemandItems.length > 0) {
  await createOrder({ 
    items: onDemandItems, 
    orderGroupId,
    type: 'on-demand' 
  });
}
```

**Customer Communication:**
- Notify about split orders
- Explain delivery timelines
- Link orders in "My Orders" page
- Single payment for all

**Documentation:**
- See: `readmeFiles/multi-order-splitting.md`

---

#### Order Status Workflow

**Payment Status:**
```
pending → completed
    ↓
  failed
```

**Delivery Status:**
```
processing → confirmed → shipped → out_for_delivery → delivered
    ↓
  cancelled
```

**Status Updates:**
- Admin manual updates
- Shiprocket webhook auto-updates
- Customer notifications on each change
- Email + SMS + WhatsApp + In-app

**Status Actions:**
- **Processing**: Admin reviews order
- **Confirmed**: Order accepted, preparing to ship
- **Shipped**: Shiprocket order created, AWB generated
- **Out for Delivery**: Courier scanned for delivery
- **Delivered**: Confirmed delivery
- **Cancelled**: Order cancelled (refund initiated if prepaid)

---

#### Order Management Dashboard (Admin)

**Features:**
- Order list with filters
  - Date range
  - Status
  - Payment method
  - Search by order number, customer name
- Order details view
  - Customer information
  - Items ordered
  - Payment details
  - Shipping address
  - Order timeline
- Actions:
  - Update status
  - Create shipment (Shiprocket)
  - Print invoice
  - Print packing slip
  - Contact customer
  - Refund/Cancel order

**Bulk Operations:**
- Bulk status update
- Bulk shipment creation
- Export orders (CSV/Excel)
- Generate reports

---

### 2. 📊 Inventory Management

#### Inventory Tracking System

**Inventory Model Fields:**
- `availableQuantity`: Current stock
- `reservedQuantity`: In carts + pending orders
- `reorderLevel`: Low stock threshold
- `lastAvailableQuantity`: Previous stock level

**Inventory Operations:**

1. **Add to Cart:**
   ```javascript
   // Reserve quantity
   await Inventory.updateOne(
     { productId },
     { $inc: { reservedQuantity: quantity } }
   );
   ```

2. **Cart Timeout/Remove:**
   ```javascript
   // Release reservation
   await Inventory.updateOne(
     { productId },
     { $inc: { reservedQuantity: -quantity } }
   );
   ```

3. **Order Placed:**
   ```javascript
   // Convert reserved to sold
   await Inventory.updateOne(
     { productId },
     { 
       $inc: { 
         availableQuantity: -quantity,
         reservedQuantity: -quantity 
       } 
     }
   );
   ```

4. **Restock:**
   ```javascript
   // Add stock
   await Inventory.updateOne(
     { productId },
     { 
       $set: { lastAvailableQuantity: currentQty },
       $inc: { availableQuantity: quantity } 
     }
   );
   ```

---

#### Inventory Modes

**Two Modes per Category:**

1. **Inventory Mode** (`inventory`)
   - Physical stock tracked
   - Limited quantities
   - Fast shipping
   - Stock checks before purchase
   - Low stock alerts

2. **On-Demand Mode** (`on-demand`)
   - Made to order
   - Unlimited availability
   - Longer production time
   - No stock tracking
   - Customizable products

**Configuration:**
Set in `SpecificCategory.inventoryMode`

**Behavior:**
- Inventory mode: Show "X left in stock"
- On-demand: Show "Made to Order"
- Mixed cart: Split into separate orders

---

#### Inventory Gate System
Cart validation before checkout.

**Purpose:**
- Verify all items still available
- Update prices if changed
- Remove out-of-stock items
- Adjust quantities to available stock

**Implementation:**
```javascript
// Cart slice: inventoryGate flag
const checkInventoryGate = async (cartItems) => {
  for (const item of cartItems) {
    const inventory = await getInventory(item.productId);
    
    if (inventory.availableQuantity < item.quantity) {
      // Adjust or remove item
      if (inventory.availableQuantity > 0) {
        updateQuantity(item.productId, inventory.availableQuantity);
        showWarning(`Adjusted ${item.name} quantity to ${inventory.availableQuantity}`);
      } else {
        removeFromCart(item.productId);
        showError(`${item.name} is out of stock`);
      }
    }
  }
};
```

**Trigger Points:**
- Before showing checkout form
- On "Proceed to Checkout" click
- Periodically in cart (every 5 mins)

---

#### Low Stock Management

**Alerts:**
- Admin notification when stock < reorderLevel
- Dashboard widget showing low stock items
- Email digest of low stock products

**Actions:**
- Manual reorder by admin
- Auto-generate purchase orders (future)
- Contact suppliers (B2B integration)

**Reports:**
- Stock movement report
- Fast-moving vs slow-moving products
- Stock value report
- Stockout incidents

---

### 3. 💳 Payment Processing

#### Payment Methods

**1. Razorpay Integration**
For online payments.

**Supported Methods:**
- Credit/Debit Cards
- UPI (Google Pay, PhonePe, Paytm)
- Netbanking
- Wallets (Paytm, Freecharge, Mobikwik)
- EMI options

**Flow:**
```
1. Create Razorpay Order
   POST /api/payment/create-order
   Response: { orderId, amount, currency }

2. Open Razorpay Checkout
   Razorpay.open({
     key: RAZORPAY_KEY_ID,
     order_id: orderId,
     handler: onPaymentSuccess
   })

3. Payment Success
   - Capture payment
   - Verify signature
   - Update order status
   - Send confirmation

4. Payment Failure
   - Log error
   - Retry option
   - Switch to COD option
```

**Webhook:**
- Endpoint: `/api/webhooks/razorpay`
- Events: payment.authorized, payment.failed
- Signature verification
- Order status updates

**Security:**
- Server-side signature verification
- Amount validation
- Order ID verification
- HTTPS only

---

**2. Cash on Delivery (COD)**

**Features:**
- Available for selected pin codes
- COD fee may apply
- Payment collected by courier
- Confirmation required

**Flow:**
```
1. Select COD at checkout
2. Verify pin code eligibility
3. Apply COD fee (if applicable)
4. Create order with payment status: pending
5. Shipment created with COD option
6. Customer pays on delivery
7. Courier remits payment
8. Mark payment as completed
```

**COD Management:**
- Pin code eligibility list
- COD limit (max order value)
- COD fee configuration
- COD remittance tracking

---

#### Payment Reconciliation

**Daily Tasks:**
- Match Razorpay settlements with orders
- Track COD remittances from courier
- Identify payment discrepancies
- Generate payment reports

**Reports:**
- Payment method distribution
- Success vs failure rate
- Settlement timeline
- Outstanding COD amounts

---

### 4. 🚚 Shipping & Logistics

#### Shiprocket Integration
Third-party logistics provider.

**Features:**
- Multi-courier support
- Automated rate selection
- Label generation
- Tracking updates
- NDR (Non-Delivery Report) management
- RTO (Return to Origin) tracking

**Order-to-Shipment Flow:**
```
1. Order Placed & Confirmed
2. Admin creates shipment
3. API Call: Create Shiprocket Order
   POST /api/shiprocket/create-order
   {
     order_id, order_date,
     pickup_location,
     billing/shipping details,
     items: [{ name, sku, qty, price }],
     payment_method,
     weight, dimensions
   }
4. Shiprocket assigns courier
5. Generate AWB (Airway Bill) number
6. Schedule pickup
7. Print shipping label
8. Courier picks up package
9. Tracking updates via webhooks
10. Delivery confirmation
```

**Tracking:**
- Real-time status updates
- Customer tracking page: `/orders/track/[orderId]`
- Email/SMS/WhatsApp notifications
- Push notifications (PWA)

**Webhooks:**
- Endpoint: `/api/webhooks/shiprocket`
- Events: 
  - Shipment pickup
  - In-transit updates
  - Out for delivery
  - Delivered
  - NDR (delivery attempted)
  - RTO (return to origin)
- Auto-update order status

**Documentation:**
- See: `readmeFiles/webhook-improvements.md`

---

#### Delivery Management

**Delivery Options:**
- Standard delivery (5-7 days)
- Express delivery (2-3 days)
- Same-day delivery (select cities)
- Pickup from store (future)

**Delivery Estimates:**
- Pin code-based calculation
- Weight-based calculation
- Service level selection
- Display on product pages and cart

**Shipping Charges:**
- Free shipping threshold (e.g., orders > ₹999)
- Flat rate shipping
- Weight-based shipping
- Zone-based shipping
- Promotional free shipping

---

### 5. 🏢 B2B Features

#### B2B Customer Management

**B2B User Types:**
- Wholesalers
- Retailers
- Corporate clients
- Bulk buyers

**B2B Registration:**
- Separate registration form
- Business details required:
  - Company name
  - GST number
  - Business type
  - Annual turnover
- Admin approval required
- B2B pricing tier assignment

---

#### B2B Pricing & Orders

**Pricing:**
- Tiered pricing based on volume
- Special B2B discount rates
- Category-specific pricing
- Negotiated contract pricing

**B2B Order Model:**
```javascript
{
  userId: (B2B customer),
  companyDetails: { name, gst, address },
  items: [{ productId, quantity, price, discount }],
  bulkDiscount: 15%, // Applied automatically
  paymentTerms: "Net 30", // Credit period
  poNumber: "PO-2024-001", // Customer PO reference
  creditLimit: 100000,
  usedCredit: 45000,
  status: "pending_approval" → "approved" → "processing"
}
```

**Features:**
- Bulk order support (100+ items)
- Credit limit management
- Payment terms (Net 30, Net 60)
- Purchase order (PO) tracking
- Invoice generation with GST
- Bulk shipment options

---

#### B2B Dashboard

**Customer Portal:**
- Order history
- Credit balance
- Pending approvals
- Download invoices
- Request quotes
- Reorder previous orders

**Admin Portal:**
- B2B customer list
- Credit limit management
- Order approval workflow
- Pricing tier management
- Bulk pricing updates
- B2B performance reports

---

### 6. 💰 Financial Management

#### Invoicing System

**Invoice Generation:**
- Auto-generate on order completion
- GST-compliant format
- Company letterhead
- Sequential invoice numbering
- PDF download/email

**Invoice Details:**
- Customer details
- Billing/shipping address
- Item-wise details with HSN
- Taxable value
- GST breakdown (CGST, SGST, IGST)
- Grand total
- Payment method
- Terms & conditions

---

#### Refund & Returns

**Return Policy:**
- Return window (7/14/30 days)
- Condition requirements
- Return shipping
- Restocking fee (if applicable)

**Refund Flow:**
```
1. Customer requests return
2. Admin reviews request
3. Approve/Reject return
4. If approved:
   - Generate return shipment label
   - Customer ships back
   - QC check on receipt
   - Initiate refund
5. Refund processing:
   - Razorpay: Auto-refund to source
   - COD: Bank transfer or store credit
6. Update inventory
7. Close return request
```

**Refund Processing:**
- Razorpay: 5-7 business days
- Bank transfer: 3-5 business days
- Store credit: Instant

---

### 7. 📈 Business Analytics

#### Sales Reports

**Available Reports:**
- Daily/Weekly/Monthly sales
- Product-wise sales
- Category performance
- Payment method distribution
- Courier performance
- Geographic sales distribution

**Metrics:**
- Total revenue
- Number of orders
- Average order value (AOV)
- Conversion rate
- Cart abandonment rate
- Customer acquisition cost (CAC)
- Customer lifetime value (CLV)

---

#### Inventory Reports

**Reports:**
- Stock levels
- Stock movement
- Low stock alerts
- Stockout incidents
- Inventory turnover ratio
- Dead stock identification

**Insights:**
- Fast-moving products
- Slow-moving products
- Seasonal trends
- Reorder recommendations

---

#### Customer Reports

**Reports:**
- New vs returning customers
- Customer segmentation
- Top customers by value
- Customer churn rate
- Geographic distribution
- B2B vs B2C split

**Segmentation:**
- High-value customers (VIP)
- Regular customers
- One-time buyers
- At-risk customers (churn likely)

---

### 8. 🔒 Security & Compliance

#### Data Security

**Measures:**
- HTTPS everywhere
- Password hashing (bcrypt)
- JWT authentication
- Environment variable secrets
- Database encryption at rest
- Regular security audits

---

#### Compliance

**GST Compliance:**
- GST registration details
- HSN codes for products
- GST calculation (CGST, SGST, IGST)
- GST invoice format
- GSTR filing support

**Privacy Compliance:**
- GDPR considerations
- Data retention policies
- User data export
- Right to deletion
- Cookie consent

---

## Operational Workflows

### Daily Operations:
1. Check pending orders
2. Process confirmed orders
3. Create shipments
4. Monitor delivery status
5. Handle customer queries
6. Update inventory
7. Process returns/refunds

### Weekly Tasks:
1. Review low stock items
2. Analyze sales performance
3. Check payment reconciliation
4. Review customer feedback
5. Update product catalog

### Monthly Tasks:
1. Generate financial reports
2. Inventory audit
3. Customer analytics review
4. Marketing campaign analysis
5. Vendor settlements

---

## Next Steps
- Explore shopping features in `Shopping-Experience/`
- Review order APIs in `06-API-Reference/Order-APIs/`
- Check payment integration in `06-API-Reference/Payment-APIs/`
- See webhook documentation in `readmeFiles/webhook-improvements.md`
