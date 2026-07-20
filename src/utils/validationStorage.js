import {
  MEDICAL_VALIDATIONS_STORAGE_KEY,
  MEDICAL_VALIDATIONS_UPDATED_EVENT,
} from "./storageKeys.js";
import { createProtectedOperationalStore } from "./protectedOperationalStore.js";

const IDB_STORE = "validations";
const IDB_KEY = "queue";

const store = createProtectedOperationalStore({
  storageKey: MEDICAL_VALIDATIONS_STORAGE_KEY,
  eventName: MEDICAL_VALIDATIONS_UPDATED_EVENT,
  legacyStore: IDB_STORE,
  legacyKey: IDB_KEY,
  emptyValue: [],
});

export const readValidationQueue = () => {
  const entries = store.read();
  return Array.isArray(entries) ? entries : [];
};

const persistQueue = (entries) => store.replace(entries);

export const upsertValidationEntry = (entry) => {
  if (typeof window === "undefined" || !entry?.reference) return;
  const queue = readValidationQueue().filter(
    (item) => item.reference !== entry.reference,
  );
  persistQueue([...queue, entry]);
};

export const replaceValidationQueue = (entries = []) => {
  const safeEntries = Array.isArray(entries) ? entries : [];
  persistQueue(safeEntries);
};

export const removeValidationEntry = (reference) => {
  if (typeof window === "undefined" || !reference) return;
  const queue = readValidationQueue();
  const filtered = queue.filter((item) => item.reference !== reference);
  if (filtered.length === queue.length) return;
  persistQueue(filtered);
};

export const clearValidationCache = () => store.clear();
