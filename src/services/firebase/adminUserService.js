import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseClient.js";

export const updateFirebaseUserEmail = async (uid, nuevoEmail) => {
  const functions = getFunctions(getFirebaseApp(), "us-east1");
  const callable = httpsCallable(functions, "actualizarCorreoUsuario");
  const result = await callable({ uid, nuevoEmail });
  return result.data;
};
