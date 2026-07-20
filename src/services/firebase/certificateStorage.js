import { getBlob, ref } from "firebase/storage";
import { isFirebaseProvider } from "../appMode.js";
import { getFirebaseServices } from "./firebaseClient.js";

const isLocalPreview = (value = "") =>
  value.startsWith("data:") || value.startsWith("blob:");

export const hasCertificateDocument = (fileMeta) =>
  Boolean(
    fileMeta?.storagePath ||
      fileMeta?.previewUrl ||
      fileMeta?.downloadUrl,
  );

export const loadCertificatePreview = async (fileMeta) => {
  if (!fileMeta) return null;

  if (isLocalPreview(fileMeta.previewUrl || "")) {
    return { ...fileMeta, revokePreview: false };
  }

  if (isFirebaseProvider() && fileMeta.storagePath) {
    const { storage } = getFirebaseServices();
    const blob = await getBlob(ref(storage, fileMeta.storagePath));
    return {
      ...fileMeta,
      previewUrl: URL.createObjectURL(blob),
      revokePreview: true,
    };
  }

  const legacyUrl = fileMeta.previewUrl || fileMeta.downloadUrl || "";
  return legacyUrl
    ? { ...fileMeta, previewUrl: legacyUrl, revokePreview: false }
    : null;
};

export const releaseCertificatePreview = (fileMeta) => {
  if (fileMeta?.revokePreview && fileMeta.previewUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(fileMeta.previewUrl);
  }
};
