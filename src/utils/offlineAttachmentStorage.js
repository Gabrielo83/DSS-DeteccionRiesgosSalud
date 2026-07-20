import {
  deleteEncryptedEntity,
  readEncryptedEntity,
  saveEncryptedEntity,
} from "./secureStorage.js";

const ATTACHMENT_STORE = "attachments";

const dataUrlToBlob = async (dataUrl) => {
  if (!dataUrl || !String(dataUrl).startsWith("data:")) return null;
  const response = await fetch(dataUrl);
  return response.blob();
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const saveOfflineAttachment = async (
  key,
  { dataUrl, blob, name = "certificado", type = "", size = "" } = {},
) => {
  if (!key) return null;
  const attachmentBlob = blob || (await dataUrlToBlob(dataUrl));
  if (!attachmentBlob) return null;
  const record = {
    dataUrl: await blobToDataUrl(attachmentBlob),
    name,
    type: type || attachmentBlob.type || "",
    size: size || attachmentBlob.size || 0,
    savedAt: new Date().toISOString(),
  };
  await saveEncryptedEntity(`${ATTACHMENT_STORE}:${key}`, record);
  return { ...record, dataUrl: undefined };
};

export const readOfflineAttachment = async (key) => {
  if (!key) return null;
  const record = await readEncryptedEntity(`${ATTACHMENT_STORE}:${key}`);
  if (!record?.dataUrl) return null;
  return {
    ...record,
    blob: await dataUrlToBlob(record.dataUrl),
  };
};

export const readOfflineAttachmentAsDataUrl = async (key) => {
  const record = await readOfflineAttachment(key);
  if (!record?.blob) return null;
  return {
    ...record,
    dataUrl: await blobToDataUrl(record.blob),
  };
};

export const deleteOfflineAttachment = (key) =>
  key
    ? deleteEncryptedEntity(`${ATTACHMENT_STORE}:${key}`)
    : Promise.resolve();
