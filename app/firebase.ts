import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase web configuration identifies the public client application; it is
// intentionally included in the browser bundle so GitHub Pages can run without
// a server-side environment variable.
const deployedFirebaseConfig = {
  apiKey: "AIzaSyBMYrKXT6syeVG0m4t262b2g9NtG6OfXfQ",
  authDomain: "instargram-6c751.firebaseapp.com",
  projectId: "instargram-6c751",
  storageBucket: "instargram-6c751.firebasestorage.app",
  messagingSenderId: "2801657403",
  appId: "1:2801657403:web:a82aaf9fbf5a6aba4f1e1e",
  measurementId: "G-FPRRXMQSLM",
};

const env = import.meta.env as Record<string, string | undefined>;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? env.NEXT_PUBLIC_FIREBASE_API_KEY ?? deployedFirebaseConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? deployedFirebaseConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? deployedFirebaseConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? deployedFirebaseConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? deployedFirebaseConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID ?? env.NEXT_PUBLIC_FIREBASE_APP_ID ?? deployedFirebaseConfig.appId,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID ?? env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? deployedFirebaseConfig.measurementId,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
