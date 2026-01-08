import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseClient.js";

export const signInWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const signOutUser = () => signOut(auth);

export const onAuthChange = (callback) =>
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }

    let role = "";
    let displayName = user.displayName || user.email || "";

    try {
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        role = data?.rol || "";
        displayName = data?.nombreVisible || displayName;
      }
    } catch (error) {
      console.warn("No se pudo leer el rol del usuario:", error);
    }

    callback({
      uid: user.uid,
      email: user.email,
      fullName: displayName,
      role,
    });
  });
