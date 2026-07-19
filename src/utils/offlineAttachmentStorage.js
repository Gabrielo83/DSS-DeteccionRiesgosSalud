import { deleteEntity, readEntity, saveEntity } from "./indexedDbClient.js";

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
    blob: attachmentBlob,
    name,
    type: type || attachmentBlob.type || "",
    size: size || attachmentBlob.size || 0,
    savedAt: new Date().toISOString(),
  };
  await saveEntity(ATTACHMENT_STORE, key, record);
  return record;
};

export const readOfflineAttachment = (key) =>
  key ? readEntity(ATTACHMENT_STORE, key) : Promise.resolve(null);

export const readOfflineAttachmentAsDataUrl = async (key) => {
  const record = await readOfflineAttachment(key);
  if (!record?.blob) return null;
  return {
    ...record,
    dataUrl: await blobToDataUrl(record.blob),
  };
};

export const deleteOfflineAttachment = (key) =>
  key ? deleteEntity(ATTACHMENT_STORE, key) : Promise.resolve();
