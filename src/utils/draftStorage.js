import {
  ABSENCE_DRAFTS_STORAGE_KEY,
  ABSENCE_DRAFTS_UPDATED_EVENT,
} from "./storageKeys.js";
import { readEntity, saveEntity } from "./indexedDbClient.js";

const IDB_STORE = "drafts";
const IDB_KEY = "drafts";

const isBrowser = () => typeof window !== "undefined";

const readRawDrafts = () => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(ABSENCE_DRAFTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    syncFromIndexedDb();
    return parsed;
  } catch (error) {
    console.warn("No se pudo leer el storage de borradores:", error);
    return [];
  }
};

const persistDrafts = (drafts) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(
    ABSENCE_DRAFTS_STORAGE_KEY,
    JSON.stringify(drafts),
  );
  window.dispatchEvent(new Event(ABSENCE_DRAFTS_UPDATED_EVENT));
  saveEntity(IDB_STORE, IDB_KEY, drafts);
};

export const readDrafts = () => readRawDrafts();

export const saveDraft = (draft) => {
  if (!draft) return;
  const drafts = readRawDrafts().filter(
    (item) => item.draftId !== draft.draftId,
  );
  persistDrafts([...drafts, draft]);
};

export const removeDraft = (draftId) => {
  if (!draftId) return;
  const drafts = readRawDrafts();
  const filtered = drafts.filter((draft) => draft.draftId !== draftId);
  persistDrafts(filtered);
};

const syncFromIndexedDb = async () => {
  if (!isBrowser()) return;
  try {
    const idbValue = await readEntity(IDB_STORE, IDB_KEY);
    if (!idbValue) return;
    const raw = window.localStorage.getItem(ABSENCE_DRAFTS_STORAGE_KEY);
    const localValue = raw ? JSON.parse(raw) : [];
    const isDifferent = JSON.stringify(localValue) !== JSON.stringify(idbValue);
    if (isDifferent) {
      window.localStorage.setItem(
        ABSENCE_DRAFTS_STORAGE_KEY,
        JSON.stringify(idbValue),
      );
      window.dispatchEvent(new Event(ABSENCE_DRAFTS_UPDATED_EVENT));
    }
  } catch (error) {
    console.warn("No se pudo sincronizar borradores desde IndexedDB:", error);
  }
};
