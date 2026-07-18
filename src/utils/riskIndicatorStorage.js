import {
  RISK_INDICATOR_STORAGE_KEY,
  RISK_INDICATOR_UPDATED_EVENT,
} from "./storageKeys.js";

const isBrowser = () => typeof window !== "undefined";

export const readRiskIndicator = () => {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(RISK_INDICATOR_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("No se pudo leer el indicador agregado de riesgo:", error);
    return null;
  }
};

export const replaceRiskIndicator = (indicator = null) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(
    RISK_INDICATOR_STORAGE_KEY,
    JSON.stringify(indicator),
  );
  window.dispatchEvent(new Event(RISK_INDICATOR_UPDATED_EVENT));
};
