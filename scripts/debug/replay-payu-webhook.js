#!/usr/bin/env node

/**
 * Replay a captured PayU webhook payload and recompute the reverse hash locally.
 *
 * Usage:
 *   node scripts/debug/replay-payu-webhook.js [path-to-json]
 * If no file path is provided, the script uses the latest file inside
 *   scripts/generated/payu-webhook-failures
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { loadEnvConfig } = require('@next/env');

const projectRoot = path.resolve(__dirname, '..', '..');
loadEnvConfig(projectRoot);

const DEBUG_DIR =
  process.env.PAYU_WEBHOOK_DEBUG_DIR ||
  path.join(projectRoot, 'scripts', 'generated', 'payu-webhook-failures');

function normaliseValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number(value).toString();
  return String(value).trim();
}

function generateReverseResponseHash(payload, salt) {
  const {
    status = '',
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
  } = payload;

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

  return crypto.createHash('sha512').update(sequence.map(normaliseValue).join('|')).digest('hex');
}

function resolveInputFile(argPath) {
  if (argPath) {
    return path.isAbsolute(argPath) ? argPath : path.join(process.cwd(), argPath);
  }

  if (!fs.existsSync(DEBUG_DIR)) {
    return null;
  }

  const files = fs
    .readdirSync(DEBUG_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort((a, b) => fs.statSync(path.join(DEBUG_DIR, b)).mtimeMs - fs.statSync(path.join(DEBUG_DIR, a)).mtimeMs);

  if (files.length === 0) return null;
  return path.join(DEBUG_DIR, files[0]);
}

function loadPayload(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(content);
  if (parsed.payload) return parsed.payload;
  return parsed;
}

function resolveSalt() {
  const salt =
    process.env.PAYU_SALT ||
    process.env.PAYU_API_SALT ||
    process.env.NEXT_PUBLIC_PAYU_SALT ||
    process.env.NEXT_PUBLIC_PAYU_API_SALT;
  if (!salt) {
    throw new Error('Missing PAYU salt in environment variables.');
  }
  return salt;
}

(async function main() {
  try {
    const targetPath = resolveInputFile(process.argv[2]);
    if (!targetPath) {
      console.error('No debug payload file found. Provide a file path or capture a webhook failure first.');
      process.exit(1);
    }

    const payload = loadPayload(targetPath);
    const salt = resolveSalt();
    const recomputed = generateReverseResponseHash(payload, salt);
    const received = payload.hash || payload.HASH || '<missing>';

    console.log('Replay file :', targetPath);
    console.log('Txn ID      :', payload.txnid || payload.TXNID || 'unknown');
    console.log('Amount      :', payload.amount);
    console.log('Status      :', payload.status);
    console.log('Received hash :', received);
    console.log('Computed hash :', recomputed);

    if (received && received === recomputed) {
      console.log('✅ Hashes match');
    } else if (received) {
      console.log('❌ Hash mismatch');
    } else {
      console.log('⚠️  Received payload did not include a hash field.');
    }
  } catch (err) {
    console.error('Replay failed:', err.message);
    process.exit(1);
  }
})();
