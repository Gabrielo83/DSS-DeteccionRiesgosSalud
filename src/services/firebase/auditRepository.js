import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseServices } from "./firebaseClient.js";

const stripUndefined = (value) => {
  if (Array.isArray(value)) return value.map(stripUndefined);
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
  if (!event?.id) return;
  const { db } = getFirebaseServices();
  await setDoc(
    doc(db, "auditoria", event.id),
    stripUndefined({
      ...event,
      creadoEn: serverTimestamp(),
    }),
    { merge: false },
  );
};
