import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseClient.js";

export const rebuildFirebaseAlertSummary = async () => {
  const functions = getFunctions(getFirebaseApp(), "us-east1");
  const callable = httpsCallable(functions, "reconstruirIndicadoresAlertas");
  const result = await callable();
  return result.data;
};

export const rebuildFirebaseRiskAlerts = async () => {
  const functions = getFunctions(getFirebaseApp(), "us-east1");
  const callable = httpsCallable(functions, "reconstruirAlertasRiesgo");
  const result = await callable();
  return result.data;
};

export const rebuildFirebaseRiskIndicator = async () => {
  const functions = getFunctions(getFirebaseApp(), "us-east1");
  const callable = httpsCallable(functions, "reconstruirIndicadoresRiesgo");
  const result = await callable();
  return result.data;
};

export const rebuildFirebaseAbsenceIndicator = async () => {
  const functions = getFunctions(getFirebaseApp(), "us-east1");
  const callable = httpsCallable(
    functions,
    "reconstruirIndicadoresAusentismo",
  );
  const result = await callable();
  return result.data;
};

if (typeof window !== "undefined") {
  window.rebuildRiskAlerts = rebuildFirebaseRiskAlerts;
}
