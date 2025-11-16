export const DEFAULT_PAYU_METHOD = 'card';

export const PAYU_PAYMENT_METHODS = [
  {
    id: 'upi',
    title: 'UPI Apps',
    description: 'Works with Google Pay, PhonePe, BHIM, Paytm and more.',
    accent: '#018749',
    badge: 'Fastest',
  },
  {
    id: 'card',
    title: 'Debit / Credit Card',
    description: 'Redirects to PayU\'s secure card page with saved EMI support.',
    accent: '#1A4AE6',
    badge: 'Recommended',
  },
  {
    id: 'netbanking',
    title: 'Netbanking',
    description: 'Log in to your bank and approve the payment inside PayU.',
    accent: '#F39C12',
    badge: null,
  },
];

export const PAYU_NETBANKING_BANKS = [
  { code: 'HDFC', name: 'HDFC Bank' },
  { code: 'ICIB', name: 'ICICI Bank' },
  { code: 'SBIB', name: 'State Bank of India' },
  { code: 'UTI', name: 'Axis Bank' },
  { code: 'KKBK', name: 'Kotak Mahindra Bank' },
  { code: 'YESB', name: 'Yes Bank' },
];

export const PAYU_DEFAULT_NETBANKING_CODE = PAYU_NETBANKING_BANKS[0]?.code || '';

export const PAYU_SUCCESS_STATUSES = ['success', 'captured'];
export const PAYU_FAILURE_STATUSES = ['failure', 'failed', 'cancelled', 'dropped', 'bounced'];
