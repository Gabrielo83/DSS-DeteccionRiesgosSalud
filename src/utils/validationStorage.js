import {
  MEDICAL_VALIDATIONS_STORAGE_KEY,
  MEDICAL_VALIDATIONS_UPDATED_EVENT,
} from "./storageKeys.js";
import { readEntity, saveEntity } from "./indexedDbClient.js";

const IDB_STORE = "validations";
const IDB_KEY = "queue";

const isBrowser = () => typeof window !== "undefined";

const syncFromIndexedDb = async () => {
  if (!isBrowser()) return;
  try {
    const idbValue = await readEntity(IDB_STORE, IDB_KEY);
    if (!idbValue) return;
    const raw = window.localStorage.getItem(MEDICAL_VALIDATIONS_STORAGE_KEY);
    const localValue = raw ? JSON.parse(raw) : [];
    const isDifferent = JSON.stringify(localValue) !== JSON.stringify(idbValue);
    if (isDifferent) {
      window.localStorage.setItem(
        MEDICAL_VALIDATIONS_STORAGE_KEY,
        JSON.stringify(idbValue),
      );
      window.dispatchEvent(new Event(MEDICAL_VALIDATIONS_UPDATED_EVENT));
    }
  } catch (error) {
    console.warn("No se pudo sincronizar validaciones desde IndexedDB:", error);
  }
};

export const readValidationQueue = () => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(MEDICAL_VALIDATIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    syncFromIndexedDb();
    return parsed;
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
  saveEntity(IDB_STORE, IDB_KEY, entries);
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
