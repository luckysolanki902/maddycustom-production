// app/api/checkout/order/create/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Order from '@/models/Order';
import User from '@/models/User';
import Offer from '@/models/Offer';
import ModeOfPayment from '@/models/ModeOfPayment';
import UTMHistory from '@/models/UTMHistory';
import Product from '@/models/Product';
import Option from '@/models/Option';
import moment from 'moment-timezone';
import Razorpay from 'razorpay';
import shortid from 'shortid';
import { 
  groupItemsByInventory, 
  createSplitOrdersData, 
  generateOrderGroupId 
} from '@/lib/utils/orderSplitting';

// Initialize Razorpay instance outside the handler for reuse
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});

export async function POST(request) {
  try {
    let {
      userId,
      phoneNumber,
      items: clientItems,
      paymentModeId,
      address,
      totalAmount: clientTotalAmount,
      discountAmount: clientDiscountAmount,
      couponCode: clientCouponCode,
      extraChargesPayload,
      // encryptedFinancialData, // REMOVED
      utmDetails,
      utmHistory,
      extraFields,
    } = await request.json();

    // Validate essential fields
    if ((!userId && !phoneNumber) || !clientItems || !clientItems.length || !paymentModeId || !address ||
        typeof clientTotalAmount !== 'number' || clientTotalAmount < 0) {
      return NextResponse.json(
        { message: 'Missing or invalid required fields.' },
        { status: 400 }
      );
    }

    // Extract charges from extraChargesPayload, defaulting to 0 if not provided
    const clientMopCharges = extraChargesPayload?.mopCharges || 0;
    const clientDeliveryCharges = extraChargesPayload?.deliveryCharges || 0;

    const isTestingOrder = process.env.isTestingOrder === 'true' || false;
    await connectToDatabase();

    const serverDataPromises = [];

    // 1. Fetch Payment Mode
    serverDataPromises.push(ModeOfPayment.findById(paymentModeId, {
      name: 1,
      isActive: 1,
      configuration: 1,
      extraCharge: 1,
    }).lean());

    // 2. Fetch User
    if (userId) {
      serverDataPromises.push(User.findById(userId, { _id: 1 }).lean());
    } else if (phoneNumber) {
      serverDataPromises.push(User.findOne({ phoneNumber }, { _id: 1 }).lean());
    } else {
      serverDataPromises.push(Promise.resolve(null)); // Placeholder if no user identifier
    }

    // 3. Fetch Offer (if couponCode provided)
    if (clientCouponCode) {
      serverDataPromises.push(
        Offer.findOne({
          couponCodes: clientCouponCode.toUpperCase(),
          isActive: true,
        })
        .select({
          name: 1,
          couponCodes: 1,
          actions: 1,
          conditions: 1,
          discountCap: 1,
          validFrom: 1,
          validUntil: 1,
          allowStacking: 1,
          autoApply: 1,
        })
        .lean()
      );
    } else {
      serverDataPromises.push(Promise.resolve(null)); // Placeholder if no coupon
    }

    // 4. Fetch Product and Option details for price verification
    const productAndOptionIds = clientItems.map(item => ({
      productId: item.product,
      optionId: item.option || null,
      originalClientItem: item // Keep reference to client item for quantity
    }));

    const productPricePromises = productAndOptionIds.map(async itemIdentifier => {
      const product = await Product.findById(itemIdentifier.productId).select('price MRP optionsAvailable sku name specificCategory').lean();
      if (!product) throw new Error(`Product not found: ${itemIdentifier.productId}`);
      
      let effectivePrice = product.price;
      let effectiveMRP = product.MRP;
      let optionSKU = product.sku;
      let specificCategoryFromProduct = product.specificCategory;

      if (itemIdentifier.optionId && product.optionsAvailable) {
        const option = await Option.findById(itemIdentifier.optionId).select('optionDetails price sku').lean(); // Assuming Option schema has a price field
        if (!option) throw new Error(`Option not found: ${itemIdentifier.optionId} for product ${itemIdentifier.productId}`);
        // If options have their own price, use it. Otherwise, product price is used.
        // For now, assuming option does not override product.price directly but might have variant pricing logic not shown.
        // If Option model has a direct price field that should be used, uncomment and adjust:
        // if (option.price) { effectivePrice = option.price; }
        // For now, we rely on product.price as the base, assuming options primarily define characteristics or SKU changes.
        optionSKU = option.sku || product.sku; 
      }
      return {
        ...itemIdentifier.originalClientItem, // Spread original client item (quantity, name, etc.)
        serverPrice: effectivePrice,         // Authoritative price from DB
        serverMRP: effectiveMRP,             // Authoritative MRP from DB
        serverSKU: optionSKU,
        productName: product.name, // Get from DB for consistency
        specificCategory: specificCategoryFromProduct,
      };
    });
    serverDataPromises.push(Promise.all(productPricePromises));
    
    // Execute all fetching promises
    const [ 
      paymentMode, 
      userResult, 
      offerResult, 
      serverVerifiedItems
    ] = await Promise.all(serverDataPromises);

    let user = userResult;
    if (!user && phoneNumber) {
      const newUser = new User({ phoneNumber }); 
      user = await newUser.save();
    }
    if (!user) {
      return NextResponse.json({ message: 'User not found or could not be created.' }, { status: 404 });
    }

    const offer = offerResult;

    if (!paymentMode || !paymentMode.isActive) {
      return NextResponse.json({ message: 'Invalid or inactive payment mode.' }, { status: 400 });
    }

    // --- Server-Side Calculation of Financials ---

    // 1. Calculate server-side subtotal from authoritative prices
    const serverCalculatedItemsSubTotal = serverVerifiedItems.reduce((sum, item) => {
      return sum + (item.serverPrice * item.quantity);
    }, 0);

    // 2. Calculate server-side discount
    let actualDiscountAmount = 0;
    let actualCouponCode = clientCouponCode;
    // TODO: Implement robust server-side discount calculation using 'offer' and 'serverVerifiedItems'
    // This would involve checking offer.conditions and applying offer.actions.
    // For now, we'll validate the clientCouponCode and if the offer exists and is timely,
    // we will trust clientDiscountAmount for this iteration, but with a strong recommendation to replace this.
    if (actualCouponCode && offer) {
      const currentDateIST = moment().tz('Asia/Kolkata').toDate();
      if (currentDateIST < offer.validFrom || currentDateIST > offer.validUntil) {
        actualCouponCode = ''; // Offer expired or not yet valid
        // clientDiscountAmount will not be used if coupon is invalid
      } else {
        // Basic validation: if client sent a discount, use it. If not, and coupon is valid, it implies an issue.
        // THIS IS A SIMPLIFICATION. ROBUST LOGIC NEEDED HERE.
        actualDiscountAmount = (typeof clientDiscountAmount === 'number' && clientDiscountAmount >=0) ? clientDiscountAmount : 0;
        // A more robust check would be: recalculate discount based on offer.actions and serverSubTotal
        // and compare with clientDiscountAmount. If different, use server calculated or flag.
      }
    } else if (actualCouponCode && !offer) { // Coupon code sent, but no active offer found
      actualCouponCode = '';
      // clientDiscountAmount will not be used
    }
    if (!actualCouponCode) actualDiscountAmount = 0; // Ensure discount is 0 if no valid coupon
    

    // 3. Determine server-side extra charges
    const serverExtraCharges = [];
    const serverMopCharge = paymentMode.extraCharge || 0;
    if (serverMopCharge > 0) {
        serverExtraCharges.push({ chargesName: 'MOP Charges', chargesAmount: serverMopCharge });
    }
    // For delivery charges, using client-provided for now. Ideally, this is also server-calculated/validated.
    if (typeof clientDeliveryCharges === 'number' && clientDeliveryCharges > 0) {
      serverExtraCharges.push({ chargesName: 'Delivery Charges', chargesAmount: clientDeliveryCharges });
    }

    // 4. Calculate final total amount based on server-side figures
    const totalAfterDiscount = serverCalculatedItemsSubTotal - actualDiscountAmount;
    const serverCalculatedTotalAmount = serverExtraCharges.reduce((sum, charge) => sum + charge.chargesAmount, totalAfterDiscount);
    const finalTotalAmountForOrder = Math.max(0, serverCalculatedTotalAmount);

    // Security Check & Logging: Compare clientTotalAmount with serverCalculatedTotalAmount
    if (Math.abs(clientTotalAmount - finalTotalAmountForOrder) > 0.01) { // Using 1 paisa tolerance
        console.warn(
          `SECURITY WARNING: Client totalAmount (${clientTotalAmount}) ` +
          `differs from server-calculated totalAmount (${finalTotalAmountForOrder}). ` +
          `Order ID (to be created): User ${user._id}, Phone ${phoneNumber}. ` +
          `Using server-calculated value. Coupon: ${actualCouponCode}, Discount: ${actualDiscountAmount}`
        );
    }

    // 5. Calculate payment splits based on server-authoritative final total
    let serverAmountDueOnline = 0;
    let serverAmountDueCod = 0;
    let paymentStatus = 'pending';

    if (paymentMode.configuration) {
      const onlinePercentage = paymentMode.configuration.onlinePercentage || 0;
      const codPercentage = paymentMode.configuration.codPercentage === undefined ? (100 - onlinePercentage) : paymentMode.configuration.codPercentage;
      if (paymentMode.name && paymentMode.name.toLowerCase() === 'cod') {
        serverAmountDueOnline = 0;
        serverAmountDueCod = finalTotalAmountForOrder;
        paymentStatus = 'allToBePaidCod';
      } else if (onlinePercentage === 100) {
        serverAmountDueOnline = finalTotalAmountForOrder;
        serverAmountDueCod = 0;
      } else if (onlinePercentage > 0 && onlinePercentage < 100) {
        serverAmountDueOnline = Math.round((finalTotalAmountForOrder * onlinePercentage) / 100);
        serverAmountDueCod = finalTotalAmountForOrder - serverAmountDueOnline;
      } else {
        serverAmountDueOnline = 0;
        serverAmountDueCod = finalTotalAmountForOrder;
        paymentStatus = 'allToBePaidCod';
      }
    } else {
      serverAmountDueOnline = 0;
      serverAmountDueCod = finalTotalAmountForOrder;
      paymentStatus = 'allToBePaidCod';
    }
    serverAmountDueOnline = Math.max(0, serverAmountDueOnline);
    serverAmountDueCod = Math.max(0, serverAmountDueCod);
    if (finalTotalAmountForOrder === 0) {
        paymentStatus = 'allPaid';
        serverAmountDueOnline = 0;
        serverAmountDueCod = 0;
    }

    // --- Save Order(s) and Prepare for Payment ---
    let utmHistoryId = null;
    if (utmHistory && Array.isArray(utmHistory) && utmHistory.length > 0) {
      const utmHistoryDoc = new UTMHistory({
        user: user._id,
        history: utmHistory.map(entry => ({
          source: entry.source || 'direct',
          medium: entry.medium || null,
          campaign: entry.campaign || null,
          term: entry.term || null,
          content: entry.content || null,
          fbc: entry.fbc || null,
          pathname: entry.pathname || null,
          queryParams: entry.queryParams || null,
          timestamp: entry.timestamp || new Date()
        }))
      });
      const savedUtmHistory = await utmHistoryDoc.save();
      utmHistoryId = savedUtmHistory._id;
    }

    // Prepare base order data
    const baseOrderData = {
      user: user._id,
      items: serverVerifiedItems.map(item => ({
        product: item.product,
        itemSource: item.itemSource || 'inhouse',
        brand: item.brand || null,
        option: item.option || null,
        wrapFinish: item.wrapFinish || null,
        name: item.productName,
        quantity: item.quantity,
        priceAtPurchase: item.serverPrice,
        sku: item.serverSKU,
        thumbnail: item.thumbnail,
        insertionDetails: item.insertionDetails || {}
      })),
      totalAmount: finalTotalAmountForOrder,
      totalDiscount: actualDiscountAmount,
      extraCharges: serverExtraCharges,
      couponApplied: actualCouponCode
        ? [{
            couponCode: actualCouponCode.toUpperCase(),
            discountAmount: actualDiscountAmount,
            incrementedCouponUsage: false,
          }]
        : [],
      paymentDetails: {
        mode: paymentModeId,
        amountPaidOnline: 0,
        amountDueOnline: serverAmountDueOnline,
        amountDueCod: serverAmountDueCod,
        amountPaidCod: 0,
        razorpayDetails: {},
      },
      isTestingOrder: isTestingOrder,
      address: {
        receiverName: address.receiverName,
        receiverPhoneNumber: address.receiverPhoneNumber,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        country: address.country || 'India',
        pincode: address.pincode,
        // geo is not part of legacy Order.address schema; keep it out to avoid breaking queries
      },
      paymentStatus: paymentStatus,
      deliveryStatus: 'pending',
      utmDetails: utmDetails,
      utmHistory: utmHistoryId,
      extraFields: {
        ...extraFields,
        geo: address.geo || extraFields?.geo || undefined,
      },
    };

    // Group items by inventory management
    const { inventoryItems, nonInventoryItems } = await groupItemsByInventory(serverVerifiedItems);
    
    let orders = [];
    let mainOrderId = null;
    
    // Check if we need to split orders
    const needsSplitting = inventoryItems.length > 0 && nonInventoryItems.length > 0;
    
    if (needsSplitting) {
      // Create split orders
      const orderGroupId = generateOrderGroupId();
      const itemGroups = [];
      
      // Map raw items back to transformed order items from baseOrderData
      if (inventoryItems.length > 0) {
        const transformedInventoryItems = baseOrderData.items.filter(orderItem => 
          inventoryItems.some(rawItem => 
            rawItem.product.toString() === orderItem.product.toString() &&
            (rawItem.option ? rawItem.option.toString() === orderItem.option?.toString() : !orderItem.option)
          )
        );
        itemGroups.push({ items: transformedInventoryItems });
      }
      
      if (nonInventoryItems.length > 0) {
        const transformedNonInventoryItems = baseOrderData.items.filter(orderItem => 
          nonInventoryItems.some(rawItem => 
            rawItem.product.toString() === orderItem.product.toString() &&
            (rawItem.option ? rawItem.option.toString() === orderItem.option?.toString() : !orderItem.option)
          )
        );
        itemGroups.push({ items: transformedNonInventoryItems });
      }

      const splitOrdersData = createSplitOrdersData(baseOrderData, itemGroups, orderGroupId);
      
      // Create all orders
      for (const orderData of splitOrdersData) {
        const order = new Order(orderData);
        await order.save();
        orders.push(order);
        
        if (order.isMainOrder) {
          mainOrderId = order._id;
        }
      }

      // Update all orders with linkedOrderIds
      const allOrderIds = orders.map(order => order._id);
      await Promise.all(orders.map(order => 
        Order.findByIdAndUpdate(order._id, {
          linkedOrderIds: allOrderIds.filter(id => !id.equals(order._id))
        })
      ));

    } else {
      // Create single order (no splitting needed)
      const order = new Order(baseOrderData);
      await order.save();
      orders.push(order);
      mainOrderId = order._id;
    }

    // Update UTM history with main order reference
    if (utmHistoryId) {
      await UTMHistory.findByIdAndUpdate(utmHistoryId, { order: mainOrderId });
    }

    // Handle Razorpay order creation for online payments
    const mainOrder = orders.find(order => order.isMainOrder) || orders[0];
    let razorpayOrderResponse = null;
    
    if (serverAmountDueOnline > 0) {
      const amountInPaise = Math.floor(serverAmountDueOnline * 100);
      const receiptId = shortid.generate();
      const razorpayOptions = {
        amount: amountInPaise.toString(),
        currency: 'INR',
        receipt: receiptId,
        payment_capture: 1,
        notes: {
          databaseOrderId: mainOrder._id.toString(),
          orderGroupId: mainOrder.orderGroupId || '',
          isLinkedOrder: orders.length > 1 ? 'true' : 'false',
        },
      };

      try {
        razorpayOrderResponse = await razorpayInstance.orders.create(razorpayOptions);
        
        // Update Razorpay details for all orders with online payments
        for (const order of orders) {
          if (order.paymentDetails.amountDueOnline > 0) {
            order.paymentDetails.razorpayDetails.orderId = razorpayOrderResponse.id;
            order.paymentDetails.razorpayDetails.receipt = receiptId;
            await order.save();
          }
        }
      } catch (rzpError) {
        console.error('Razorpay order creation failed:', rzpError);
        
        // Update all orders with error status
        await Promise.all(orders.map(order =>
          Order.findByIdAndUpdate(order._id, { 
            $set: { 
              paymentStatus: 'failed', 
              'paymentDetails.razorpayDetails.error': rzpError.message 
            } 
          })
        ));
        
        return NextResponse.json(
          { 
            message: 'Failed to initiate payment with Razorpay. Please try again or contact support.', 
            orderId: mainOrderId,
            orderIds: orders.map(order => order._id)
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        message: 'Order created successfully',
        orderId: mainOrderId,
        orderIds: orders.map(order => order._id),
        isSplitOrder: orders.length > 1,
        razorpayOrder: razorpayOrderResponse,
        amountDueOnline: serverAmountDueOnline,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating order:', error.message, error.stack);
    let clientMessage = 'Internal Server Error';
    if (error.message.includes('Product not found') || error.message.includes('Option not found')) {
        clientMessage = "Some items in your cart are no longer available. Please review your cart.";
    } else if (error.message.includes('Invalid or missing required fields')) {
      clientMessage = error.message;
    }
    return NextResponse.json(
      { message: clientMessage },
      { status: 500 }
    );
  }
}
