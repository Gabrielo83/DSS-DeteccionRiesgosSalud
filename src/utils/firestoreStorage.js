import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { getFirebaseServices } from "../services/firebase/firebaseClient.js";

export const COLLECTIONS = {
  USUARIOS: "usuarios",
  EMPLEADOS: "empleados",
  AUSENCIAS: "ausencias",
  VALIDACIONES: "validaciones_medicas",
  HISTORIAL: "historial_medico",
  BORRADORES: "borradores",
  PLANES: "planes_preventivos",
  PATOLOGIAS: "patologias",
  PARAMETROS: "parametros_riesgo",
  ALERTAS_RIESGO: "alertas_riesgo",
  INDICADORES_ALERTAS: "indicadores_alertas",
  INDICADORES_RIESGO: "indicadores_riesgo",
  INDICADORES_AUSENTISMO: "indicadores_ausentismo",
};

const withTimestamps = (data, includeCreated) => ({
  ...data,
  ...(includeCreated ? { creadoEn: serverTimestamp() } : {}),
  actualizadoEn: serverTimestamp(),
});

export const getDocById = async (collectionName, id) => {
  const { db } = getFirebaseServices();
  const ref = doc(db, collectionName, id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
};

export const listCollection = async (collectionName) => {
  const { db } = getFirebaseServices();
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
};

export const createDoc = async (collectionName, data) => {
  const { db } = getFirebaseServices();
  const payload = withTimestamps(data, true);
  const ref = await addDoc(collection(db, collectionName), payload);
  return ref.id;
};

export const upsertDocById = async (
  collectionName,
  id,
  data,
  { includeCreated = false, merge = true } = {},
) => {
  const { db } = getFirebaseServices();
  const payload = withTimestamps(data, includeCreated);
  const ref = doc(db, collectionName, id);
  await setDoc(ref, payload, { merge });
  return id;
};

export const updateDocById = async (collectionName, id, data) => {
  const { db } = getFirebaseServices();
  const payload = withTimestamps(data, false);
  const ref = doc(db, collectionName, id);
  await updateDoc(ref, payload);
  return id;
};

export const deleteDocById = async (collectionName, id) => {
  const { db } = getFirebaseServices();
  const ref = doc(db, collectionName, id);
  await deleteDoc(ref);
};

export const queryCollection = async (
  collectionName,
  { filters = [], order = [], limitCount } = {},
) => {
  const { db } = getFirebaseServices();
  let qRef = collection(db, collectionName);

  filters.forEach(([field, op, value]) => {
    qRef = query(qRef, where(field, op, value));
  });

  order.forEach(([field, direction]) => {
    qRef = query(qRef, orderBy(field, direction));
  });

  if (limitCount) {
    qRef = query(qRef, limit(limitCount));
  }

  const snapshot = await getDocs(qRef);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
};
