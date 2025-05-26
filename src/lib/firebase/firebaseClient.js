// // // lib/firebaseClient.js
// // import { initializeApp, getApps } from 'firebase/app';
// // import {
// //   getAuth,
// //   RecaptchaVerifier,
// //   signInWithPhoneNumber,
// //   connectAuthEmulator
// // } from 'firebase/auth';
// // const firebaseConfig = {
// //   apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
// //   authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
// //   projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
// //   appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
// // };
// // // Initialize Firebase only if it hasn't been initialized yet

// // // const app = !getApps().length
// // //   ? initializeApp(firebaseConfig)
// // //   : getApps()[0];

// // // const auth = getAuth(app);

// // // // ← Inject a settings object so the SDK can safely read this property
// // // auth.settings.appVerificationDisabledForTesting = true;

// // // export { auth, RecaptchaVerifier, signInWithPhoneNumber };

// // const app = !getApps().length
// //   ? initializeApp(firebaseConfig)
// //   : getApps()[0]

// // const auth = getAuth(app)

// // // point at your local emulator in development
// // if (process.env.NODE_ENV === 'development') {
// //   connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
// // }

// // export { auth }
// // export * from 'firebase/auth';


// import { initializeApp, getApps } from 'firebase/app';
// import {
//   getAuth,
//   connectAuthEmulator
// } from 'firebase/auth';

// const firebaseConfig = {
//   apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
//   authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
//   projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
//   appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
// };

// // Initialize Firebase
// const app = !getApps().length
//   ? initializeApp(firebaseConfig)
//   : getApps()[0];

// const auth = getAuth(app);

// // Connect to emulator in development
// if (process.env.NODE_ENV === 'development') {
//   connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
// }

// export { auth };
// export * from 'firebase/auth';

// Import the functions you need from the SDKs you need
// lib/firebase/firebaseClient.js
// lib/firebase/firebaseClient.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Ensure no reinitialization
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth must be derived **after** app init
const auth = getAuth(app);

export { auth };
