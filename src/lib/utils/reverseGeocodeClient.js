// Client-side reverse geocoding via Nominatim with caching
// Note: Browsers block setting a custom User-Agent header; Nominatim accepts browser UA + Referer.
// IMPORTANT: Only autofill city, state, and pincode from Nominatim. All other fields are intentionally left blank
// so users can enter them manually.

const MEM_CACHE = new Map();
const LS_KEY = 'maddy_reverse_geo_cache_v1';

function loadLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLS(obj) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

function roundCoord(num, precision = 5) {
  const p = Math.pow(10, precision);
  return Math.round(num * p) / p;
}

export async function reverseGeocodeClient(lat, lng, { ttlMs = 12 * 60 * 60 * 1000, precision = 5 } = {}) {
  if (typeof window === 'undefined') {
    throw new Error('reverseGeocodeClient can only be used in the browser');
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const rLat = roundCoord(latNum, precision);
  const rLng = roundCoord(lngNum, precision);
  const key = `${rLat},${rLng}`;

  // In-memory cache first
  const memHit = MEM_CACHE.get(key);
  const now = Date.now();
  if (memHit && (now - memHit.ts) < ttlMs) {
    return memHit.payload;
  }

  // localStorage cache next
  const ls = loadLS();
  const lsHit = ls[key];
  if (lsHit && (now - lsHit.ts) < ttlMs) {
    MEM_CACHE.set(key, lsHit);
    return lsHit.payload;
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latNum)}&lon=${encodeURIComponent(lngNum)}&zoom=18&addressdetails=1`;

  const res = await fetch(url, {
    // Cannot set custom User-Agent in browser; Referer will be set by browser
    headers: {
      'Accept-Language': 'en-IN,en;q=0.9'
    }
  });
  if (!res.ok) throw new Error('Failed to reverse geocode');
  const data = await res.json();
  const a = data.address || {};

  // Only provide city, state, and pincode; everything else stays blank for manual input.
  const payload = {
    city: a.city || a.town || a.village || a.suburb || a.county || '',
    state: a.state || a.state_district || '',
    pincode: a.postcode || '',
    // Intentionally blank fields (do not autofill)
    areaLocality: '',
    road: '',
    houseNumber: '',
    poi: '',
  };

  const entry = { ts: now, payload };
  MEM_CACHE.set(key, entry);
  ls[key] = entry;
  saveLS(ls);

  return payload;
}

export default reverseGeocodeClient;
