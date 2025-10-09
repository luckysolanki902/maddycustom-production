'use client';
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { buildCartSignature } from '@/lib/checkout/cartSignature';
import { readPrefetch, writePrefetch, getTTL } from '@/lib/checkout/prefetchCache';
import { setInventoryGate } from '@/store/slices/cartSlice';
import { prefetchStart, prefetchPartial, prefetchReady, prefetchFailed } from '@/store/slices/checkoutPrefetchSlice';

// Module-scoped timers to avoid multiple overlapping refreshes
const refreshTimers = new Map(); // signature -> timeoutId
const retryAttempts = new Map(); // signature -> count

export default function useCheckoutPrefetch() {
  const dispatch = useDispatch();
  const cartItems = useSelector(s => s.cart.items);
  const couponCode = useSelector(s => s.orderForm?.couponApplied?.couponCode);
  const status = useSelector(s => s.checkoutPrefetch.status);
  const signatureInState = useSelector(s => s.checkoutPrefetch.signature);

  const startPrefetch = useCallback(async ({ coupon } = {}) => {
    const sig = buildCartSignature(cartItems, coupon ?? couponCode);

    // If cache warm: use it and optionally refresh in background
    const cached = readPrefetch(sig);
    dispatch(prefetchStart({ signature: sig }));
    if (cached) {
      // Reflect inventoryGate so UI totals align
      const inv = cached.inventory || {};
      dispatch(setInventoryGate({
        excludedKeys: inv.excludedKeys || [],
        itemsInfo: inv.itemsInfo || {},
        expiresAt: cached.expiresAt,
        cartSignature: sig,
      }));
      dispatch(prefetchReady({ signature: sig }));
      // Schedule a refresh shortly before TTL to keep data fresh
      // Clear any stale timers for previous signatures to avoid leaks
      clearOtherRefreshTimers(sig);
      scheduleRefresh(sig, cached.expiresAt, () => startPrefetch({ coupon: coupon ?? couponCode }));
      return { signature: sig, cached: true };
    }

    try {
      const [invRes, pmRes, coupRes] = await Promise.all([
        axios.post('/api/checkout/inventory/verify', {
          items: cartItems.map(i => ({
            productId: i.productId || i.productDetails?._id,
            optionId: i.productDetails?.selectedOption?._id || null,
            quantity: i.quantity,
          })),
          reserve: false,
        }),
        axios.get('/api/checkout/modeofpayments'),
        (coupon ?? couponCode) ? axios.post('/api/checkout/coupons/apply', {
          code: coupon ?? couponCode,
          totalCost: cartItems.reduce((s, i) => s + (i.price ?? i.productDetails.price) * i.quantity, 0),
          isFirstOrder: false,
          cartItems: cartItems.map(i => ({
            productId: i.productId || i.productDetails?._id,
            quantity: i.quantity,
            price: i.price ?? i.productDetails.price,
          })),
        }) : Promise.resolve({ data: null })
      ]);

      const inventory = {
        excludedKeys: invRes.data?.excludedKeys || [],
        itemsInfo: invRes.data?.itemsInfo || {},
        expiresAt: Date.now() + getTTL(),
      };
      const paymentModes = { list: pmRes.data?.data || [], default: (pmRes.data?.data || [])[0]?.name || 'online' };
      const couponData = coupRes.data ? {
        code: coupRes.data?.offer?.couponCodes?.[0] || (coupon ?? couponCode) || '',
        valid: !!coupRes.data?.valid,
        discountType: coupRes.data?.discountType,
        discountValue: coupRes.data?.discountValue || 0,
        message: coupRes.data?.message || '',
      } : null;

      const payload = { inventory, paymentModes, coupon: couponData };
      const stored = writePrefetch(sig, payload);

      // Reflect inventory in redux for totals
      dispatch(setInventoryGate({
        excludedKeys: inventory.excludedKeys,
        itemsInfo: inventory.itemsInfo,
        expiresAt: stored.expiresAt,
        cartSignature: sig,
      }));

      dispatch(prefetchReady({ signature: sig }));
      // Reset retry attempts upon success
      retryAttempts.delete(sig);
      clearOtherRefreshTimers(sig);
      scheduleRefresh(sig, stored.expiresAt, () => startPrefetch({ coupon: coupon ?? couponCode }));
      return { signature: sig };
    } catch (e) {
      console.error('Checkout prefetch failed', e);
      dispatch(prefetchFailed({ signature: sig, errors: { message: e?.message || 'failed' } }));
      // Simple capped retry with backoff
      const count = (retryAttempts.get(sig) || 0) + 1;
      retryAttempts.set(sig, count);
      if (count <= 3) {
        const delay = 1000 * count; // 1s, 2s, 3s
        setTimeout(() => {
          // Only retry if signature didn't change
          const currentSig = buildCartSignature(cartItems, coupon ?? couponCode);
          if (currentSig === sig) {
            dispatch(prefetchStart({ signature: sig }));
            startPrefetch({ coupon: coupon ?? couponCode });
          }
        }, delay);
      }
      return { signature: sig, error: e };
    }
  }, [cartItems, couponCode, dispatch]);

  return { startPrefetch, status, signature: signatureInState };
}

function scheduleRefresh(signature, expiresAt, refresher) {
  if (typeof window === 'undefined') return;
  if (!expiresAt) return;
  const lead = 5000; // refresh 5s before expiry
  const delay = Math.max(0, expiresAt - Date.now() - lead);
  if (refreshTimers.has(signature)) {
    clearTimeout(refreshTimers.get(signature));
  }
  const id = setTimeout(() => {
    try { refresher && refresher(); } finally {
      refreshTimers.delete(signature);
    }
  }, delay);
  refreshTimers.set(signature, id);
}

function clearOtherRefreshTimers(currentSig) {
  try {
    for (const [sig, id] of refreshTimers.entries()) {
      if (sig !== currentSig) {
        clearTimeout(id);
        refreshTimers.delete(sig);
      }
    }
  } catch {
    // no-op
  }
}
