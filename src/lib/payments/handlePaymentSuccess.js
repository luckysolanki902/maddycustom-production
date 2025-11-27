/**
 * Centralized Payment Success Handler
 * 
 * This module handles all post-payment success operations for both PayU and Razorpay:
 * 1. Inventory deduction (idempotent)
 * 2. Coupon usage increment
 * 3. Shiprocket order creation
 * 4. WhatsApp notification
 * 5. Analytics events (Meta Purchase, Google Purchase)
 * 
 * All operations use MongoDB transactions for atomicity.
 */

import mongoose from 'mongoose';
import Order from '@/models/Order';
import Coupon from '@/models/Coupon';
import Product from '@/models/Product';
import Option from '@/models/Option';
import User from '@/models/User';
import { createShiprocketOrder, getDimensionsAndWeight } from '@/lib/utils/shiprocket';
import { sendWhatsAppMessage } from '@/lib/utils/aiSensySender';
import { createLogger } from '@/lib/utils/logger';
import { buildPurchaseEventPayload } from '@/lib/analytics/purchaseEventPayload';

const logger = createLogger('PaymentSuccess');

/**
 * Updates inventory for a given Inventory document
 * @param {string} inventoryId - MongoDB ObjectId of inventory document
 * @param {number} delta - Amount to change (negative for deduction)
 * @param {object} session - MongoDB session for transaction
 */
async function updateInventory(inventoryId, delta, session) {
  const result = await mongoose.model('Inventory').updateOne(
    { _id: inventoryId },
    {
      $inc: {
        availableQuantity: delta,
        reservedQuantity: -delta,
      },
    },
    { session }
  );
  return result;
}

/**
 * Sends analytics events for purchase (Meta Pixel, Google Ads)
 * @param {object} order - Order document
 * @param {object} options - Additional options
 */
