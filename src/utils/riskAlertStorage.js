import {
  RISK_ALERTS_STORAGE_KEY,
  RISK_ALERT_SUMMARY_STORAGE_KEY,
  RISK_ALERTS_UPDATED_EVENT,
} from "./storageKeys.js";
import { createProtectedOperationalStore } from "./protectedOperationalStore.js";

const isBrowser = () => typeof window !== "undefined";
const alertStore = createProtectedOperationalStore({
  storageKey: RISK_ALERTS_STORAGE_KEY,
  eventName: RISK_ALERTS_UPDATED_EVENT,
  legacyStore: "secureData",
  legacyKey: "risk-alerts-legacy",
  emptyValue: [],
});

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

export const readRiskAlerts = () => {
  const alerts = alertStore.read();
  return Array.isArray(alerts) ? alerts : [];
};

export const replaceRiskAlerts = (alerts = []) =>
  alertStore.replace(Array.isArray(alerts) ? alerts : []);

export const readRiskAlertSummary = () =>
  readJson(RISK_ALERT_SUMMARY_STORAGE_KEY, null);

export const replaceRiskAlertSummary = (summary = null) =>
  persist(RISK_ALERT_SUMMARY_STORAGE_KEY, summary);

export const clearRiskAlertCache = () => alertStore.clear();
