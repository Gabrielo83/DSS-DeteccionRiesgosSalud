import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseServices } from "./firebaseClient.js";

const isFirestoreFieldValue = (value) =>
  value &&
  typeof value === "object" &&
  ("_methodName" in value ||
    String(value.constructor?.name || "").includes("FieldValue"));

const stripUndefined = (value) => {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (isFirestoreFieldValue(value) || value instanceof Date) return value;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefined(entryValue)]),
    );
  }
  return value;
};

export const writeAuditEvent = async (event) => {
  if (!event?.id) return false;
  const { auth, db } = getFirebaseServices();

  // Firestore no admite auditoria anonima. Los fallos previos al login
  // permanecen en el registro local y Firebase Auth/Cloud Logging.
  if (!auth.currentUser) return false;

  await setDoc(
    doc(db, "auditoria", event.id),
    stripUndefined({
      ...event,
      creadoEn: serverTimestamp(),
    }),
    { merge: false },
  );
  return true;
};
