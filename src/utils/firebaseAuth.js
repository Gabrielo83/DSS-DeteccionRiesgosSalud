import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseServices } from "../services/firebase/firebaseClient.js";

const PROFILE_KEY_PREFIX = "firebase_auth_profile:";
const isBrowser = () => typeof window !== "undefined";
const isOffline = () =>
  typeof navigator !== "undefined" && navigator.onLine === false;

const readCachedProfile = (uid) => {
  if (!isBrowser() || !uid) return null;
  try {
    const raw = window.localStorage.getItem(`${PROFILE_KEY_PREFIX}${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const persistCachedProfile = (uid, profile) => {
  if (!isBrowser() || !uid || !profile?.role) return;
  window.localStorage.setItem(
    `${PROFILE_KEY_PREFIX}${uid}`,
    JSON.stringify({ ...profile, cachedAt: new Date().toISOString() }),
  );
};

export const signInWithEmail = (email, password) => {
  const { auth } = getFirebaseServices();
  return signInWithEmailAndPassword(auth, email, password);
};

export const signOutUser = () => {
  const { auth } = getFirebaseServices();
  return signOut(auth);
};

export const onAuthChange = (callback) => {
  const { auth, db } = getFirebaseServices();
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }

    let role = "";
    let displayName = user.displayName || user.email || "";
    const cachedProfile = readCachedProfile(user.uid);

    try {
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        role = data?.rol || "";
        displayName = data?.nombreVisible || displayName;
        persistCachedProfile(user.uid, {
          email: user.email,
          fullName: displayName,
          role,
        });
      }
    } catch (error) {
      console.warn("No se pudo leer el rol del usuario:", error);
      if (isOffline() && cachedProfile?.role) {
        role = cachedProfile.role;
        displayName = cachedProfile.fullName || displayName;
      }
    }

    callback({
      uid: user.uid,
      email: user.email,
      fullName: displayName,
      role,
    });
  });
};
