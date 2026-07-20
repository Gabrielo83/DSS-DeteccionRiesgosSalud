import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseClient.js";

export const updateFirebaseUserEmail = async (uid, nuevoEmail) => {
  const functions = getFunctions(getFirebaseApp(), "us-east1");
  const callable = httpsCallable(functions, "actualizarCorreoUsuario");
  const result = await callable({ uid, nuevoEmail });
  return result.data;
};

export const sanitizeAdministrativeAbsences = async () => {
  const functions = getFunctions(getFirebaseApp(), "us-east1");
  const callable = httpsCallable(functions, "sanitizarAusenciasAdministrativas");
  const result = await callable();
  return result.data;
};

if (typeof window !== "undefined") {
  window.sanitizeAdministrativeAbsences = sanitizeAdministrativeAbsences;
}
