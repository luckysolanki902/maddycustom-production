// Assistant order status utility: fetch through internal track API and derive a safe snapshot
import connectToDb from '@/lib/middleware/connectToDb';

function sanitizeOrderId(id) {
  if (typeof id !== 'string') return null;
  const s = id.trim();
  if (!/^[a-f0-9]{24}$/i.test(s)) return null; // basic ObjectId pattern
  return s;
}

function deriveSnapshot(details) {
  if (!details) return {};
  const orderWithTracking = Array.isArray(details.orders)
    ? details.orders.find(o => o?.status || (Array.isArray(o?.trackingSteps) && o.trackingSteps.length > 0) || o?.trackUrl)
    : null;
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
  })) : [];
  const itemsCount = details.itemsCount || (Array.isArray(details.items) ? details.items.reduce((n, it) => n + (it.quantity || 1), 0) : null);
  const itemsTotal = details.itemsTotal || null;

  return {
    status, trackUrl, trackingSteps, shipmentDate, expectedDelivery,
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

export async function getOrderStatus({ orderId }) {
  const safeId = sanitizeOrderId(orderId);
  if (!safeId) {
    return { ok: false, error: 'Invalid orderId. Please provide a valid 24-character ID.' };
  }
  await connectToDb(); // ensure DB ready in case track route touches DB

  try {
    console.log('[temp-debug] getOrderStatus fetching', orderId);
    const base = process.env.NEXT_PUBLIC_BASE_URL || '';
    const url = `${base}/api/order/track?orderId=${encodeURIComponent(safeId)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.log('[temp-debug] getOrderStatus non-OK', res.status, data?.message);
      return { ok: false, error: data?.message || 'Failed to fetch order status.' };
    }
    const details = data.trackingData || data || {};
    console.log('[temp-debug] getOrderStatus trackingData keys', Object.keys(details));
    const snap = deriveSnapshot(details);
    console.log('[temp-debug] getOrderStatus snapshot', { status: snap.status, trackUrl: !!snap.trackUrl, steps: Array.isArray(snap.trackingSteps) ? snap.trackingSteps.length : 0 });

    // Minimal, PII-safe payload
    return {
      ok: true,
      orderId: safeId,
      status: snap.status || 'Unknown',
      expectedDelivery: snap.expectedDelivery || null,
      trackUrl: snap.trackUrl || null,
      // Collapsed steps (latest 5)
      steps: Array.isArray(snap.trackingSteps) ? snap.trackingSteps.slice(-5) : [],
      customer: snap.customer || null,
      order: snap.order || null,
      // convenience fields for UI
      orderedAt: snap.order?.orderedAt || null,
      deliveryAddress: snap.customer?.address || null,
      contactName: snap.customer?.name || null,
      contactPhone: snap.customer?.phone || null,
      // A small helper line to present to users if needed
      summaryText: `${snap.status || 'Status unavailable'}${snap.expectedDelivery ? `, ETA ${snap.expectedDelivery}` : ''}${snap.trackUrl ? ` — Track: ${snap.trackUrl}` : ''}`.trim(),
    };
  } catch (e) {
    console.log('[temp-debug] getOrderStatus error', e?.message);
    return { ok: false, error: 'Network error while fetching order status.' };
  }
}

export default getOrderStatus;
