import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

export const getMissingFirebaseConfig = () =>
  requiredKeys.filter((key) => !firebaseConfig[key]);

export const assertFirebaseConfig = () => {
  const missing = getMissingFirebaseConfig();
  if (missing.length) {
    throw new Error(
      `Configuracion Firebase incompleta. Faltan: ${missing.join(", ")}`,
    );
  }
};

export const getFirebaseApp = () => {
  assertFirebaseConfig();
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
};

export const getFirebaseServices = () => {
  const app = getFirebaseApp();
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };
};
