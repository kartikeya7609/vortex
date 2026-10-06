import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// User-provided web app Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBjlsSnGLM_v5SCiAjIx3ZwdkmSBHRmhbE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "aarohan-da931.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "aarohan-da931",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "aarohan-da931.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "635223585969",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:635223585969:web:d8187e5530be092c93de90",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-FKF5SP1BNL"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth & Google Auth Provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Analytics conditionally if supported
export let analytics = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch(() => {});
