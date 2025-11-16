const PAYU_ENDPOINTS = {
  test: 'https://test.payu.in',
  prod: 'https://secure.payu.in',
};

export const PAYU_DEFAULT_SUCCESS_PATH = '/api/payments/payu/return/success';
export const PAYU_DEFAULT_FAILURE_PATH = '/api/payments/payu/return/failure';
export const PAYU_DEFAULT_NOTIFY_PATH = '/api/payments/payu/webhook';

const normalise = (value) => (typeof value === 'string' ? value.trim() : '');

const readFirstDefinedEnvValue = (...keys) => {
  for (const key of keys) {
    const candidate = normalise(process.env[key]);
    if (candidate) return candidate;
  }
  return '';
};

export function getPayuMode() {
  const envValue = normalise(process.env.PAYU_ENV || process.env.NEXT_PUBLIC_PAYU_ENV);
  if (['prod', 'production', 'live'].includes(envValue.toLowerCase())) {
    return 'prod';
  }
  return 'test';
}

export function getPayuBaseUrl() {
  const mode = getPayuMode();
  return PAYU_ENDPOINTS[mode];
}

export function getPayuCredentials() {
  return {
    key: readFirstDefinedEnvValue('PAYU_KEY', 'PAYU_API_KEY', 'NEXT_PUBLIC_PAYU_KEY', 'NEXT_PUBLIC_PAYU_API_KEY'),
    salt: readFirstDefinedEnvValue('PAYU_SALT', 'PAYU_API_SALT', 'NEXT_PUBLIC_PAYU_SALT', 'NEXT_PUBLIC_PAYU_API_SALT'),
  };
}

export function validatePayuCredentials() {
  const { key, salt } = getPayuCredentials();
  if (!key || !salt) {
    throw new Error(
      'Missing PayU credentials. Please set PAYU_KEY/PAYU_API_KEY and PAYU_SALT/PAYU_API_SALT (optionally NEXT_PUBLIC variants).'
    );
  }
  return { key, salt };
}

export function getPayuEndpoints() {
  const baseUrl = getPayuBaseUrl();
  const mode = getPayuMode();
  return {
    payment: `${baseUrl}/_payment`,
    verify:
      mode === 'prod'
        ? 'https://info.payu.in/merchant/postservice.php?form=2'
        : 'https://test.payu.in/merchant/postservice.php?form=2',
  };
}
