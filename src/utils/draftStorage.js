import {
  ABSENCE_DRAFTS_STORAGE_KEY,
  ABSENCE_DRAFTS_UPDATED_EVENT,
} from "./storageKeys.js";

const isBrowser = () => typeof window !== "undefined";

const readRawDrafts = () => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(ABSENCE_DRAFTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
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
