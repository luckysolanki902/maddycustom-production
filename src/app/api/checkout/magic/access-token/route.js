/**
 * Shiprocket Magic Checkout Access Token API
 * POST /api/checkout/magic/access-token
 * 
 * Generates a Shiprocket access token for the checkout widget
 * and creates a session record for order reconciliation.
 */

import crypto from 'crypto';
import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import Option from '@/models/Option';
import MagicCheckoutSession from '@/models/MagicCheckoutSession';

const SHIPROCKET_CHECKOUT_BASE_URL = 'https://checkout-api.shiprocket.com';
const CLOUDFRONT_BASE_URL = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || 'https://d26w01jhwuuxpo.cloudfront.net';

/**
 * Ensure image URL is absolute with CloudFront base
 */
function ensureAbsoluteImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${CLOUDFRONT_BASE_URL}${url}`;
  return `${CLOUDFRONT_BASE_URL}/${url}`;
}

export async function POST(request) {
  let payload;
  
  try {
    // Parse JSON body
    try {
      payload = await request.json();
      console.log('[MagicCheckout] Received payload:', JSON.stringify(payload, null, 2));
    } catch (parseError) {
      console.error('[MagicCheckout] JSON parse error:', parseError);
      return NextResponse.json(
        { message: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    // Validate payload
    validatePayload(payload);

    const {
      cartSignature,
      items,
      totals,
      coupon,
      user,
      paymentMode,
      utm,
      analyticsContext,
      redirectUrl,
      fallbackUrl,
      metadata,
      origin,
    } = payload;

    // Connect to database
    try {
      await connectToDatabase();
    } catch (dbError) {
      console.error('[MagicCheckout] Database connection failed:', dbError);
      return NextResponse.json(
        { message: 'Database connection failed. Please try again.' },
        { status: 500 }
      );
    }

    // Normalize and validate items
    const normalizedItems = normalizeItems(items);
    
    // Hydrate products from database
    let productMap, optionMap;
    try {
      ({ productMap, optionMap } = await hydrateProducts(normalizedItems));
    } catch (hydrateError) {
      console.error('[MagicCheckout] Product hydration failed:', hydrateError);
      return NextResponse.json(
        { message: 'Failed to load product data. Please try again.' },
        { status: 500 }
      );
    }

    // Assemble items for Shiprocket API
    const assembledItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId.toString());
      if (!product) {
        throw new Error(`Product not found for id ${item.productId}`);
      }

      const option = item.optionId ? optionMap.get(item.optionId.toString()) : null;
      const variantNumericId = option?.uniqueNumericId || product.uniqueNumericId;
      
      if (!variantNumericId) {
        throw new Error(`Missing Shiprocket variant id for product ${product._id}`);
      }

      const unitPrice = resolvePrice(item.unitPrice, product.price);
      const mrp = resolvePrice(item.mrp, product.MRP || product.price);

      // Get best available image
      const imageCandidate = option?.images?.[0] || option?.thumbnail || product.images?.[0] || '';
      
      const catalogData = {
        price: Number(unitPrice.toFixed(2)),
        name: option?.optionDetails?.get?.('name') || product.title || product.name || 'Product',
        image_url: ensureAbsoluteImageUrl(imageCandidate),
      };

      return {
        payload: {
          variant_id: variantNumericId.toString(),
          quantity: item.quantity,
          catalog_data: catalogData,
        },
        session: {
          productId: product._id,
          optionId: option?._id || null,
          variantNumericId,
          quantity: item.quantity,
          unitPrice,
          mrp,
          sku: option?.sku || product.sku || '',
          name: catalogData.name,
          image: catalogData.image_url,
        },
      };
    });

    // Build Shiprocket request payload
    const shiprocketBody = buildShiprocketPayload({
      items: assembledItems.map((i) => i.payload),
      totals,
      coupon,
      redirectUrl,
      origin,
    });

    // Call Shiprocket API
    let shiprocketResponse;
    try {
      shiprocketResponse = await callShiprocketAPI(shiprocketBody);
    } catch (shiprocketError) {
      console.error('[MagicCheckout] Shiprocket API call failed:', shiprocketError);
      return NextResponse.json(
        { message: shiprocketError.message || 'Failed to connect to payment gateway. Please try again.' },
        { status: 502 }
      );
    }

    const {
      token,
      expires_at: tokenExpiresAt,
      data: shiprocketData = {},
    } = shiprocketResponse?.result || {};

    if (!token) {
      console.error('[MagicCheckout] Shiprocket response missing token:', shiprocketResponse);
      return NextResponse.json(
        { message: 'Payment gateway did not return a valid token. Please try again.' },
        { status: 502 }
      );
    }

    // Create session in database
    let session;
    try {
      session = await MagicCheckoutSession.create({
        cartSignature,
        token,
        tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : new Date(Date.now() + 15 * 60 * 1000),
        shiprocketOrderId: shiprocketData.order_id || '',
        shiprocketCartId: shiprocketData.cart_id || '',
        redirectUrl: shiprocketBody.redirect_url,
        fallbackUrl: fallbackUrl || null,
        totals: normalizeTotals(totals),
        coupon: normalizeCoupon(coupon),
        user: normalizeUser(user),
        paymentMode: normalizePaymentMode(paymentMode),
        utm: utm || {},
        metadata: metadata || {},
        analyticsContext: analyticsContext || {},
        cartItems: assembledItems.map((i) => i.session),
      });
    } catch (sessionError) {
      console.error('[MagicCheckout] Session creation failed:', sessionError);
      return NextResponse.json(
        { message: 'Failed to save checkout session. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      token,
      expiresAt: tokenExpiresAt,
      shiprocketOrderId: shiprocketData.order_id || null,
      shiprocketCartId: shiprocketData.cart_id || null,
      sessionId: session._id.toString(),
      fallbackUrl: fallbackUrl || shiprocketBody.fallback_url || undefined,
    });
  } catch (error) {
    console.error('[MagicCheckout] access-token failed', error);
    return NextResponse.json(
      { message: error?.message || 'Unable to initiate checkout' },
      { status: 400 }
    );
  }
}

/**
 * Validate incoming payload
 */
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid request body');
  }
  if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('Cart is empty');
  }
  if (!payload.totals) {
    throw new Error('Missing totals');
  }
  if (!payload.cartSignature) {
    throw new Error('Missing cart signature');
  }
}

/**
 * Normalize cart items
 */
function normalizeItems(items) {
  return items.map((item, index) => {
    const productId = item.productId || item.product;
    const optionId = item.optionId || item.option || null;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error(`Invalid product id at index ${index}`);
    }

    if (optionId && !mongoose.Types.ObjectId.isValid(optionId)) {
      throw new Error(`Invalid option id at index ${index}`);
    }

    const quantity = Number(item.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Invalid quantity for product ${productId}`);
    }

    const unitPrice = Number(item.price ?? item.unitPrice ?? item.priceAtPurchase ?? 0);
    const mrp = Number(item.mrp ?? unitPrice);

    return {
      productId: new mongoose.Types.ObjectId(productId),
      optionId: optionId ? new mongoose.Types.ObjectId(optionId) : null,
      quantity,
      unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
      mrp: Number.isFinite(mrp) && mrp >= 0 ? mrp : unitPrice,
    };
  });
}

