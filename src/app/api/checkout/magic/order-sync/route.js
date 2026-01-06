/**
 * Shiprocket Magic Checkout Order Sync API
 * POST /api/checkout/magic/order-sync
 * 
 * Syncs order status after checkout completion.
 * Called from the result page to update session status.
 */

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import MagicCheckoutSession from '@/models/MagicCheckoutSession';

export async function POST(request) {
  try {
    const body = await request.json();
    const { sessionId, shiprocketOrderId } = body || {};

    if (!sessionId && !shiprocketOrderId) {
      return NextResponse.json(
        { message: 'sessionId or shiprocketOrderId required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find session by sessionId or shiprocketOrderId
    const query = sessionId ? { _id: sessionId } : { shiprocketOrderId };
    const session = await MagicCheckoutSession.findOne(query);

    if (!session) {
      return NextResponse.json(
        { message: 'Magic checkout session not found' },
        { status: 404 }
      );
    }

    // Update shiprocketOrderId if provided and missing on the session
    if (shiprocketOrderId && (!session.shiprocketOrderId || session.shiprocketOrderId !== shiprocketOrderId)) {
      session.shiprocketOrderId = shiprocketOrderId;
    }

    // Mark session as completed
    session.status = 'completed';
    await session.save();

    // Return safe representation
    const safe = {
      id: session._id.toString(),
      cartSignature: session.cartSignature,
      shiprocketOrderId: session.shiprocketOrderId || null,
      shiprocketCartId: session.shiprocketCartId || null,
      fastrrOrderId: session.fastrrOrderId || null,
      status: session.status,
      totals: session.totals || {},
      coupon: session.coupon || {},
      user: session.user || {},
      paymentMode: session.paymentMode || {},
      createdAt: session.createdAt,
    };

    return NextResponse.json({ session: safe });
  } catch (err) {
    console.error('[MagicCheckout] order-sync failed', err);
    return NextResponse.json(
      { message: err?.message || 'order-sync failed' },
      { status: 500 }
    );
  }
}
