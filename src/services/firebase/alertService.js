import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseClient.js";

export const rebuildFirebaseAlertSummary = async () => {
  const functions = getFunctions(getFirebaseApp(), "us-east1");
  const callable = httpsCallable(functions, "reconstruirIndicadoresAlertas");
  const result = await callable();
  return result.data;
};
