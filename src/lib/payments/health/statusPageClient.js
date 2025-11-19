const STATUSPAGE_CONFIG = {
  payu: {
    summaryUrl: 'https://status.payu.in/api/v2/summary.json',
    timeoutMs: 4500,
    modes: {
      upi: {
        componentKeywords: ['upi', 'upi intent', 'upi autopay'],
      },
    },
  },
  razorpay: {
    summaryUrl: 'https://status.razorpay.com/api/v2/summary.json',
    timeoutMs: 4500,
    modes: {
      upi: {
        componentKeywords: ['upi'],
      },
    },
  },
};

const DEFAULT_TTL_MS = 60 * 1000; // 1 minute cache to avoid hammering status pages
const DEFAULT_STATUS_IF_UNKNOWN = 'unknown';
const STATUS_SEVERITY = {
  none: 0,
  operational: 0,
  under_maintenance: 1,
  maintenance: 1,
  informational: 1,
  degraded_performance: 2,
  partial_outage: 3,
  major_outage: 4,
  critical: 5,
  unknown: 6,
};

const GLOBAL_CACHE_KEY = '__maddy_pg_status_cache__';
const healthCache = globalThis[GLOBAL_CACHE_KEY] || new Map();
if (!globalThis[GLOBAL_CACHE_KEY]) {
  globalThis[GLOBAL_CACHE_KEY] = healthCache;
}

const normalizeStatus = (status) => (typeof status === 'string' ? status.trim().toLowerCase() : DEFAULT_STATUS_IF_UNKNOWN);

const getSeverity = (status) => STATUS_SEVERITY[normalizeStatus(status)] ?? STATUS_SEVERITY[DEFAULT_STATUS_IF_UNKNOWN];

const pickMostSevere = (statuses) => {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return DEFAULT_STATUS_IF_UNKNOWN;
  }
  return statuses.reduce((worst, current) => (getSeverity(current) >= getSeverity(worst) ? normalizeStatus(current) : normalizeStatus(worst)), normalizeStatus(statuses[0]));
};

const filterComponentsByKeywords = (components, keywords) => {
  if (!Array.isArray(components) || !Array.isArray(keywords) || keywords.length === 0) {
    return [];
  }
  const normalizedKeywords = keywords.map((kw) => kw.trim().toLowerCase()).filter(Boolean);
  if (normalizedKeywords.length === 0) {
    return [];
  }
  return components.filter((component) => {
    const name = component?.name?.toLowerCase();
    if (!name) return false;
    return normalizedKeywords.some((kw) => name.includes(kw));
  });
};

const toSerializableComponent = (component) => ({
  id: component?.id || null,
  name: component?.name || null,
  status: normalizeStatus(component?.status),
  updatedAt: component?.updated_at || component?.updatedAt || null,
});

const buildHealthPayload = ({ providerId, mode, status, indicator, components = [], source, error }) => ({
  providerId,
  mode,
  status: normalizeStatus(status),
  indicator: normalizeStatus(indicator),
  components,
  source,
  checkedAt: new Date().toISOString(),
  ...(error ? { error: error.message || String(error) } : {}),
});

const fetchStatusSummary = async (url, timeoutMs) => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'MaddyCustom-PG-Orchestrator/1.0 (+status poller)',
      },
      cache: 'no-store',
      signal: controller ? controller.signal : undefined,
    });
    if (!response.ok) {
      throw new Error(`Statuspage responded with ${response.status}`);
    }
    return await response.json();
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const getCacheEntry = (key) => {
  const entry = healthCache.get(key);
  if (!entry) return null;
  const isFresh = Date.now() - entry.cachedAt < entry.ttlMs;
  return isFresh ? entry.payload : null;
};

const setCacheEntry = (key, payload, ttlMs) => {
  healthCache.set(key, {
    cachedAt: Date.now(),
    ttlMs,
    payload,
  });
};

export async function getProviderModeHealth(providerId, { mode = 'upi', ttlMs = DEFAULT_TTL_MS } = {}) {
  const normalizedProvider = typeof providerId === 'string' ? providerId.trim().toLowerCase() : '';
  const config = STATUSPAGE_CONFIG[normalizedProvider];
  const cacheKey = `${normalizedProvider || 'unknown'}:${mode}`;
  const cached = getCacheEntry(cacheKey);
  if (cached) {
    return cached;
  }

  if (!config) {
    const payload = buildHealthPayload({
      providerId,
      mode,
      status: DEFAULT_STATUS_IF_UNKNOWN,
      indicator: DEFAULT_STATUS_IF_UNKNOWN,
      source: 'unconfigured',
      error: new Error('Provider not configured for health polling'),
    });
    setCacheEntry(cacheKey, payload, ttlMs);
    return payload;
  }

  const modeConfig = config.modes?.[mode];
  try {
    const summary = await fetchStatusSummary(config.summaryUrl, config.timeoutMs || 4000);
    const components = filterComponentsByKeywords(summary?.components, modeConfig?.componentKeywords || []);
    const componentStatuses = components.length > 0 ? components.map((c) => c.status) : [summary?.status?.indicator];
    const status = pickMostSevere(componentStatuses);
    const payload = buildHealthPayload({
      providerId,
      mode,
      status,
      indicator: summary?.status?.indicator,
      components: components.slice(0, 5).map(toSerializableComponent),
      source: config.summaryUrl,
    });
    setCacheEntry(cacheKey, payload, ttlMs);
    return payload;
  } catch (error) {
    console.warn('[payments][health] Failed to fetch status summary', { providerId, mode, error: error?.message });
    const payload = buildHealthPayload({
      providerId,
      mode,
      status: DEFAULT_STATUS_IF_UNKNOWN,
      indicator: DEFAULT_STATUS_IF_UNKNOWN,
      components: [],
      source: config.summaryUrl,
      error,
    });
    setCacheEntry(cacheKey, payload, ttlMs);
    return payload;
  }
}

export const DOWNTIME_STATUSES = new Set(['degraded_performance', 'partial_outage', 'major_outage', 'critical']);

export const isDowntimeStatus = (status) => DOWNTIME_STATUSES.has(normalizeStatus(status));
