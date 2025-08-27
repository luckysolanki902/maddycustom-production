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
import mongoose from 'mongoose';
import { partitionCartItems, buildPartitionFinancials, choosePrimaryPartition, newGroupId } from '@/lib/utils/orderPartitioning';

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

  // 4. Fetch Product and Option details for price verification (also gather docs for partition logic)
    const productAndOptionIds = clientItems.map(item => ({
      productId: item.product,
      optionId: item.option || null,
      originalClientItem: item // Keep reference to client item for quantity
    }));

    // --- Performance Optimization: Batch fetch products & options ---
    const productIds = [...new Set(productAndOptionIds.map(i => i.productId))];
    const optionIds = [...new Set(productAndOptionIds.filter(i => i.optionId).map(i => i.optionId))];
    const [productDocs, optionDocs] = await Promise.all([
      Product.find({ _id: { $in: productIds } }).select('price MRP optionsAvailable sku name specificCategory inventoryData').lean(),
      optionIds.length ? Option.find({ _id: { $in: optionIds } }).select('optionDetails price sku inventoryData').lean() : Promise.resolve([])
    ]);
    const productMap = new Map(productDocs.map(p => [String(p._id), p]));
    const optionMap = new Map(optionDocs.map(o => [String(o._id), o]));
    const serverVerifiedItems = productAndOptionIds.map(ref => {
      const product = productMap.get(String(ref.productId));
      if (!product) throw new Error(`Product not found: ${ref.productId}`);
      let optionDoc = null; let optionSKU = product.sku; let effectivePrice = product.price; let effectiveMRP = product.MRP;
      if (ref.optionId && product.optionsAvailable) {
        optionDoc = optionMap.get(String(ref.optionId));
        if (!optionDoc) throw new Error(`Option not found: ${ref.optionId} for product ${ref.productId}`);
        optionSKU = optionDoc.sku || product.sku;
        // If future option-level price overrides are enabled, adjust effectivePrice here.
      }
      return {
        ...ref.originalClientItem,
        serverPrice: effectivePrice,
        serverMRP: effectiveMRP,
        serverSKU: optionSKU,
        productName: product.name,
        specificCategory: product.specificCategory,
        productDoc: product,
        optionDoc,
      };
    });
    serverDataPromises.push(Promise.resolve(serverVerifiedItems));
    
    // Execute all fetching promises
    const [ 
      paymentMode, 
      userResult, 
      offerResult, 
      /* serverVerifiedItems already resolved earlier */
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
  const serverCalculatedItemsSubTotal = serverVerifiedItems.reduce((sum, item) => sum + (item.serverPrice * item.quantity), 0);

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

    // 4. Determine partitioning (multi-order logic)
    const partitions = partitionCartItems(serverVerifiedItems);
    const totalExtraCharges = serverExtraCharges.reduce((s, c) => s + c.chargesAmount, 0);

    // If only one partition remains, keep legacy (single order) path using existing variables for backward compatibility
    let isMulti = partitions.length > 1;

    let allocationResult = null;
    if (isMulti) {
      // Online percentage from payment mode configuration (if absent treat as 0 or COD logic handled later)
      const onlinePct = paymentMode.configuration?.onlinePercentage || 0;
      allocationResult = buildPartitionFinancials(
        partitions,
        {
          totalDiscount: actualDiscountAmount,
          totalExtraCharges: totalExtraCharges,
          onlinePercentage: onlinePct,
        }
      );
    }

    const totalAfterDiscount = serverCalculatedItemsSubTotal - actualDiscountAmount;
    const serverCalculatedTotalAmount = totalAfterDiscount + totalExtraCharges;
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

    // 5. Payment splits (single vs multi)
    let serverAmountDueOnline = 0;
    let serverAmountDueCod = 0;
    let paymentStatus = 'pending';
    let onlinePercentage = paymentMode.configuration?.onlinePercentage || 0;

    if (!isMulti) {
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
      serverAmountDueOnline = Math.max(0, serverAmountDueOnline);
      serverAmountDueCod = Math.max(0, serverAmountDueCod);
      if (finalTotalAmountForOrder === 0) {
        paymentStatus = 'allPaid';
        serverAmountDueOnline = 0;
        serverAmountDueCod = 0;
      }
    }

    // --- Save Order and Prepare for Payment ---
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

    if (!isMulti) {
      const newOrder = {
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
      },
      paymentStatus: paymentStatus,
      deliveryStatus: 'pending',
      utmDetails: utmDetails,
      utmHistory: utmHistoryId,
      extraFields: extraFields,
      isGroupPrimary: false, // single order scenario
    };
      const order = new Order(newOrder);
      await order.save();

      if (utmHistoryId) {
        await UTMHistory.findByIdAndUpdate(utmHistoryId, { order: order._id });
      }

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
            databaseOrderId: order._id.toString(),
          },
        };

        try {
          razorpayOrderResponse = await razorpayInstance.orders.create(razorpayOptions);
          order.paymentDetails.razorpayDetails.orderId = razorpayOrderResponse.id;
          order.paymentDetails.razorpayDetails.receipt = receiptId;
          await order.save();
        } catch (rzpError) {
          console.error('Razorpay order creation failed:', rzpError);
          await Order.findByIdAndUpdate(order._id, { $set: { paymentStatus: 'failed', 'paymentDetails.razorpayDetails.error': rzpError.message } });
          return NextResponse.json(
            { message: 'Failed to initiate payment with Razorpay. Please try again or contact support.', orderId: order._id },
            { status: 500 }
          );
        }
      }

      return NextResponse.json(
        {
          message: 'Order created successfully',
          orderId: order._id,
          razorpayOrder: razorpayOrderResponse,
          amountDueOnline: serverAmountDueOnline,
        },
        { status: 201 }
      );
    }

    // ---------------- Multi-Order Creation Path ----------------
    const groupId = newGroupId();
    const primaryPartition = choosePrimaryPartition(allocationResult);
    const primaryKey = primaryPartition.key;
    const ordersToInsert = [];

    for (const part of allocationResult.partitions) {
      const partItems = partitions.find(p => p.key === part.key).items;
      const isPrimary = part.key === primaryKey;
      const paymentStatusPart = part.finalTotal === 0 ? 'allPaid' : (part.online > 0 ? 'pending' : (part.cod > 0 ? 'allToBePaidCod' : 'allPaid'));
      ordersToInsert.push({
        user: user._id,
        items: partItems.map(item => ({
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
        totalAmount: part.finalTotal,
        totalDiscount: part.discount,
        extraCharges: part.charges > 0 ? [{ chargesName: 'Allocated Charges', chargesAmount: part.charges }] : [],
        couponApplied: actualCouponCode ? [{ couponCode: actualCouponCode.toUpperCase(), discountAmount: part.discount, incrementedCouponUsage: false }] : [],
        paymentDetails: {
          mode: paymentModeId,
          amountPaidOnline: 0,
          amountDueOnline: part.online,
          amountDueCod: part.cod,
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
        },
        paymentStatus: paymentStatusPart,
        deliveryStatus: 'pending',
        utmDetails: utmDetails,
        utmHistory: utmHistoryId,
        extraFields: extraFields,
        groupId,
        partitionKey: part.key,
        isGroupPrimary: isPrimary,
        parentPaymentOrder: null, // fill after insertion for non-primary
        groupAllocation: {
          subtotal: part.subtotal,
          discountPortion: part.discount,
          extraChargesPortion: part.charges,
            totalAfterDiscount: part.totalAfterDiscount,
          finalTotal: part.finalTotal,
          onlinePortion: part.online,
          codPortion: part.cod,
        },
        originalGroupSnapshot: isPrimary ? {
          subtotalGroup: allocationResult.overall.subtotal,
          discountGroup: allocationResult.overall.discount,
          extraChargesGroup: allocationResult.overall.charges,
          finalTotalGroup: allocationResult.overall.final,
          onlineGroupTotal: allocationResult.overall.onlineTotal,
          codGroupTotal: allocationResult.overall.codTotal,
        } : undefined,
      });
    }

    // Insert all orders in a session for atomicity
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const created = await Order.insertMany(ordersToInsert, { session });
      const primaryOrder = created.find(o => o.isGroupPrimary);
      const siblingIds = created.map(o => o._id).filter(id => true);
      // update linkedOrders + parentPaymentOrder for non-primary
      for (const doc of created) {
        doc.linkedOrders = siblingIds.filter(id => !id.equals(doc._id));
        if (!doc.isGroupPrimary) doc.parentPaymentOrder = primaryOrder._id;
        await doc.save({ session });
      }
      if (utmHistoryId) {
        await UTMHistory.findByIdAndUpdate(utmHistoryId, { orderGroupPrimary: primaryOrder._id }, { session });
      }
      let razorpayOrderResponse = null;
      if (allocationResult.overall.onlineTotal > 0) {
        const amountInPaise = Math.floor(allocationResult.overall.onlineTotal * 100);
        const receiptId = shortid.generate();
        const razorpayOptions = {
          amount: amountInPaise.toString(),
          currency: 'INR',
          receipt: receiptId,
          payment_capture: 1,
          notes: {
            databaseOrderGroupId: groupId.toString(),
            primaryOrderId: primaryOrder._id.toString(),
          },
        };
        try {
          razorpayOrderResponse = await razorpayInstance.orders.create(razorpayOptions);
          primaryOrder.paymentDetails.razorpayDetails.orderId = razorpayOrderResponse.id;
          primaryOrder.paymentDetails.razorpayDetails.receipt = receiptId;
          await primaryOrder.save({ session });
        } catch (rzpErr) {
          console.error('Razorpay order creation failed for group:', rzpErr);
          // mark failure statuses
          await Order.updateMany({ groupId }, { $set: { paymentStatus: 'failed' } }, { session });
          await session.commitTransaction();
          session.endSession();
          return NextResponse.json({ message: 'Failed to initiate payment with Razorpay.', groupId, primaryOrderId: primaryOrder._id }, { status: 500 });
        }
      }
      await session.commitTransaction();
      session.endSession();
      return NextResponse.json({
        message: 'Orders created successfully',
        group: {
          groupId,
          primaryOrderId: primaryOrder._id,
          orderIds: siblingIds,
          onlineTotal: allocationResult.overall.onlineTotal,
          codTotal: allocationResult.overall.codTotal,
        },
        razorpayOrder: allocationResult.overall.onlineTotal > 0 ? { id: primaryOrder.paymentDetails.razorpayDetails.orderId } : null,
        amountDueOnline: allocationResult.overall.onlineTotal,
      }, { status: 201 });
    } catch (multiErr) {
      await session.abortTransaction();
      session.endSession();
      console.error('Multi-order creation failed:', multiErr);
      return NextResponse.json({ message: 'Failed to create orders.', error: multiErr.message }, { status: 500 });
    }
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