/**
 * Fetch products and options from database
 */
async function hydrateProducts(items) {
  const productIds = [...new Set(items.map((i) => i.productId.toString()))];
  const optionIds = [...new Set(items.map((i) => i.optionId?.toString()).filter(Boolean))];

  const [productDocs, optionDocs] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).lean(),
    optionIds.length ? Option.find({ _id: { $in: optionIds } }).lean() : Promise.resolve([]),
  ]);

  const productMap = new Map();
  productDocs.forEach((doc) => {
    productMap.set(doc._id.toString(), doc);
  });

  const optionMap = new Map();
  optionDocs.forEach((doc) => {
    optionMap.set(doc._id.toString(), doc);
  });

  return { productMap, optionMap };
}

/**
 * Resolve price from candidate or fallback
 */
function resolvePrice(candidate, fallback) {
  if (Number.isFinite(candidate) && candidate >= 0) {
    return Number(candidate);
  }
  if (Number.isFinite(fallback) && fallback >= 0) {
    return Number(fallback);
  }
  return 0;
}

/**
 * Build Shiprocket API payload
 */
function buildShiprocketPayload({ items, totals, coupon, redirectUrl, origin }) {
  const merchantRedirect = resolveRedirectUrl(redirectUrl, origin);

  const subtotal = Number(totals?.subtotal ?? 0);
  const payable = Number(totals?.payable ?? totals?.total ?? subtotal);

  const payload = {
    cart_data: {
      items,
    },
    redirect_url: merchantRedirect,
    timestamp: new Date().toISOString(),
  };

  // Calculate subtotal from items if not provided
  if (!subtotal) {
    const inferredSubtotal = items.reduce(
      (acc, item) => acc + Number(item.catalog_data?.price || 0) * Number(item.quantity || 0),
      0
    );
    payload.cart_data.subtotal = Number(inferredSubtotal.toFixed(2));
  } else {
    payload.cart_data.subtotal = Number(payable.toFixed(2));
  }

  if (payable >= 0) {
    payload.cart_data.payable = Number(payable.toFixed(2));
  }

  return payload;
}

