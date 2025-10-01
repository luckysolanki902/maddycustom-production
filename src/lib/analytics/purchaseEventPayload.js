export function buildPurchaseEventPayload({
  orderId,
  totalValue,
  currency = 'INR',
  couponCode,
  cartSummary,
  items = [],
  paymentMode,
  paymentStatus,
  amountDueOnline,
  amountPaidOnline,
  amountDueCod,
  totalDiscount,
  metadata = {},
}) {
  const normalizedOrderId = normalizeOrderId(orderId);
  if (!normalizedOrderId) {
    return null;
  }

  const cart = buildCartSummary(cartSummary, totalValue, items, currency);
  const sanitizedItems = sanitizeItems(items);
  const enrichedMetadata = buildMetadata({
    metadata,
    couponCode,
    paymentMode,
    paymentStatus,
    amountDueOnline,
    amountPaidOnline,
    amountDueCod,
    totalDiscount,
    items: sanitizedItems,
  });

  const payload = {
    eventId: `purchase:${normalizedOrderId}`,
    dedupeKey: `purchase:${normalizedOrderId}`,
    order: buildOrderBlock(normalizedOrderId, totalValue, currency, couponCode),
  };

  if (cart) {
    payload.cart = cart;
  }

  if (enrichedMetadata) {
    payload.metadata = enrichedMetadata;
  }

  return payload;
}

function normalizeOrderId(orderId) {
  if (!orderId) return null;
  if (typeof orderId === 'string') {
    const trimmed = orderId.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof orderId === 'object' && typeof orderId.toString === 'function') {
    return normalizeOrderId(orderId.toString());
  }
  const numeric = Number(orderId);
  if (Number.isFinite(numeric)) {
    return String(orderId);
  }
  return null;
}

function buildOrderBlock(orderId, totalValue, currency, couponCode) {
  const value = toFiniteNumber(totalValue);
  const order = {
    orderId,
  };

  if (value !== undefined) {
    order.value = value;
    order.currency = currency || 'INR';
  }

  if (couponCode && typeof couponCode === 'string' && couponCode.trim().length > 0) {
    order.coupon = couponCode.trim();
  }

  return order;
}

function buildCartSummary(cartSummary, totalValue, items, fallbackCurrency) {
  const summary = {};

  if (cartSummary && typeof cartSummary === 'object') {
    const snapshot = { ...cartSummary };
    if (snapshot.items !== undefined) {
      const count = toFiniteNumber(snapshot.items);
      if (count !== undefined) {
        summary.items = count;
      }
    }
    if (snapshot.value !== undefined) {
      const value = toFiniteNumber(snapshot.value);
      if (value !== undefined) {
        summary.value = value;
      }
    }
    if (typeof snapshot.currency === 'string' && snapshot.currency.trim().length > 0) {
      summary.currency = snapshot.currency.trim();
    }
  }

  if (summary.items === undefined && Array.isArray(items) && items.length > 0) {
    const computedItems = items.reduce((acc, item) => acc + (toFiniteNumber(item.quantity) || 0), 0);
    if (computedItems > 0) {
      summary.items = computedItems;
    }
  }

  if (summary.value === undefined) {
    const value = toFiniteNumber(totalValue);
    if (value !== undefined) {
      summary.value = value;
    }
  }

  if (!summary.currency) {
    summary.currency = fallbackCurrency || 'INR';
  }

  if (Object.keys(summary).length === 0) {
    return undefined;
  }

  return summary;
}

function sanitizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return undefined;
  }

  const sanitized = items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const productId = extractProductId(item);
      const quantity = toFiniteNumber(item.quantity);
      const price = toFiniteNumber(item.price ?? item.priceAtPurchase);
      const entry = {};

      if (productId) {
        entry.productId = productId;
      }
      if (item.name && typeof item.name === 'string') {
        entry.name = item.name;
      }
      if (quantity !== undefined) {
        entry.quantity = quantity;
      }
      if (price !== undefined) {
        entry.price = price;
      }
      if (item.sku && typeof item.sku === 'string') {
        entry.sku = item.sku;
      }
      if (item.orderId) {
        entry.orderId = normalizeOrderId(item.orderId) || undefined;
      }

      const hasData = Object.values(entry).some((value) => value !== undefined && value !== null);
      return hasData ? entry : null;
    })
    .filter(Boolean);

  return sanitized.length > 0 ? sanitized : undefined;
}

function extractProductId(item) {
  if (item.productId) {
    return normalizeOrderId(item.productId) || item.productId;
  }
  if (item.product && typeof item.product === 'object') {
    if (typeof item.product._id === 'object' && typeof item.product._id.toString === 'function') {
      return item.product._id.toString();
    }
    if (typeof item.product._id === 'string') {
      return item.product._id;
    }
  }
  if (typeof item.product === 'string') {
    return item.product;
  }
  return undefined;
}

function buildMetadata({
  metadata,
  couponCode,
  paymentMode,
  paymentStatus,
  amountDueOnline,
  amountPaidOnline,
  amountDueCod,
  totalDiscount,
  items,
}) {
  const base = { ...(metadata || {}) };

  if (couponCode && typeof couponCode === 'string' && couponCode.trim().length > 0 && !base.couponCode) {
    base.couponCode = couponCode.trim();
  }

  if (paymentMode && typeof paymentMode === 'string') {
    base.paymentMode = paymentMode;
  }

  if (paymentStatus && typeof paymentStatus === 'string') {
    base.paymentStatus = paymentStatus;
  }

  const paidOnline = toFiniteNumber(amountPaidOnline);
  if (paidOnline !== undefined) {
    base.amountPaidOnline = paidOnline;
  }

  const dueOnline = toFiniteNumber(amountDueOnline);
  if (dueOnline !== undefined) {
    base.amountDueOnline = dueOnline;
  }

  const dueCod = toFiniteNumber(amountDueCod);
  if (dueCod !== undefined) {
    base.amountDueCod = dueCod;
  }

  const discount = toFiniteNumber(totalDiscount);
  if (discount !== undefined) {
    base.totalDiscount = discount;
  }

  if (items) {
    base.items = items;
  }

  const cleaned = pruneObject(base);
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function pruneObject(obj) {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }
    if (typeof value === 'string' && value.trim().length === 0) {
      return acc;
    }
    if (Array.isArray(value)) {
      const cleanedArray = value.filter((item) => item !== undefined && item !== null);
      if (cleanedArray.length === 0) {
        return acc;
      }
      acc[key] = cleanedArray;
      return acc;
    }
    if (typeof value === 'object') {
      const cleanedObject = pruneObject(value);
      if (Object.keys(cleanedObject).length === 0) {
        return acc;
      }
      acc[key] = cleanedObject;
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
}

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const numeric = Number(value.trim());
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
}
