import { isFirebaseProvider } from "./appMode.js";
import { syncOperationToFirestore } from "./firebase/firestoreRepository.js";

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
  return syncOperationToFirestore(operation);
};