/**
 * Resolve redirect URL
 */
function resolveRedirectUrl(redirectUrl, origin) {
  if (redirectUrl && typeof redirectUrl === 'string' && redirectUrl.trim().length > 0) {
    return redirectUrl.trim();
  }
  
  const envUrl = process.env.NEXT_PUBLIC_MAGIC_CHECKOUT_REDIRECT_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (envUrl) {
    return `${envUrl.replace(/\/$/, '')}/checkout/magic/result`;
  }
  
  const fallbackOrigin = typeof origin === 'string' && origin ? origin : getDefaultOrigin();
  return `${fallbackOrigin}/checkout/magic/result`;
}

/**
 * Get default origin
 */
function getDefaultOrigin() {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '');
  }
  return 'https://www.maddycustom.com';
}

/**
 * Call Shiprocket API to get access token
 */
async function callShiprocketAPI(body) {
  const apiKey = process.env.SR_MAGIC_CHECKOUT_API_KEY;
  const apiSecret = process.env.SR_MAGIC_CHECKOUT_SECRET;
  const baseUrl = process.env.SR_MAGIC_CHECKOUT_BASE_URL || SHIPROCKET_CHECKOUT_BASE_URL;

  if (!apiKey || !apiSecret) {
    throw new Error('Shiprocket credentials are not configured');
  }

  const serialized = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', apiSecret).update(serialized).digest('base64');

  const response = await fetch(`${baseUrl}/api/v1/access-token/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'X-Api-HMAC-SHA256': signature,
    },
    body: serialized,
    cache: 'no-store',
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage = json?.error?.message || json?.message || `Shiprocket responded with ${response.status}`;
    throw new Error(errorMessage);
  }

  return json;
}

/**
 * Normalize totals object
 */
function normalizeTotals(totals) {
  const subtotal = Number(totals?.subtotal ?? 0);
  const discount = Number(totals?.discount ?? 0);
  const payable = Number(totals?.payable ?? totals?.total ?? subtotal - discount);
  return {
    subtotal: Number.isFinite(subtotal) ? subtotal : 0,
    discount: Number.isFinite(discount) && discount >= 0 ? discount : 0,
    payable: Number.isFinite(payable) && payable >= 0 ? payable : Math.max(0, subtotal - discount),
  };
}

/**
 * Normalize coupon object
 */
function normalizeCoupon(coupon) {
  if (!coupon || !coupon.code) return null;
  return {
    code: coupon.code,
    amount: Number.isFinite(coupon.amount) ? Number(coupon.amount) : 0,
    type: coupon.type || coupon.discountType || 'fixed',
  };
}

/**
 * Normalize user object
 */
function normalizeUser(user) {
  if (!user || !user.id) return null;
  const normalized = { ...user };
  if (user?.id && mongoose.Types.ObjectId.isValid(user.id)) {
    normalized.id = new mongoose.Types.ObjectId(user.id);
  } else {
    normalized.id = undefined;
  }
  return normalized;
}

/**
 * Normalize payment mode object
 */
function normalizePaymentMode(paymentMode) {
  if (!paymentMode || !paymentMode.id) return null;
  return {
    id: String(paymentMode.id || paymentMode._id),
    name: paymentMode.name || 'Unknown',
  };
}
