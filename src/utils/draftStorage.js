import {
  ABSENCE_DRAFTS_STORAGE_KEY,
  ABSENCE_DRAFTS_UPDATED_EVENT,
} from "./storageKeys.js";
import { createProtectedOperationalStore } from "./protectedOperationalStore.js";
import {
  deleteOfflineAttachment,
  readOfflineAttachmentAsDataUrl,
  saveOfflineAttachment,
} from "./offlineAttachmentStorage.js";

const IDB_STORE = "drafts";
const IDB_KEY = "drafts";

const store = createProtectedOperationalStore({
  storageKey: ABSENCE_DRAFTS_STORAGE_KEY,
  eventName: ABSENCE_DRAFTS_UPDATED_EVENT,
  legacyStore: IDB_STORE,
  legacyKey: IDB_KEY,
  emptyValue: [],
});

const readRawDrafts = () => {
  const drafts = store.read();
  return Array.isArray(drafts) ? drafts : [];
};

const persistDrafts = (drafts) => store.replace(drafts);

export const readDrafts = () => readRawDrafts();

export const replaceDrafts = (drafts = []) => {
  persistDrafts(Array.isArray(drafts) ? drafts : []);
};

const detachDraftAttachment = (draft) => {
  const file = draft?.certificateFile;
  if (!draft?.draftId || !String(file?.previewUrl || "").startsWith("data:")) {
    return draft;
  }
  const attachmentKey = `draft:${draft.draftId}`;
  saveOfflineAttachment(attachmentKey, {
    dataUrl: file.previewUrl,
    name: file.name,
    type: file.type || file.contentType,
    size: file.size,
  });
  return {
    ...draft,
    certificateFile: {
      ...file,
      previewUrl: "",
      offlineAttachmentKey: attachmentKey,
    },
  };
};

export const saveDraft = (draft) => {
  if (!draft) return;
  const storedDraft = detachDraftAttachment(draft);
  const drafts = readRawDrafts().filter(
    (item) => item.draftId !== draft.draftId,
  );
  persistDrafts([...drafts, storedDraft]);
};

export const restoreDraftAttachment = async (draft) => {
  const attachmentKey = draft?.certificateFile?.offlineAttachmentKey;
  if (!attachmentKey) return draft;
  const attachment = await readOfflineAttachmentAsDataUrl(attachmentKey);
  if (!attachment?.dataUrl) return draft;
  return {
    ...draft,
    certificateFile: {
      ...draft.certificateFile,
      name: draft.certificateFile.name || attachment.name,
      type: draft.certificateFile.type || attachment.type,
      size: draft.certificateFile.size || attachment.size,
      previewUrl: attachment.dataUrl,
    },
  };
};

export const removeDraft = (draftId) => {
  if (!draftId) return;
  const drafts = readRawDrafts();
  const filtered = drafts.filter((draft) => draft.draftId !== draftId);
  persistDrafts(filtered);
  deleteOfflineAttachment(`draft:${draftId}`);
};

export const clearDraftCache = () => store.clear();
