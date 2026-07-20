import {
  ABSENCES_STORAGE_KEY,
  ABSENCES_UPDATED_EVENT,
} from "./storageKeys.js";
import { createProtectedOperationalStore } from "./protectedOperationalStore.js";

const store = createProtectedOperationalStore({
  storageKey: ABSENCES_STORAGE_KEY,
  eventName: ABSENCES_UPDATED_EVENT,
  legacyStore: "absences",
  legacyKey: "records",
  emptyValue: [],
});

export const readAbsences = () => {
  const entries = store.read();
  return Array.isArray(entries) ? entries : [];
};

export const replaceAbsences = (entries = []) =>
  store.replace(Array.isArray(entries) ? entries : []);

export const upsertAbsence = (entry) => {
  if (!entry?.absenceId) return;
  const entries = readAbsences().filter(
    (item) => item.absenceId !== entry.absenceId,
  );
  store.replace([...entries, entry]);
};

export const clearAbsenceCache = () => store.clear();
