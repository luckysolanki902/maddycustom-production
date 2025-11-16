export const PAYMENT_PROVIDERS = {
  RAZORPAY: 'razorpay',
  PAYU: 'payu',
};

const COERCE = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

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

/**
 * Returns the active payment gateway provider based on env flags. Defaults to Razorpay.
 * Supports legacy *_PROVIDER flags and the newer PAYMENT_GATEWAY / NEXT_PUBLIC_PAYMENT_GATEWAY names.
 */
export function getActivePaymentProvider() {
  const isServer = typeof window === 'undefined';
  const envValue = pickEnvValue(isServer);

  if (envValue === PAYMENT_PROVIDERS.PAYU) return PAYMENT_PROVIDERS.PAYU;
  return PAYMENT_PROVIDERS.RAZORPAY;
}

export const isPayuProvider = () => getActivePaymentProvider() === PAYMENT_PROVIDERS.PAYU;
export const isRazorpayProvider = () => getActivePaymentProvider() === PAYMENT_PROVIDERS.RAZORPAY;
