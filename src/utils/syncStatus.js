export const DASHBOARD_SYNC_INTERVAL_MS = 150 * 1000;
export const DASHBOARD_SYNC_SUCCESS_EVENT = "dashboard-sync-success";

const isBrowser = () => typeof window !== "undefined";
const storageKeyFor = (source) => `app_dashboard_last_${source}_sync_at`;

export const readLastDashboardSync = (source = "firebase") => {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(storageKeyFor(source));
  if (!raw) return null;
  const value = new Date(raw);
  return Number.isNaN(value.getTime()) ? null : value;
};

export const recordDashboardSyncSuccess = (
  completedAt = new Date(),
  source = "firebase",
) => {
  if (!isBrowser()) return;
  const value =
    completedAt instanceof Date ? completedAt : new Date(completedAt);
  if (Number.isNaN(value.getTime())) return;
  const timestamp = value.toISOString();
  window.localStorage.setItem(storageKeyFor(source), timestamp);
  window.dispatchEvent(
    new CustomEvent(DASHBOARD_SYNC_SUCCESS_EVENT, {
      detail: { completedAt: timestamp, source },
    }),
  );
};
