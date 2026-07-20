import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DASHBOARD_SYNC_SUCCESS_EVENT,
  readLastDashboardSync,
  recordDashboardSyncSuccess,
} from "./syncStatus.js";

describe("syncStatus", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("registra y publica la ultima sincronizacion completa", () => {
    const listener = vi.fn();
    window.addEventListener(DASHBOARD_SYNC_SUCCESS_EVENT, listener);
    const completedAt = new Date("2026-07-20T10:30:00.000Z");

    recordDashboardSyncSuccess(completedAt);

    expect(readLastDashboardSync("firebase")?.toISOString()).toBe(
      completedAt.toISOString(),
    );
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].detail.completedAt).toBe(
      completedAt.toISOString(),
    );
    expect(listener.mock.calls[0][0].detail.source).toBe("firebase");
    window.removeEventListener(DASHBOARD_SYNC_SUCCESS_EVENT, listener);
  });

  it("ignora una marca temporal local invalida", () => {
    window.localStorage.setItem(
      "app_dashboard_last_firebase_sync_at",
      "sin-fecha",
    );
    expect(readLastDashboardSync("firebase")).toBeNull();
  });
});
