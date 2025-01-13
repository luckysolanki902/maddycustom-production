// lib/merchant/googleContentApi.js

const { google } = require('googleapis');

const initializeContentApi = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/content'],
  });

  const content = google.content({
    version: 'v2.1',
    auth,
  });

  return content;
};

module.exports = { initializeContentApi };
