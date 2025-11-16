import crypto from 'crypto';

const UDF_FIELDS = ['udf1', 'udf2', 'udf3', 'udf4', 'udf5', 'udf6', 'udf7', 'udf8', 'udf9', 'udf10'];

const normaliseValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number(value).toString();
  return String(value).trim();
};

const sha512 = (payload) => crypto.createHash('sha512').update(payload).digest('hex');

export function formatPayuAmount(amount) {
  const numeric = typeof amount === 'number' ? amount : parseFloat(amount);
  if (Number.isNaN(numeric)) {
    throw new Error(`Invalid amount received for PayU request: ${amount}`);
  }
  return numeric.toFixed(2);
}

export function generatePayuRequestHash({
  key,
  txnid,
  amount,
  productinfo,
  firstname,
  email,
  ...udfValues
}, salt) {
  const sequence = [key, txnid, formatPayuAmount(amount), productinfo, firstname, email];
  UDF_FIELDS.forEach((udfKey) => {
    sequence.push(normaliseValue(udfValues[udfKey]));
  });
  const payload = `${sequence.map(normaliseValue).join('|')}|${salt}`;
  return sha512(payload);
}

export function generateVerifyPaymentHash({ key, command, var1 }, salt) {
  const payload = `${normaliseValue(key)}|${normaliseValue(command)}|${normaliseValue(var1)}|${normaliseValue(salt)}`;
  return sha512(payload);
}

export function generateReverseResponseHash(responsePayload, salt) {
  const {
    status,
    additionalCharges = '',
    udf1 = '',
    udf2 = '',
    udf3 = '',
    udf4 = '',
    udf5 = '',
    udf6 = '',
    udf7 = '',
    udf8 = '',
    udf9 = '',
    udf10 = '',
    email = '',
    firstname = '',
    productinfo = '',
    amount = '',
    txnid = '',
    key = '',
  } = responsePayload;

  const baseSequence = [
    salt,
    status,
    udf10,
    udf9,
    udf8,
    udf7,
    udf6,
    udf5,
    udf4,
    udf3,
    udf2,
    udf1,
    email,
    firstname,
    productinfo,
    amount,
    txnid,
    key,
  ];

  const sequence = additionalCharges
    ? [additionalCharges, ...baseSequence]
    : baseSequence;

  const normalizedParts = sequence.map(normaliseValue);
  return sha512(normalizedParts.join('|'));
}

const PAYU_LOG_HASH_MISMATCH = process.env.PAYU_LOG_HASH_MISMATCH === 'true';

export function verifyReverseHash(responsePayload, salt) {
  if (!responsePayload?.hash) return false;
  const recomputed = generateReverseResponseHash(responsePayload, salt);
  const matches = recomputed === responsePayload.hash;

  if (!matches && PAYU_LOG_HASH_MISMATCH) {
    const txnId = responsePayload.txnid || responsePayload.TXNID || 'unknown';
    console.error('[PayU webhook] Hash mismatch detected', {
      txnId,
      expectedHashPrefix: recomputed.slice(0, 12),
      receivedHashPrefix: responsePayload.hash.slice(0, 12),
    });
  }

  return matches;
}
