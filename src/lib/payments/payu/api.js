import { validatePayuCredentials, getPayuEndpoints } from './config';
import { formatPayuAmount, generatePayuRequestHash, generateVerifyPaymentHash } from './hash';

const toFormUrlEncoded = (params) => {
  const form = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    form.append(key, value);
  });
  return form;
};

export async function initiatePayuPayment(requestPayload) {
  const { key, salt } = validatePayuCredentials();
  const { payment: paymentUrl } = getPayuEndpoints();

  const amount = formatPayuAmount(requestPayload.amount);
  const payload = {
    key,
    txnid: requestPayload.txnid,
    amount,
    productinfo: requestPayload.productinfo,
    firstname: requestPayload.firstname,
    email: requestPayload.email,
    phone: requestPayload.phone,
    surl: requestPayload.surl,
    furl: requestPayload.furl,
    notifyurl: requestPayload.notifyurl,
    pg: requestPayload.pg,
    bankcode: requestPayload.bankcode,
    vpa: requestPayload.vpa,
    udf1: requestPayload.udf1,
    udf2: requestPayload.udf2,
    udf3: requestPayload.udf3,
    udf4: requestPayload.udf4,
    udf5: requestPayload.udf5,
    udf6: requestPayload.udf6,
    udf7: requestPayload.udf7,
    udf8: requestPayload.udf8,
    udf9: requestPayload.udf9,
    udf10: requestPayload.udf10,
    txn_s2s_flow: requestPayload.txn_s2s_flow,
    s2s_client_ip: requestPayload.s2s_client_ip,
    s2s_device_info: requestPayload.s2s_device_info,
  };

  payload.hash = generatePayuRequestHash(payload, salt);

  const body = toFormUrlEncoded(payload);
  const response = await fetch(paymentUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await response.text();
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: text,
  };
}

export async function verifyPayuPayments(txnIds) {
  const { key, salt } = validatePayuCredentials();
  const { verify: verifyUrl } = getPayuEndpoints();

  const command = 'verify_payment';
  const var1 = Array.isArray(txnIds) ? txnIds.join('|') : txnIds;
  const params = {
    key,
    command,
    var1,
    hash: generateVerifyPaymentHash({ key, command, var1 }, salt),
  };

  const body = toFormUrlEncoded(params);
  const response = await fetch(verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await response.text();
  return {
    status: response.status,
    body: text,
  };
}
