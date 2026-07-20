import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transactionSet: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  runTransaction: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  deleteDoc: vi.fn(),
  deleteField: vi.fn(() => ({ _methodName: "deleteField" })),
  doc: vi.fn((_db, ...segments) => segments.join("/")),
  getDoc: vi.fn().mockResolvedValue({ data: () => ({}) }),
  runTransaction: mocks.runTransaction,
  serverTimestamp: vi.fn(() => ({ _methodName: "serverTimestamp" })),
  setDoc: mocks.setDoc,
}));

vi.mock("firebase/storage", () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
}));

vi.mock("./firebaseClient.js", () => ({
  getFirebaseServices: () => ({
    auth: { currentUser: { uid: "uid-rrhh" } },
    db: { name: "db-test" },
    storage: { name: "storage-test" },
  }),
}));

vi.mock("../../utils/auditLog.js", () => ({
  appendAuditLog: vi.fn(),
}));

import { syncOperationToFirestore } from "./firestoreRepository.js";

describe("persistencia Firebase de ausencias generales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runTransaction.mockImplementation(async (_db, callback) =>
      callback({
        get: vi.fn().mockResolvedValue({ data: () => ({}) }),
        set: mocks.transactionSet,
      }),
    );
  });

  it("escribe la ausencia en su coleccion sin crear una validacion medica", async () => {
    const absence = {
      absenceId: "AUS-202609010900-101",
      employeeId: "LEG-010",
      employeeName: "Empleado Prueba",
      sector: "Produccion",
      position: "Operario",
      absenceType: "vacaciones",
      startDate: "2026-09-01",
      endDate: "2026-09-05",
      absenceDays: 5,
      requiresApproval: "Si",
      requiresCertificate: false,
      status: "registrada",
    };

    await syncOperationToFirestore({
      id: "op-absence-firebase",
      type: "submitAbsence",
      payload: { absenceId: absence.absenceId, absence },
      entityId: absence.absenceId,
      user: "rrhh@test",
      createdAt: "2026-08-20T12:00:00.000Z",
      retryCount: 0,
    });

    expect(mocks.transactionSet).toHaveBeenCalledTimes(1);
    const [documentPath, document] = mocks.transactionSet.mock.calls[0];
    expect(documentPath).toBe(`ausencias/${absence.absenceId}`);
    expect(document).toMatchObject({
      absenceId: absence.absenceId,
      employeeId: "LEG-010",
      tipo: "vacaciones",
      dias: 5,
      requiereCertificado: false,
      estado: "registrada",
      sourceOperationId: "op-absence-firebase",
    });
    expect(document).not.toHaveProperty("diagnostico", expect.any(String));
    expect(document).not.toHaveProperty("cie10", expect.any(String));
    expect(
      mocks.transactionSet.mock.calls.some(([path]) =>
        String(path).startsWith("validaciones_medicas/"),
      ),
    ).toBe(false);
  });
});
