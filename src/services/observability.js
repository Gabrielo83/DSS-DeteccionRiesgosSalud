import { isFirebaseProvider } from "./appMode.js";

const isBrowser = () => typeof window !== "undefined";

export const logAppEvent = async (eventName, params = {}) => {
  if (!eventName || !isFirebaseProvider() || !isBrowser()) return;
  try {
    const { getFirebaseAnalytics } = await import(
      "./firebase/firebaseClient.js"
    );
    const analytics = await getFirebaseAnalytics();
    if (!analytics) return;
    const { logEvent } = await import("firebase/analytics");
    logEvent(analytics, eventName, params);
  } catch (error) {
    console.warn("No se pudo registrar evento Analytics:", error);
  }
};

export const initializePerformanceMonitoring = async () => {
  if (!isFirebaseProvider() || !isBrowser()) return;
  try {
    const { getFirebasePerformance } = await import(
      "./firebase/firebaseClient.js"
    );
    await getFirebasePerformance();
  } catch (error) {
    console.warn("No se pudo iniciar Firebase Performance:", error);
  }
};
