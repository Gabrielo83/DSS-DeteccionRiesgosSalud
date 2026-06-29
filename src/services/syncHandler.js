import { isFirebaseProvider } from "./appMode.js";

const hasNavigator = () => typeof navigator !== "undefined";

const simulateLocalSync = async () => {
  const isOffline = hasNavigator() && navigator.onLine === false;
  if (isOffline) {
    return { ok: false, reason: "offline" };
  }
  await new Promise((resolve) => setTimeout(resolve, 20));
  return { ok: true };
};

export const syncOperation = async (operation) => {
  if (!isFirebaseProvider()) {
    return simulateLocalSync(operation);
  }
  const { syncOperationToFirestore } = await import(
    "./firebase/firestoreRepository.js"
  );
  return syncOperationToFirestore(operation);
};
