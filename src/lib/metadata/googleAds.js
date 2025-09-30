"use client";

// Lightweight GA4 + Google Ads event helpers
// Requires GA4/Ads script loaded (see GoogleAnalyticsGA4.js)

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'INR';

function safeNumber(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function toGaItems(items = []) {
  return (items || [])
    .map((item) => {
      const id = item?.productId
        || item?.product
        || item?.id
        || item?._id
        || item?.productDetails?._id
        || item?.content_id;
      const name = item?.name || item?.productDetails?.name || item?.title || '';
      const brand = item?.brand || item?.productDetails?.brand || undefined;
      const category = item?.category
        || item?.productDetails?.category?.name
        || item?.productDetails?.category
        || undefined;
      // Prefer explicit purchase price when available
      const price = item?.priceAtPurchase ?? item?.price ?? item?.item_price ?? item?.productDetails?.price;
      const quantity = item?.quantity ?? 1;
      if (!id) return null;
      return {
        item_id: String(id),
        item_name: String(name || ''),
        item_brand: brand ? String(brand) : undefined,
        item_category: category ? String(category) : undefined,
        price: safeNumber(price),
        quantity: safeNumber(quantity, 1),
      };
    })
    .filter(Boolean);
}

function gtagEvent(eventName, params = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    } else {
      // console.debug('[GA] gtag not ready for', eventName, params);
    }
  } catch (e) {
    // Swallow non-critical analytics errors
  }
}

// Begin checkout
export function gaBeginCheckout({ value, currency = DEFAULT_CURRENCY, items = [] } = {}) {
  const gaItems = toGaItems(items);
  gtagEvent('begin_checkout', {
    value: safeNumber(value),
    currency,
    items: gaItems,
  });
}

// Contact info step (mapped to add_billing_info)
export function gaAddBillingInfo({ value, currency = DEFAULT_CURRENCY, items = [], billing_tier, coupon } = {}) {
  const gaItems = toGaItems(items);
  gtagEvent('add_billing_info', {
    value: safeNumber(value),
    currency,
    items: gaItems,
    billing_tier,
    coupon,
  });
}

// Payment initiation (mapped to add_payment_info)
export function gaAddPaymentInfo({ value, currency = DEFAULT_CURRENCY, items = [], payment_type, coupon } = {}) {
  const gaItems = toGaItems(items);
  gtagEvent('add_payment_info', {
    value: safeNumber(value),
    currency,
    items: gaItems,
    payment_type,
    coupon,
  });
}

// Purchase
export function gaPurchase({ transaction_id, value, currency = DEFAULT_CURRENCY, items = [], shipping = 0, tax = 0, coupon } = {}) {
  const gaItems = toGaItems(items);
  gtagEvent('purchase', {
    transaction_id: String(transaction_id || ''),
    value: safeNumber(value),
    currency,
    items: gaItems,
    shipping: safeNumber(shipping),
    tax: safeNumber(tax),
    coupon,
  });
}

// Optional: lead and search to mirror Meta events (can be used later)
export function gaGenerateLead({ value = 1, currency = DEFAULT_CURRENCY, lead_type, content_category } = {}) {
  gtagEvent('generate_lead', {
    value: safeNumber(value, 1),
    currency,
    lead_type,
    content_category,
  });
}

export function gaSearch({ search_term, value, currency = DEFAULT_CURRENCY, items = [] } = {}) {
  const gaItems = toGaItems(items);
  gtagEvent('search', {
    search_term: String(search_term || ''),
    value: value !== undefined ? safeNumber(value) : undefined,
    currency,
    items: gaItems.length ? gaItems : undefined,
  });
}

// View item (product detail)
export function gaViewItem({ value, currency = DEFAULT_CURRENCY, items = [] } = {}) {
  const gaItems = toGaItems(items);
  gtagEvent('view_item', {
    value: value !== undefined ? safeNumber(value) : undefined,
    currency,
    items: gaItems,
  });
}

// Add to cart
export function gaAddToCart({ value, currency = DEFAULT_CURRENCY, items = [] } = {}) {
  const gaItems = toGaItems(items);
  gtagEvent('add_to_cart', {
    value: value !== undefined ? safeNumber(value) : undefined,
    currency,
    items: gaItems,
  });
}

// Add to wishlist (optional)
export function gaAddToWishlist({ value, currency = DEFAULT_CURRENCY, items = [] } = {}) {
  const gaItems = toGaItems(items);
  gtagEvent('add_to_wishlist', {
    value: value !== undefined ? safeNumber(value) : undefined,
    currency,
    items: gaItems,
  });
}

const googleAds = {
  gaBeginCheckout,
  gaAddBillingInfo,
  gaAddPaymentInfo,
  gaPurchase,
  gaGenerateLead,
  gaSearch,
  gaViewItem,
  gaAddToCart,
  gaAddToWishlist,
};

export default googleAds;
