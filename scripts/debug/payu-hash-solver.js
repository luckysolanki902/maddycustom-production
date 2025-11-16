#!/usr/bin/env node

const crypto = require('crypto');

const payload = {
  status: 'success',
  additionalCharges: '',
  udf1: '6918b561a886ae678703fc72',
  udf2: '',
  udf3: 'upi',
  udf4: '',
  udf5: '',
  udf6: '',
  udf7: '',
  udf8: '',
  udf9: '',
  udf10: '',
  email: 'luckysolanki902@gmail.com',
  firstname: 'Lucky',
  productinfo: 'Order 6918b561a886ae678703fc72',
  amount: '1.00',
  txnid: 'MADDY-6918b561a886ae678703fc72-1763226977213',
  key: 'Gr3U59',
};

const salt = 'BdCi9XIHV18gIf0gWDiPDP39APCv0I9t';
const targetHash = '4edc19b8e99dc3d0196e39be84dbf532542212e2a01ec7e8468f09301632e5ee5cb33d142428d5ad6bedf8c33354d73d98a584d5906f6a39073018375b442382';

const normalise = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number(value).toString();
  return String(value).trim();
};

const sha512 = (value) => crypto.createHash('sha512').update(value).digest('hex');

const sequences = {
  docSequence: (p) => [
    salt,
    p.status,
    '', '', '', '', '', '', '', '', '', '',
    p.udf5,
    p.udf4,
    p.udf3,
    p.udf2,
    p.udf1,
    p.email,
    p.firstname,
    p.productinfo,
    p.amount,
    p.txnid,
    p.key,
  ],
  docSequenceWithAdditional: (p) => [
    p.additionalCharges || '',
    salt,
    p.status,
    '', '', '', '', '', '', '', '', '', '',
    p.udf5,
    p.udf4,
    p.udf3,
    p.udf2,
    p.udf1,
    p.email,
    p.firstname,
    p.productinfo,
    p.amount,
    p.txnid,
    p.key,
  ],
  udfsReverseFull: (p) => [
    salt,
    p.status,
    p.udf10,
    p.udf9,
    p.udf8,
    p.udf7,
    p.udf6,
    p.udf5,
    p.udf4,
    p.udf3,
    p.udf2,
    p.udf1,
    p.email,
    p.firstname,
    p.productinfo,
    p.amount,
    p.txnid,
    p.key,
  ],
  udfsReverseFullWithAdditional: (p) => [
    p.additionalCharges || '',
    salt,
    p.status,
    p.udf10,
    p.udf9,
    p.udf8,
    p.udf7,
    p.udf6,
    p.udf5,
    p.udf4,
    p.udf3,
    p.udf2,
    p.udf1,
    p.email,
    p.firstname,
    p.productinfo,
    p.amount,
    p.txnid,
    p.key,
  ],
  alt: (p) => [
    salt,
    p.status,
    p.udf5,
    p.udf4,
    p.udf3,
    p.udf2,
    p.udf1,
    p.email,
    p.firstname,
    p.productinfo,
    p.amount,
    p.txnid,
    p.key,
  ],
  gokwik: (p) => [
    p.key,
    p.txnid,
    p.amount,
    p.productinfo,
    p.firstname,
    p.email,
    p.udf1,
    p.udf2,
    p.udf3,
    p.udf4,
    p.udf5,
    p.udf6,
    p.udf7,
    p.udf8,
    p.udf9,
    p.udf10,
    salt,
  ],
};

Object.entries(sequences).forEach(([name, build]) => {
  const value = build(payload).map(normalise).join('|');
  const hash = sha512(value);
  console.log(name, hash === targetHash ? 'MATCH' : 'mismatch', hash.slice(0, 16));
});
