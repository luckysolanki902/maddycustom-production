export function buildCartSignature(cartItems = [], couponCode = '') {
  try {
    const normalized = (cartItems || []).map(i => ({
      productId: i.productId || i.productDetails?._id,
      optionId: i.productDetails?.selectedOption?._id || null,
      quantity: i.quantity || 0,
    }))
    .filter(x => x.productId)
    .sort((a, b) => {
      if (a.productId === b.productId) {
        if ((a.optionId || '') < (b.optionId || '')) return -1;
        if ((a.optionId || '') > (b.optionId || '')) return 1;
        return a.quantity - b.quantity;
      }
      return a.productId < b.productId ? -1 : 1;
    });

    const payload = { items: normalized, couponCode: couponCode || '' };
    const json = JSON.stringify(payload);
    // Simple hash for speed (not cryptographic). Collisions are highly unlikely here.
    let hash = 2166136261;
    for (let i = 0; i < json.length; i++) {
      hash ^= json.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return `sig_${(hash >>> 0).toString(36)}`;
  } catch (e) {
    console.error('buildCartSignature failed', e);
    return `sig_fallback_${Date.now()}`;
  }
}
