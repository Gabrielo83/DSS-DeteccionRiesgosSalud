import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
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

const trustedDevicePersistence =
  String(import.meta.env.VITE_FIREBASE_TRUSTED_DEVICE || "")
    .trim()
    .toLowerCase() === "true";

let firestoreDb = null;

const getFirebaseDb = (app) => {
  if (firestoreDb) return firestoreDb;
  firestoreDb = initializeFirestore(app, {
    localCache: trustedDevicePersistence
      ? persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        })
      : memoryLocalCache(),
  });
  return firestoreDb;
};

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
    db: getFirebaseDb(app),
    storage: getStorage(app),
  };
};

export const getFirebaseOfflineConfig = () => ({
  trustedDevice: trustedDevicePersistence,
  cache: trustedDevicePersistence ? "persistent-indexeddb" : "memory",
  tabMode: trustedDevicePersistence ? "multiple" : "none",
});

export const getFirebaseAnalytics = async () => {
  const app = getFirebaseApp();
  const { getAnalytics, isSupported } = await import("firebase/analytics");
  const supported = await isSupported();
  return supported ? getAnalytics(app) : null;
};

export const getFirebasePerformance = async () => {
  const app = getFirebaseApp();
  const { getPerformance } = await import("firebase/performance");
  return getPerformance(app);
};
