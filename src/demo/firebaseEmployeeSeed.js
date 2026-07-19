import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { mockEmployees } from "../data/mockEmployees.js";
import { isFirebaseProvider } from "../services/appMode.js";
import { getFirebaseServices } from "../services/firebase/firebaseClient.js";
import { mapEmpleadoToFirestore } from "../utils/firestoreMappings.js";

const isBrowser = () => typeof window !== "undefined";

const buildEmployeePayload = (employee) => ({
  ...mapEmpleadoToFirestore(employee),
  origen: "dataset-controlado-tfg",
  actualizadoEn: serverTimestamp(),
});

export const seedFirebaseEmployees = async () => {
  if (!isFirebaseProvider()) {
    throw new Error("El seed remoto requiere VITE_DATA_PROVIDER=firebase.");
  }

  const { auth, db } = getFirebaseServices();
  if (!auth.currentUser) {
    throw new Error("Inicia sesion antes de cargar empleados en Firebase.");
  }

  const batch = writeBatch(db);
  mockEmployees.forEach((employee) => {
    batch.set(
      doc(db, "empleados", employee.employeeId),
      buildEmployeePayload(employee),
      { merge: true },
    );
  });
  await batch.commit();

  return {
    ok: true,
    collection: "empleados",
    count: mockEmployees.length,
    user: auth.currentUser.email,
  };
};

if (isBrowser()) {
  window.seedFirebaseEmployees = seedFirebaseEmployees;
}
