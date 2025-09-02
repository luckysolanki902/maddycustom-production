// lib/merchant/googleContentApi.js
// Adds defensive handling for absent or differently formatted private keys and clearer error messages.

const { google } = require('googleapis');

function normalizePrivateKey(raw) {
  if (!raw) return null;
  let key = raw;
  // If provided in base64 (common safer storage method)
  if (/^[A-Za-z0-9+/=\r\n]+$/.test(raw) && raw.includes('=')) {
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      if (decoded.includes('PRIVATE KEY')) key = decoded;
    } catch (_) {
      // fall back to raw if decode fails
    }
  }
  // Replace escaped newlines with real newlines
  key = key.replace(/\\n/g, '\n');
  // Ensure BEGIN/END lines each on their own
  if (!key.includes('\n') && key.includes('-----BEGIN')) {
    // Possibly all on one line; try to insert newlines heuristically
    key = key
      .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
      .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
  }
  return key.trim();
}

const initializeContentApi = () => {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY_BASE64;
  const privateKey = normalizePrivateKey(rawKey);

  if (!clientEmail) {
    throw new Error('GOOGLE_CLIENT_EMAIL env var is missing');
  }
  if (!privateKey) {
    throw new Error('Google private key not found. Provide GOOGLE_PRIVATE_KEY (with \\n escaped newlines) or GOOGLE_PRIVATE_KEY_BASE64');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/content'],
  });

  return google.content({
    version: 'v2.1',
    auth,
  });
};

module.exports = { initializeContentApi };
