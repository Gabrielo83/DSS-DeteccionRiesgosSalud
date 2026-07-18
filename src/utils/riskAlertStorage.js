import {
  RISK_ALERTS_STORAGE_KEY,
  RISK_ALERT_SUMMARY_STORAGE_KEY,
  RISK_ALERTS_UPDATED_EVENT,
} from "./storageKeys.js";

const isBrowser = () => typeof window !== "undefined";

const readJson = (key, fallback) => {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn("No se pudieron leer las alertas de riesgo:", error);
    return fallback;
  }
};

const persist = (key, value) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(RISK_ALERTS_UPDATED_EVENT));
};

export const readRiskAlerts = () =>
  readJson(RISK_ALERTS_STORAGE_KEY, []);

export const replaceRiskAlerts = (alerts = []) =>
  persist(RISK_ALERTS_STORAGE_KEY, Array.isArray(alerts) ? alerts : []);

export const readRiskAlertSummary = () =>
  readJson(RISK_ALERT_SUMMARY_STORAGE_KEY, null);

export const replaceRiskAlertSummary = (summary = null) =>
  persist(RISK_ALERT_SUMMARY_STORAGE_KEY, summary);
