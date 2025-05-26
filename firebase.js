// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAnyFDZAr2mZJT9nYDYQaj1eFLiESnyTAo",
  authDomain: "maddy-70cef.firebaseapp.com",
  projectId: "maddy-70cef",
  storageBucket: "maddy-70cef.firebasestorage.app",
  messagingSenderId: "400185258631",
  appId: "1:400185258631:web:220077616f13388eab7e22",
  measurementId: "G-48CTL3T030"
};

// Initialize Firebase
const app = getApps().length==0? initializeApp(firebaseConfig): getApp();
const auth= getAuth(app);
auth.useDeviceLanguage();
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
  isTokenAutoRefreshEnabled: true // Set to true to allow auto-refresh.
});

export { auth };