async function sendPurchaseAnalytics(order, options = {}) {
  const { paymentProvider = 'unknown' } = options;
  const logs = [];

  try {
    // Build purchase event payload using centralized builder
    const purchasePayload = buildPurchaseEventPayload({
      orderId: order._id.toString(),
      totalValue: order.totalAmount,
      currency: 'INR',
      couponCode: order.couponApplied?.[0]?.couponCode,
      items: order.items.map(item => ({
        productId: item.product?._id?.toString() || item.product,
        name: item.name,
        quantity: item.quantity,
        price: item.priceAtPurchase,
        sku: item.sku,
      })),
      paymentMode: order.paymentDetails?.mode?.name,
      paymentStatus: order.paymentStatus,
      amountDueOnline: order.paymentDetails?.amountDueOnline || 0,
      amountPaidOnline: order.paymentDetails?.amountPaidOnline || 0,
      amountDueCod: order.paymentDetails?.amountDueCod || 0,
      totalDiscount: order.totalDiscount || 0,
      metadata: {
        paymentProvider,
        webhook: true,
      },
    });

    // Note: Funnel tracking happens client-side automatically
    // No need to track from server-side webhook
    logs.push('ℹ️ Funnel tracking handled by client-side');

    // Send Meta Conversion API event if analytics info is available
    // Check if analyticsInfo has at least some data (not all null)
    const hasAnalyticsData = order.analyticsInfo && (
      order.analyticsInfo.ip ||
      order.analyticsInfo.userAgent ||
      order.analyticsInfo.externalId ||
      order.analyticsInfo.fbp ||
      order.analyticsInfo.gaClientId
    );

    if (hasAnalyticsData) {
      try {
        const { v4: uuidv4 } = await import('uuid');
        
        // Prepare user data from analyticsInfo
        const userData = {
          em: order.user?.email || null, // Email (will be hashed by API)
          ph: order.address?.receiverPhoneNumber || null, // Phone (will be hashed by API)
          fn: order.address?.receiverName?.split(' ')[0] || null, // First name
          ln: order.address?.receiverName?.split(' ').slice(1).join(' ') || null, // Last name
          ct: order.address?.city || null,
          st: order.address?.state || null,
          zp: order.address?.pincode || null,
          country: order.address?.country || 'IN',
        };

        // Add client-captured data
        if (order.analyticsInfo.ip) userData.client_ip_address = order.analyticsInfo.ip;
        if (order.analyticsInfo.userAgent) userData.client_user_agent = order.analyticsInfo.userAgent;
        if (order.analyticsInfo.fbp) userData.fbp = order.analyticsInfo.fbp;
        if (order.analyticsInfo.fbc) userData.fbc = order.analyticsInfo.fbc;
        if (order.analyticsInfo.externalId) userData.external_id = order.analyticsInfo.externalId;

        // Calculate purchase value - use itemsTotal (actual cart value) for Meta
        // For testing orders, this shows real value instead of ₹1 gateway test amount
        const purchaseValue = order.itemsTotal || order.totalAmount || 0;
        
        // Validate purchase value before sending to Meta
        if (purchaseValue <= 0) {
          logs.push(`⚠️ Skipping Meta CAPI: Invalid purchase value (${purchaseValue})`);
          logger.warn('Invalid purchase value for Meta CAPI', {
            orderId: order._id.toString(),
            itemsTotal: order.itemsTotal,
            totalAmount: order.totalAmount,
            purchaseValue,
          });
        } else {
          // Prepare event data in the format expected by /api/meta/conversion-api
          // The API expects: { eventName, options: { value, currency, emails, phones, ... } }
          const eventData = {
            eventName: 'Purchase',
            options: {
              eventID: uuidv4(),
              event_id: uuidv4(), // Some code paths use event_id
              value: purchaseValue,
              currency: 'INR',
              content_type: 'product',
              content_ids: order.items.map(item => item.product?._id?.toString() || item.product),
              contents: order.items.map(item => ({
                id: item.product?._id?.toString() || item.product,
                quantity: item.quantity,
                item_price: item.priceAtPurchase,
              })),
              num_items: order.items.reduce((sum, item) => sum + item.quantity, 0),
              order_id: order._id.toString(),
              // User data fields at top level (API expects flat structure)
              emails: userData.em ? [userData.em] : [],
              phones: userData.ph ? [userData.ph] : [],
              fn: userData.fn,
              ln: userData.ln,
              ct: userData.ct,
              st: userData.st,
              zp: userData.zp,
              country: userData.country,
              // Client tracking data
              client_ip_address: userData.client_ip_address,
              client_user_agent: userData.client_user_agent,
              fbp: userData.fbp,
              fbc: userData.fbc,
              external_id: userData.external_id,
              // Event source URL
              event_source_url: order.analyticsInfo?.sourceUrl || 'https://www.maddycustom.com',
            },
          };

          // Send to Meta Conversion API
          const metaResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://www.maddycustom.com'}/api/meta/conversion-api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData),
          });

          if (metaResponse.ok) {
            logs.push('✅ Meta Purchase event sent successfully via CAPI');
            logger.info('Meta Purchase event sent', {
              orderId: order._id.toString(),
              eventID: eventData.eventID,
              purchaseValue,
            });
          } else {
            const errorText = await metaResponse.text();
            logs.push(`⚠️ Meta Purchase event failed: ${errorText}`);
            logger.error('Meta Purchase event failed', {
              status: metaResponse.status,
              error: errorText,
              orderId: order._id.toString(),
              purchaseValue,
            });
          }
        }
      } catch (metaErr) {
        logs.push(`⚠️ Meta Purchase event error: ${metaErr.message}`);
        logger.error('Meta Purchase event error', {
          error: metaErr.message,
          orderId: order._id.toString(),
        });
      }
    } else {
      logs.push('⚠️ No analyticsInfo available, skipping Meta CAPI event');
      logger.warn('No analyticsInfo for Meta event', {
        orderId: order._id.toString(),
      });
    }

    // Note: Google Ads Purchase tracking happens client-side
    // gtag events fire automatically on order success page
    logs.push('ℹ️ Google Ads tracking handled by client-side gtag');

  } catch (error) {
    logs.push(`❌ Analytics error: ${error.message}`);
    logger.error('Analytics processing failed', {
      error: error.message,
      stack: error.stack,
      orderId: order._id.toString(),
    });
  }

  return logs;
}

