// lib/merchant/googleMerchantApi.js
// Experimental Merchant API wrapper (Content API deprecation migration)
// When process.env.USE_MERCHANT_API === 'true', product sync will use this module instead of legacy google.content client.
// Implements productInputs.insert (and patch fallback) via REST calls because official googleapis client may lag.

const { google } = require('googleapis');
const fetch = require('node-fetch');

const MERCHANT_BASE = 'https://merchantapi.googleapis.com';

function getRequiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

async function getAccessToken() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/content'],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error('Failed to obtain Google access token');
  return token;
}

// Transform legacy merchantProduct (Content API style) to Merchant API productInput.
function mapToProductInput(mp, { feedLabel = 'default', contentLanguage = 'en', channel = 'ONLINE' } = {}) {
  // Merchant API price expects micros according to standard Google patterns (amountMicros + currencyCode)
  const priceValue = parseFloat(mp.price?.value || '0');
  const amountMicros = Math.round(priceValue * 1_000_000);
  const salePriceValue = mp.salePrice ? parseFloat(mp.salePrice.value) : null;

  const attributes = {
    title: mp.title,
    description: mp.description,
    link: mp.link,
    imageLink: mp.imageLink,
    additionalImageLinks: mp.additionalImageLinks,
    brand: mp.brand,
    googleProductCategory: mp.googleProductCategory,
    price: {
      amountMicros,
      currencyCode: mp.price?.currency || 'INR'
    },
    availability: mp.availability?.toUpperCase().replace(/\s+/g, '_'), // IN_STOCK etc.
    condition: mp.condition?.toUpperCase() || 'NEW',
  };
  if (salePriceValue) {
    attributes.salePrice = {
      amountMicros: Math.round(salePriceValue * 1_000_000),
      currencyCode: mp.salePrice.currency || 'INR'
    };
  }
  if (mp.customAttributes) {
    // Flatten custom attributes into "customAttributes" array if needed or keep as is
    attributes.customAttributes = mp.customAttributes.map(ca => ({ name: ca.name, value: ca.value }));
  }

  return {
    channel,
    contentLanguage,
    feedLabel,
    offerId: mp.offerId,
    attributes
  };
}

async function insertOrUpdateProductInput(merchantAccountId, merchantProduct, options = {}) {
  const parent = `accounts/${merchantAccountId}`;
  const productInput = mapToProductInput(merchantProduct, options);
  const token = await getAccessToken();

  const url = `${MERCHANT_BASE}/products/v1/${parent}/productInputs:insert`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ productInput })
  });

  if (res.status === 409) {
    // Conflict (already exists) -> patch
    const name = `accounts/${merchantAccountId}/productInputs/${productInput.channel}/${productInput.contentLanguage}/${productInput.feedLabel}/${productInput.offerId}`;
    const patchUrl = `${MERCHANT_BASE}/products/v1/${name}`;
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ productInput })
    });
    if (!patchRes.ok) {
      const txt = await patchRes.text();
      throw new Error(`Merchant API patch failed ${patchRes.status}: ${txt}`);
    }
    return { status: 'Updated', data: await patchRes.json() };
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Merchant API insert failed ${res.status}: ${txt}`);
  }
  return { status: 'Inserted', data: await res.json() };
}

module.exports = { insertOrUpdateProductInput };
