// Assistant order status utility: fetch through internal track API and derive a safe snapshot
import connectToDb from '@/lib/middleware/connectToDb';

function sanitizeOrderId(id) {
  if (typeof id !== 'string') return null;
  const s = id.trim();
  if (!/^[a-f0-9]{24}$/i.test(s)) return null; // basic ObjectId pattern
  return s;
}

function sanitizePhone(phone) {
  if (phone == null) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return null;
}

function deriveSnapshot(details) {
  if (!details) return {};
  
  // Handle multi-order case
  const hasMultipleOrders = details.isMultiOrder || (Array.isArray(details.orders) && details.orders.length > 1);
  
  // For multi-order, aggregate status from all orders
  let orderWithTracking = null;
  let linkedOrders = [];
  
  if (hasMultipleOrders && Array.isArray(details.orders)) {
    // Find the main order with tracking
    orderWithTracking = details.orders.find(o => o?.status || (Array.isArray(o?.trackingSteps) && o.trackingSteps.length > 0) || o?.trackUrl);
    linkedOrders = details.orders.map(o => ({
      orderId: o.orderId,
      status: o.status || 'Processing',
      trackUrl: o.trackUrl || null,
      expectedDelivery: o.expectedDelivery || null,
      shipmentDate: o.shipmentDate || null,
    }));
  } else {
    orderWithTracking = Array.isArray(details.orders)
      ? details.orders.find(o => o?.status || (Array.isArray(o?.trackingSteps) && o.trackingSteps.length > 0) || o?.trackUrl)
      : null;
  }
  
  const status = orderWithTracking?.status || details.status || null;
  const trackUrl = details.mainTrackUrl || orderWithTracking?.trackUrl || details.trackUrl || null;
  const trackingSteps = Array.isArray(orderWithTracking?.trackingSteps) ? orderWithTracking.trackingSteps : (details.trackingSteps || []);
  const shipmentDate = orderWithTracking?.shipmentDate || details.shipmentDate || null;
  const expectedDelivery = orderWithTracking?.expectedDelivery || details.expectedDelivery || null;
  
  // Unmasked details as requested
  const name = details.name || details.customerName || details.recipientName || null;
  const phone = details.phoneNumber || details.contactNumber || details.mobile || null;
  const email = details.email || details.contactEmail || null;
  const address = details.address || details.deliveryAddress || details.shippingAddress || null;
  const orderedAt = details.orderedAt || details.orderDate || details.createdAt || orderWithTracking?.orderDate || null;
  
  const items = Array.isArray(details.items) ? details.items.map(it => ({
    name: it.name,
    quantity: it.quantity,
    price: it.price,
    thumbnail: it.thumbnail || null,
  })) : [];
  const itemsCount = details.itemsCount || (Array.isArray(details.items) ? details.items.reduce((n, it) => n + (it.quantity || 1), 0) : null);
  const itemsTotal = details.itemsTotal || null;

  return {
    status, trackUrl, trackingSteps, shipmentDate, expectedDelivery,
    isMultiOrder: hasMultipleOrders,
    orderCount: details.orderCount || (hasMultipleOrders ? linkedOrders.length : 1),
    linkedOrders: hasMultipleOrders ? linkedOrders : [],
    customer: {
      name: name || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
    },
    order: {
      items,
      itemsCount,
      itemsTotal,
      orderedAt: orderedAt || null,
    }
  };
}

export async function getOrderStatus({ orderId, phone }) {
  const safeId = sanitizeOrderId(orderId);
  const safePhone = sanitizePhone(phone);
  if (!safeId && !safePhone) {
    return { ok: false, error: 'Provide a valid order ID or a 10-digit phone number.' };
  }
  if (!safeId && phone && !safePhone) {
    return { ok: false, error: 'Phone number must include at least 10 digits.' };
  }
  await connectToDb(); // ensure DB ready in case track route touches DB

  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || '';
    const params = new URLSearchParams();
    if (safeId) params.set('orderId', safeId);
    if (safePhone) params.set('phone', safePhone);
    const url = `${base}/api/order/track?${params.toString()}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    
    // Handle payment pending case
    if (data.paymentPending) {
      return { ok: false, paymentPending: true, error: 'No confirmed order found. The payment may not have been completed.' };
    }
    
    // Handle payment failed case
    if (data.paymentFailed) {
      const details = data.trackingData || {};
      return {
        ok: false,
        paymentFailed: true,
        error: 'Payment for this order failed.',
        orderId: details.orderId || safeId,
        orderedAt: details.createdAt || null,
        payment: details.payment || null,
        items: details.items || [],
        contactName: details.name || null,
        contactPhone: details.phoneNumber || null,
      };
    }
    
    if (!res.ok) {
      return { ok: false, error: data?.message || 'Failed to fetch order status.' };
    }
    const details = data.trackingData || data || {};
    const snap = deriveSnapshot(details);
    const lookup = details.lookup || (safeId ? { mode: 'orderId', value: safeId } : safePhone ? { mode: 'phone', value: safePhone } : null);
    const resolvedOrderId = details.orderId || snap.order?.orderId || safeId || null;

    // Minimal, PII-safe payload with linked orders support
    return {
      ok: true,
      orderId: resolvedOrderId,
      lookup,
      status: snap.status || 'Unknown',
      expectedDelivery: snap.expectedDelivery || null,
      trackUrl: snap.trackUrl || null,
      // Collapsed steps (latest 5)
      steps: Array.isArray(snap.trackingSteps) ? snap.trackingSteps.slice(-5) : [],
      customer: snap.customer || null,
      order: snap.order || null,
      // Payment info
      payment: details.payment || null,
      // Items
      items: details.items || snap.order?.items || [],
      // Linked orders (multiple shipments)
      isMultiOrder: snap.isMultiOrder || false,
      orderCount: snap.orderCount || 1,
      linkedOrders: snap.linkedOrders || [],
      // convenience fields for UI
      orderedAt: snap.order?.orderedAt || details.createdAt || null,
      deliveryAddress: snap.customer?.address || details.address || null,
      contactName: snap.customer?.name || details.name || null,
      contactPhone: snap.customer?.phone || details.phoneNumber || null,
      // A small helper line to present to users if needed
      summaryText: `${snap.status || 'Status unavailable'}${snap.expectedDelivery ? `, ETA ${snap.expectedDelivery}` : ''}${snap.trackUrl ? ` — Track: ${snap.trackUrl}` : ''}`.trim(),
    };
  } catch (e) {
    return { ok: false, error: 'Network error while fetching order status.' };
  }
}

export default getOrderStatus;