/**
 * Main handler for payment success operations
 * @param {Array<object>} orders - Array of order documents (main + linked)
 * @param {object} session - MongoDB session for transaction
 * @param {object} options - Additional options
 * @returns {object} Processing result with logs
 */
export async function handlePaymentSuccess(orders, session, options = {}) {
  const { paymentProvider = 'unknown', skipWhatsApp = false } = options;
  const logs = [];
  const timestampStr = new Date().toLocaleString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  logger.info('Starting payment success handler', {
    orderCount: orders.length,
    paymentProvider,
    orderIds: orders.map(o => o._id.toString()),
  });

  logs.push(`[${timestampStr}] Processing ${orders.length} orders`);

  try {
    // Find main order for coupon and WhatsApp
    const mainOrder = orders.find(ord => ord.isMainOrder) || orders[0];

    // ============================================
    // 1. Handle Coupon Usage Increment (once for main order)
    // ============================================
    if (mainOrder.couponApplied?.length > 0) {
      const [appliedCoupon] = mainOrder.couponApplied;
      if (appliedCoupon.couponCode && !appliedCoupon.incrementedCouponUsage) {
        const couponDoc = await Coupon.findOne({ code: appliedCoupon.couponCode }).session(session);
        if (couponDoc) {
          couponDoc.usageCount += 1;
          await couponDoc.save({ session });
          
          // Update coupon increment status in all orders
          for (const ord of orders) {
            if (ord.couponApplied?.length > 0) {
              const updated = await Order.findByIdAndUpdate(
                ord._id,
                {
                  $set: {
                    'couponApplied.$[elem].incrementedCouponUsage': true
                  }
                },
                {
                  arrayFilters: [{ 'elem.couponCode': appliedCoupon.couponCode }],
                  session,
                  new: true
                }
              );
            }
          }
          logs.push(`[${timestampStr}] ✅ Coupon usage incremented: ${appliedCoupon.couponCode}`);
          logger.info('Coupon incremented', {
            couponCode: appliedCoupon.couponCode,
            newUsageCount: couponDoc.usageCount,
          });
        }
      }
    }

    // ============================================
    // 2. Deduct Inventory for Each Order (Idempotent)
    // ============================================
    for (const ord of orders) {
      const updatedOrd = await Order.findById(ord._id).session(session);
      
      if (
        (updatedOrd.paymentStatus === 'paidPartially' || updatedOrd.paymentStatus === 'allPaid') &&
        !updatedOrd.inventoryDeducted &&
        !updatedOrd.isTestingOrder
      ) {
        logs.push(`[${timestampStr}] Deducting inventory for order ${updatedOrd._id}`);
        logger.info('Starting inventory deduction', { orderId: updatedOrd._id.toString() });
        
        const unitDelta = -1;

        for (const item of updatedOrd.items) {
          if (item.option) {
            logs.push(`  - Updating inventory for Option ${item.option} x ${item.quantity}`);
            const optionDoc = await Option.findById(item.option).session(session);
            if (optionDoc?.inventoryData) {
              await updateInventory(optionDoc.inventoryData, unitDelta * item.quantity, session);
              logger.info('Inventory deducted for option', {
                optionId: item.option.toString(),
                quantity: item.quantity,
              });
            } else {
              logs.push(`  ⚠️ Option ${item.option} has no inventoryData reference`);
              logger.warn('Option missing inventoryData', { optionId: item.option.toString() });
            }
          } else if (item.product) {
            logs.push(`  - Updating inventory for Product ${item.product} x ${item.quantity}`);
            const productDoc = await Product.findById(item.product).session(session);
            if (productDoc?.inventoryData) {
              await updateInventory(productDoc.inventoryData, unitDelta * item.quantity, session);
              logger.info('Inventory deducted for product', {
                productId: item.product.toString(),
                quantity: item.quantity,
              });
            } else {
              logs.push(`  ⚠️ Product ${item.product} has no inventoryData reference`);
              logger.warn('Product missing inventoryData', { productId: item.product.toString() });
            }
          } else {
            logs.push(`  ⚠️ Order item missing product/option reference`);
            logger.warn('Item missing product/option', { item });
          }
        }
        
        // Mark inventory as deducted
        await Order.findByIdAndUpdate(
          updatedOrd._id,
          { $set: { inventoryDeducted: true } },
          { session }
        );
        logs.push(`[${timestampStr}] ✅ Inventory deducted for order ${updatedOrd._id}`);
      }
    }

    // ============================================
    // 3. Get Updated Orders with Populated Data
    // ============================================
    const updatedAllOrders = await Promise.all(
      orders.map(ord => 
        Order.findById(ord._id)
          .populate({
            path: 'items.product',
            populate: {
              path: 'specificCategoryVariant',
              model: 'SpecificCategoryVariant',
            },
          })
          .populate('user')
          .session(session)
      )
    );

    // ============================================
    // 4. Create Shiprocket Orders
    // ============================================
    for (const ord of updatedAllOrders) {
      if (
        ['allPaid', 'paidPartially'].includes(ord.paymentStatus) &&
        ord.deliveryStatus === 'pending' &&
        !ord.shiprocketOrderId &&
        !ord.isTestingOrder
      ) {
        logs.push(`[${timestampStr}] Creating Shiprocket order for ${ord._id}`);
        logger.info('Creating Shiprocket order', { orderId: ord._id.toString() });
        
        try {
          // Ensure address exists
          if (!ord.address || !ord.address.addressLine1) {
            logs.push(`  ⚠️ Order ${ord._id} missing address, skipping Shiprocket`);
            logger.warn('Order missing address', { orderId: ord._id.toString() });
            continue;
          }

          const dimensionsAndWeight = await getDimensionsAndWeight(ord.items);
          const { length, breadth, height, weight } = dimensionsAndWeight;
          
          const [firstName, ...restName] = ord.address.receiverName.split(' ');
          const lastName = restName.join(' ');

          const shiprocketPayload = {
            order_id: ord._id.toString(),
            order_date: new Date().toISOString(),
            billing_customer_name: firstName,
            billing_last_name: lastName || '',
            billing_address: `${ord.address.addressLine1} ${ord.address.addressLine2 || ''}`,
            billing_city: ord.address.city,
            billing_pincode: ord.address.pincode,
            billing_state: ord.address.state,
            billing_country: ord.address.country,
            billing_phone: ord.address.receiverPhoneNumber,
            shipping_is_billing: true,
            order_items: ord.items.map((item) => ({
              name: item.name,
              sku: item.wrapFinish ? `${item.sku}-${item.wrapFinish.charAt(0).toLowerCase()}` : item.sku,
              units: item.quantity,
              selling_price: item.priceAtPurchase,
            })),
            payment_method: ord.paymentDetails.amountDueCod > 0 ? 'COD' : 'Prepaid',
            sub_total: ord.paymentDetails.amountDueCod > 0
              ? ord.paymentDetails.amountDueCod
              : ord.totalAmount,
            length,
            breadth,
            height,
            weight,
          };

          const shiprocketResponse = await createShiprocketOrder(shiprocketPayload);
          
          if (shiprocketResponse?.status_code === 1 && !shiprocketResponse?.packaging_box_error) {
            await Order.findByIdAndUpdate(
              ord._id,
              {
                $set: {
                  shiprocketOrderId: shiprocketResponse.order_id.toString(),
                  deliveryStatus: 'orderCreated',
                },
              },
              { session }
            );
            logs.push(`[${timestampStr}] ✅ Shiprocket order created: ${shiprocketResponse.order_id}`);
            logger.info('Shiprocket order created', {
              orderId: ord._id.toString(),
              shiprocketOrderId: shiprocketResponse.order_id,
            });
          } else {
            logs.push(`  ⚠️ Shiprocket response invalid or packaging error`);
            logger.warn('Shiprocket creation failed', {
              orderId: ord._id.toString(),
              response: shiprocketResponse,
            });
          }
        } catch (shiprocketError) {
          logs.push(`  ❌ Shiprocket error: ${shiprocketError.message}`);
          logger.error('Shiprocket creation error', {
            orderId: ord._id.toString(),
            error: shiprocketError.message,
            stack: shiprocketError.stack,
          });
        }
      } else {
        let reason = 'unknown';
        if (!['allPaid', 'paidPartially'].includes(ord.paymentStatus)) {
          reason = 'payment not successful';
        } else if (ord.deliveryStatus !== 'pending') {
          reason = `deliveryStatus is ${ord.deliveryStatus}`;
        } else if (ord.shiprocketOrderId) {
          reason = 'shiprocketOrderId already exists';
        } else if (ord.isTestingOrder) {
          reason = 'testing order';
        }
        logs.push(`[${timestampStr}] Skipping Shiprocket for ${ord._id}: ${reason}`);
      }
    }

    // ============================================
    // 5. Send Analytics Events (for main order)
    // ============================================
    logs.push(`[${timestampStr}] Sending analytics events for main order`);
    const analyticsLogs = await sendPurchaseAnalytics(mainOrder, { paymentProvider });
    logs.push(...analyticsLogs);

    // ============================================
    // 6. Send WhatsApp Notification (outside transaction)
    // ============================================
    // Note: WhatsApp should be sent AFTER transaction commits
    // This will be handled by the caller

    logger.info('Payment success handler completed', {
      orderCount: orders.length,
      mainOrderId: mainOrder._id.toString(),
    });

    return {
      success: true,
      logs,
      mainOrderId: mainOrder._id.toString(),
      orderIds: orders.map(o => o._id.toString()),
    };
  } catch (error) {
    logs.push(`[${timestampStr}] ❌ Error: ${error.message}`);
    logger.error('Payment success handler failed', {
      error: error.message,
      stack: error.stack,
      orderIds: orders.map(o => o._id.toString()),
    });
    throw error;
  }
}

