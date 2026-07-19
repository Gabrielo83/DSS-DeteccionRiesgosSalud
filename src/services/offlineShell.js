const isEnabled = () =>
  import.meta.env.PROD &&
  String(import.meta.env.VITE_ENABLE_OFFLINE_SHELL || "").toLowerCase() ===
    "true";

export const registerOfflineShell = async () => {
  if (!isEnabled() || typeof navigator === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/offline-shell-sw.js", {
    scope: "/",
  });
};
