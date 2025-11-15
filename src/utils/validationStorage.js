import {
  MEDICAL_VALIDATIONS_STORAGE_KEY,
  MEDICAL_VALIDATIONS_UPDATED_EVENT,
} from "./storageKeys.js";

const isBrowser = () => typeof window !== "undefined";

export const readValidationQueue = () => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(MEDICAL_VALIDATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn("No se pudo leer la cola de validaciones:", error);
    return [];
  }
};

const persistQueue = (entries) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(
    MEDICAL_VALIDATIONS_STORAGE_KEY,
    JSON.stringify(entries),
  );
  window.dispatchEvent(new Event(MEDICAL_VALIDATIONS_UPDATED_EVENT));
};

export const upsertValidationEntry = (entry) => {
  if (!isBrowser() || !entry?.reference) return;
  const queue = readValidationQueue().filter(
    (item) => item.reference !== entry.reference,
  );
  persistQueue([...queue, entry]);
};

export const removeValidationEntry = (reference) => {
  if (!isBrowser() || !reference) return;
  const queue = readValidationQueue();
  const filtered = queue.filter((item) => item.reference !== reference);
  if (filtered.length === queue.length) return;
  persistQueue(filtered);
};
