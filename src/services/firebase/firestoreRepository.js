import {
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebaseServices } from "./firebaseClient.js";

const stripUndefined = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefined(entryValue)]),
    );
  }
  return value;
};

const buildBasePayload = (operation) =>
  stripUndefined({
    id: operation.id,
    type: operation.type,
    payload: operation.payload || {},
    user: operation.user || null,
    entityId: operation.entityId || null,
    localCreatedAt: operation.createdAt || null,
    retryCount: operation.retryCount || 0,
    syncedAt: serverTimestamp(),
  });

const writeOperationAudit = async (db, operation) => {
  await setDoc(
    doc(db, "operations", operation.id),
    buildBasePayload(operation),
    { merge: true },
  );
};

const writeDraft = async (db, operation) => {
  const draft = operation.payload?.payload || operation.payload || {};
  const draftId = draft.draftId || operation.payload?.draftId || operation.id;
  await setDoc(
    doc(db, "drafts", draftId),
    stripUndefined({
      ...draft,
      sourceOperationId: operation.id,
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  );
};

const writeCertificate = async (db, operation) => {
  const certificate = operation.payload?.certificate || operation.payload || {};
  const reference =
    certificate.reference || operation.payload?.reference || operation.entityId;
  if (!reference) {
    throw new Error("No se pudo sincronizar certificado sin referencia.");
  }
  await setDoc(
    doc(db, "certificates", reference),
    stripUndefined({
      ...certificate,
      reference,
      sourceOperationId: operation.id,
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  );
};

const writeCertificateDecision = async (db, operation) => {
  const reference = operation.payload?.reference || operation.entityId;
  if (!reference) {
    throw new Error("No se pudo sincronizar decision sin referencia.");
  }
  await setDoc(
    doc(db, "certificateDecisions", reference),
    stripUndefined({
      ...operation.payload,
      reference,
      sourceOperationId: operation.id,
      decidedAt: serverTimestamp(),
    }),
    { merge: true },
  );
};

export const syncOperationToFirestore = async (operation) => {
  const { db } = getFirebaseServices();
  await writeOperationAudit(db, operation);

  if (operation.type === "saveDraft") {
    await writeDraft(db, operation);
  }

  if (operation.type === "submitCertificate") {
    await writeCertificate(db, operation);
  }

  if (operation.type === "validateCertificate") {
    await writeCertificateDecision(db, operation);
  }

  return { ok: true };
};
