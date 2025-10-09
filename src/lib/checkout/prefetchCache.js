const NS = 'mc:checkoutPrefetch:';
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function readPrefetch(signature) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(NS + signature);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (!data.expiresAt || Date.now() > data.expiresAt) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function writePrefetch(signature, payload) {
  if (typeof window === 'undefined') return;
  try {
    const data = {
      version: 1,
      signature,
      createdAt: Date.now(),
      expiresAt: Date.now() + TTL_MS,
      ...payload,
    };
    localStorage.setItem(NS + signature, JSON.stringify(data));
    return data;
  } catch (e) {
    // ignore
  }
}

export function clearPrefetch(signature) {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(NS + signature); } catch {}
}

export function getTTL() { return TTL_MS; }
