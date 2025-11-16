import { validatePayuCredentials, getPayuEndpoints, PAYU_DEFAULT_FAILURE_PATH, PAYU_DEFAULT_NOTIFY_PATH, PAYU_DEFAULT_SUCCESS_PATH } from './config';
import { formatPayuAmount, generatePayuRequestHash } from './hash';

const buildUrls = ({ request, overrides }) => {
  if (overrides?.surl && overrides?.furl && overrides?.notifyurl) return overrides;

  const baseUrl = request?.headers?.get('origin') || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
  return {
    surl: overrides?.surl || `${baseUrl}${PAYU_DEFAULT_SUCCESS_PATH}`,
    furl: overrides?.furl || `${baseUrl}${PAYU_DEFAULT_FAILURE_PATH}`,
    notifyurl: overrides?.notifyurl || `${baseUrl}${PAYU_DEFAULT_NOTIFY_PATH}`,
  };
};

export function buildPayuFormPayload({
  txnid,
  amount,
  productinfo,
  customer,
  request,
  urls,
  paymentConfig,
  udf,
}) {
  const { key, salt } = validatePayuCredentials();
  const { payment: actionUrl } = getPayuEndpoints();

  const computedUrls = buildUrls({ request, overrides: urls });

  const payload = {
    key,
    txnid,
    amount: formatPayuAmount(amount),
    productinfo: productinfo || 'Order Payment',
    firstname: customer?.firstname || customer?.name || 'Customer',
    email: customer?.email || 'noemail@maddycustom.com',
    phone: customer?.phone,
    surl: computedUrls.surl,
    furl: computedUrls.furl,
    notifyurl: computedUrls.notifyurl,
    pg: paymentConfig?.pg,
    bankcode: paymentConfig?.bankcode,
    vpa: paymentConfig?.vpa,
    txn_s2s_flow: paymentConfig?.txn_s2s_flow,
    s2s_client_ip: paymentConfig?.s2s_client_ip,
    s2s_device_info: paymentConfig?.s2s_device_info,
    enforce_paymethod: paymentConfig?.enforce_paymethod,
    payment_source: paymentConfig?.payment_source,
    intent_result: paymentConfig?.intent_result,
    ...udf,
  };

  payload.hash = generatePayuRequestHash(payload, salt);

  return {
    actionUrl,
    fields: payload,
  };
}
