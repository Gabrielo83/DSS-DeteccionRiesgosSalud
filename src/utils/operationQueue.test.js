import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateRetryDelay,
  clearOperationQueue,
  enqueueOperation,
  processQueue,
  readOperationQueue,
} from "./operationQueue.js";

const setOnline = (online) => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
};

describe("operationQueue offline-first", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearOperationQueue();
    setOnline(true);
  });

  it("procesa solo operaciones de la sesion activa", async () => {
    enqueueOperation("saveDraft", {}, { id: "op-a", user: "a@empresa.com" });
    enqueueOperation("saveDraft", {}, { id: "op-b", user: "b@empresa.com" });
    const handler = vi.fn().mockResolvedValue({ ok: true });

    const result = await processQueue(handler, {
      ownerIds: ["a@empresa.com"],
    });

    expect(result.processed).toBe(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(readOperationQueue().map((item) => item.id)).toEqual(["op-b"]);
  });

  it("conserva la operacion mientras no hay conectividad", async () => {
    setOnline(false);
    enqueueOperation("saveDraft", {}, { id: "op-offline", user: "u@test" });
    const handler = vi.fn().mockResolvedValue({ ok: true });

    const result = await processQueue(handler, { ownerIds: ["u@test"] });

    expect(result.processed).toBe(0);
    expect(handler).not.toHaveBeenCalled();
    expect(readOperationQueue()).toHaveLength(1);
  });

  it("aplica backoff exponencial con limite", () => {
    expect(calculateRetryDelay(1)).toBe(5000);
    expect(calculateRetryDelay(2)).toBe(10000);
    expect(calculateRetryDelay(20)).toBe(5 * 60 * 1000);
  });

  it("marca conflictos como no reintentables", async () => {
    enqueueOperation("validateCertificate", {}, {
      id: "op-conflict",
      user: "medico@test",
    });
    const handler = vi.fn().mockResolvedValue({
      ok: false,
      reason: "sync-conflict",
      error: "Decision final existente",
      retryable: false,
    });

    const result = await processQueue(handler, {
      ownerIds: ["medico@test"],
    });

    expect(result.conflicts).toBe(1);
    expect(readOperationQueue()[0]).toMatchObject({
      id: "op-conflict",
      status: "conflict",
      nextAttemptAt: null,
    });
  });
});
