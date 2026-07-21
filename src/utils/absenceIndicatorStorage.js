import {
  ABSENCE_INDICATOR_STORAGE_KEY,
  ABSENCE_INDICATOR_UPDATED_EVENT,
} from "./storageKeys.js";

const isBrowser = () => typeof window !== "undefined";

export const readAbsenceIndicator = () => {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(ABSENCE_INDICATOR_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("No se pudo leer el indicador agregado de ausentismo:", error);
    return null;
  }
};

export const replaceAbsenceIndicator = (indicator = null) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(
    ABSENCE_INDICATOR_STORAGE_KEY,
    JSON.stringify(indicator),
  );
  window.dispatchEvent(new Event(ABSENCE_INDICATOR_UPDATED_EVENT));
};
