import { getProviderModeHealth, isDowntimeStatus } from '@/lib/payments/health/statusPageClient';

export const PAYMENT_PROVIDERS = {
  RAZORPAY: 'razorpay',
  PAYU: 'payu',
};

const FALLBACK_PROVIDER = {
  [PAYMENT_PROVIDERS.PAYU]: PAYMENT_PROVIDERS.RAZORPAY,
  [PAYMENT_PROVIDERS.RAZORPAY]: PAYMENT_PROVIDERS.PAYU,
};

const COERCE = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const TRUE_SET = new Set(['1', 'true', 'yes', 'on']);
const FALSE_SET = new Set(['0', 'false', 'no', 'off']);

const pickEnvValue = (isServer) => {
  const serverCandidates = [
    process.env.PAYMENT_GATEWAY_PROVIDER,
    process.env.PAYMENT_GATEWAY,
    process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_PROVIDER,
    process.env.NEXT_PUBLIC_PAYMENT_GATEWAY,
  ];

  const clientCandidates = [
    process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_PROVIDER,
    process.env.NEXT_PUBLIC_PAYMENT_GATEWAY,
  ];

  const candidates = isServer ? serverCandidates : clientCandidates;
  for (const candidate of candidates) {
    const coerced = COERCE(candidate);
    if (coerced) return coerced;
  }
  return '';
};

export const getEnvPreferredPaymentProvider = () => {
  const isServer = typeof window === 'undefined';
  const envValue = pickEnvValue(isServer);
  if (envValue === PAYMENT_PROVIDERS.PAYU) {
    return PAYMENT_PROVIDERS.PAYU;
  }
  if (envValue === PAYMENT_PROVIDERS.RAZORPAY) {
    return PAYMENT_PROVIDERS.RAZORPAY;
  }
  return PAYMENT_PROVIDERS.RAZORPAY;
};

const boolFromEnvCandidates = (candidates, defaultValue = true) => {
  for (const candidate of candidates) {
    const coerced = COERCE(candidate);
    if (!coerced) continue;
    if (TRUE_SET.has(coerced)) return true;
    if (FALSE_SET.has(coerced)) return false;
  }
  return defaultValue;
};

export const isPaymentOrchestrationEnabled = () => {
  const serverCandidates = [
    process.env.PAYMENT_GATEWAY_ORCHESTRATION_ENABLED,
    process.env.PAYMENT_ORCHESTRATION_ENABLED,
    process.env.ENABLE_PAYMENT_ORCHESTRATION,
  ];

  const clientCandidates = [
    process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_ORCHESTRATION_ENABLED,
    process.env.NEXT_PUBLIC_PAYMENT_ORCHESTRATION_ENABLED,
  ];

  const isServer = typeof window === 'undefined';
  return boolFromEnvCandidates(isServer ? serverCandidates : clientCandidates, true);
};

export async function decidePaymentProvider({ mode = 'upi', allowDowntimeOverride, ttlMs } = {}) {
  const preferredProvider = getEnvPreferredPaymentProvider();
  const orchestrationEnabled = typeof allowDowntimeOverride === 'boolean'
    ? allowDowntimeOverride
    : isPaymentOrchestrationEnabled();
  const decisionMeta = {
    preferredProvider,
    recommendedProvider: preferredProvider,
    reason: 'env_preference',
    allowDowntimeOverride: orchestrationEnabled,
    inspectedProviders: {},
    mode,
  };

  if (!orchestrationEnabled) {
    decisionMeta.reason = 'downtime_override_disabled';
    return { provider: preferredProvider, meta: decisionMeta };
  }

  const preferredHealth = await getProviderModeHealth(preferredProvider, { mode, ttlMs });
  decisionMeta.inspectedProviders[preferredProvider] = preferredHealth;

  if (!isDowntimeStatus(preferredHealth.status)) {
    decisionMeta.reason = 'preferred_provider_healthy';
    return { provider: preferredProvider, meta: decisionMeta };
  }

  const fallbackProvider = FALLBACK_PROVIDER[preferredProvider] || PAYMENT_PROVIDERS.RAZORPAY;
  const fallbackHealth = await getProviderModeHealth(fallbackProvider, { mode, ttlMs });
  decisionMeta.inspectedProviders[fallbackProvider] = fallbackHealth;

  if (!isDowntimeStatus(fallbackHealth.status)) {
    decisionMeta.reason = 'fallback_provider_selected';
    decisionMeta.recommendedProvider = fallbackProvider;
    decisionMeta.override = true;
    console.warn('[payments][providers] Downtime override engaged', {
      preferredProvider,
      fallbackProvider,
      preferredStatus: preferredHealth.status,
      fallbackStatus: fallbackHealth.status,
    });
    return { provider: fallbackProvider, meta: decisionMeta };
  }

  decisionMeta.reason = 'no_healthy_provider_available';
  return { provider: preferredProvider, meta: decisionMeta };
}

export async function getActivePaymentProvider(options = {}) {
  const { provider } = await decidePaymentProvider(options);
  return provider;
}
