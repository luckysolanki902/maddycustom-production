import { getFacebookTrackingParamsAsync } from '@/lib/utils/cookies';

export const captureClientTrackingData = async () => {
  const { fbp, fbc } = await getFacebookTrackingParamsAsync();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  
  return {
    fbp,
    fbc,
    userAgent,
  };
};
