/**
 * Shiprocket Magic Checkout Webhook Handler
 * POST /api/shiprocket/webhooks/magic-checkout
 * 
 * Receives order status updates from Shiprocket and updates internal session records.
 * 
 * Payload structure from Shiprocket:
 * {
 *   "order_id": "686233cd1ff136306c2bf410",
 *   "platform_order_id": "686233cd1ff136306c2bf410",
 *   "fastrr_order_id": "113535525",
 *   "cart_id": "686233ce4b87c76957f1108d",
 *   "status": "SUCCESS" | "FAILED" | "INITIATED",
 *   "payment_type": "PREPAID" | "CASH_ON_DELIVERY",
 *   "payment_status": "Success" | "Pending" | "Failed",
 *   "total_amount_payable": 1586.68,
 *   "subtotal_price": 7199,
 *   "shipping_charges": 0,
 *   "cod_charges": null,
 *   "coupon_discount": 5579.94,
 *   "prepaid_discount": 32.38,
 *   "total_discount": 5612.32,
 *   "phone": "6302017947",
 *   "email": "test@gmail.com",
 *   "shipping_address": { ... },
 *   "billing_address": { ... },
 *   "cart_data": { "items": [...] },
 *   "order_created_date": "2025-06-30T06:59:32Z"
 * }
 */

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import MagicCheckoutSession from '@/models/MagicCheckoutSession';

export async function POST(request) {
  try {
    // Parse payload (Shiprocket order webhooks don't send signature)
    const payload = await request.json();

    // Extract order IDs
    const orderId = payload.order_id || payload.platform_order_id;
    const fastrrOrderId = payload.fastrr_order_id;
    const cartId = payload.cart_id;
    const orderStatus = payload.status; // SUCCESS, FAILED, INITIATED
    const paymentStatus = payload.payment_status; // Success, Pending, Failed
    const paymentType = payload.payment_type; // PREPAID, CASH_ON_DELIVERY

    console.log('[Shiprocket Webhook] Received:', {
      orderId,
      fastrrOrderId,
      cartId,
      orderStatus,
      paymentStatus,
      paymentType,
    });

    if (!orderId) {
      console.error('[Shiprocket Webhook] Missing order_id in payload');
      return NextResponse.json({ message: 'Missing order_id' }, { status: 400 });
    }

    await connectToDatabase();

    // Find existing session by shiprocketOrderId or cartId
    const query = cartId
      ? { $or: [{ shiprocketOrderId: orderId }, { shiprocketCartId: cartId }] }
      : { shiprocketOrderId: orderId };

    const session = await MagicCheckoutSession.findOne(query);

    if (!session) {
      console.warn(`[Shiprocket Webhook] Session not found for order ${orderId}, cartId ${cartId}`);
      // Return 200 to acknowledge receipt
      return NextResponse.json(
        { message: 'Session not found, logged for review' },
        { status: 200 }
      );
    }

    // Determine session status from order status
    let sessionStatus = session.status;
    if (orderStatus === 'SUCCESS' && paymentStatus === 'Success') {
      sessionStatus = 'completed';
    } else if (orderStatus === 'FAILED' || paymentStatus === 'Failed') {
      sessionStatus = 'failed';
    } else if (orderStatus === 'INITIATED') {
      sessionStatus = 'pending';
    }

    // Update session with webhook data
    session.shiprocketOrderId = orderId;
    if (cartId) session.shiprocketCartId = cartId;
    if (fastrrOrderId) session.fastrrOrderId = fastrrOrderId;
    session.status = sessionStatus;

    // Store customer info if not present
    if (payload.phone && !session.user?.phoneNumber) {
      session.user = session.user || {};
      session.user.phoneNumber = payload.phone;
    }
    if (payload.email && !session.user?.email) {
      session.user = session.user || {};
      session.user.email = payload.email;
    }

    // Store webhook event for audit trail
    if (!session.metadata) session.metadata = {};
    if (!session.metadata.webhookEvents) session.metadata.webhookEvents = [];
    
    session.metadata.webhookEvents.push({
      orderStatus,
      paymentStatus,
      paymentType,
      amount: payload.total_amount_payable || null,
      shippingAddress: payload.shipping_address || null,
      timestamp: payload.order_created_date || new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    });

    await session.save();

    console.log(`[Shiprocket Webhook] Processed order ${orderId} (status: ${orderStatus}), session ${session._id}`);

    // TODO: Create internal Order document with full order details
    // TODO: Trigger analytics tracking
    // TODO: Send order confirmation notifications

    return NextResponse.json({ 
      message: 'Webhook processed', 
      sessionId: session._id.toString(),
      orderId,
      status: sessionStatus,
    });
  } catch (err) {
    console.error('[Shiprocket Webhook] Processing error:', err);
    return NextResponse.json(
      { message: 'Webhook processing failed', error: err.message },
      { status: 500 }
    );
  }
}