/**
 * Sends WhatsApp notification after successful payment
 * This should be called AFTER the transaction commits
 * @param {object} mainOrder - Main order document
 */
export async function sendPaymentSuccessWhatsApp(mainOrder) {
  const logs = [];
  const timestampStr = new Date().toLocaleString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  if (mainOrder.isTestingOrder) {
    logs.push(`[${timestampStr}] Skipping WhatsApp (testing order)`);
    logger.info('WhatsApp skipped for testing order', {
      orderId: mainOrder._id.toString(),
    });
    return logs;
  }

  try {
    const userDoc = await User.findById(mainOrder.user);
    if (!userDoc) {
      logs.push(`[${timestampStr}] ⚠️ User not found for order ${mainOrder._id}`);
      logger.warn('User not found for WhatsApp', {
        orderId: mainOrder._id.toString(),
        userId: mainOrder.user?.toString(),
      });
      return logs;
    }

    const buttons = [
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [
          {
            type: 'text',
            text: mainOrder._id?.toString() || 'Order ID',
          },
        ],
      },
    ];

    await sendWhatsAppMessage({
      user: userDoc,
      prefUserName: mainOrder.address.receiverName || '',
      campaignName:
        new Date().getTime() < new Date('2025-04-03T00:00:00.000Z').getTime()
          ? 'delay_eid'
          : 'order_confirmed',
      orderId: mainOrder._id,
      templateParams: [],
      carouselCards: [],
      buttons,
    });

    logs.push(`[${timestampStr}] ✅ WhatsApp message sent to user ${userDoc._id}`);
    logger.info('WhatsApp notification sent', {
      orderId: mainOrder._id.toString(),
      userId: userDoc._id.toString(),
    });
  } catch (whatsappError) {
    logs.push(`[${timestampStr}] ❌ WhatsApp error: ${whatsappError.message}`);
    logger.error('WhatsApp notification failed', {
      orderId: mainOrder._id.toString(),
      error: whatsappError.message,
      stack: whatsappError.stack,
    });
  }

  return logs;
}
