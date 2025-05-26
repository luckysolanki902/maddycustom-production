// src/lib/firebase/firebaseAdmin.js
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  try {
    // For development with emulator
    // if (process.env.NODE_ENV === 'development') {
    //   const app = initializeApp({
    //     projectId: process.env.FIREBASE_PROJECT_ID,
    //   });
      
    //   // Point to the Firebase emulator if using one
    //   process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
    //   console.log('Firebase Admin initialized for development');
    // } else {
      // Production initialization
      console.log({
        pid: process.env.FIREBASE_PROJECT_ID,
        email: process.env.FIREBASE_CLIENT_EMAIL,
        hasKey: !!process.env.FIREBASE_PRIVATE_KEY,
        previewKey: process.env.FIREBASE_PRIVATE_KEY?.slice(0,30) + '…'
      })
      
      const app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        })
      });
      console.log('Firebase Admin initialized for production');
    // }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export const adminAuth = getAuth();
