import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBlob, ref } from "firebase/storage";
import { isFirebaseProvider } from "../appMode.js";
import {
  hasCertificateDocument,
  loadCertificatePreview,
  releaseCertificatePreview,
} from "./certificateStorage.js";

vi.mock("firebase/storage", () => ({
  getBlob: vi.fn(),
  ref: vi.fn((_storage, path) => ({ path })),
}));

vi.mock("../appMode.js", () => ({
  isFirebaseProvider: vi.fn(),
}));

vi.mock("./firebaseClient.js", () => ({
  getFirebaseServices: vi.fn(() => ({ storage: { name: "storage" } })),
}));

describe("certificateStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:certificado-seguro"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("reconoce documentos locales, remotos y heredados", () => {
    expect(hasCertificateDocument({ previewUrl: "data:image/png;base64,AA==" })).toBe(true);
    expect(hasCertificateDocument({ storagePath: "certificados/ref/doc.pdf" })).toBe(true);
    expect(hasCertificateDocument({ downloadUrl: "https://legacy.example/doc" })).toBe(true);
    expect(hasCertificateDocument(null)).toBe(false);
  });

  it("conserva una vista local sin consultar Firebase", async () => {
    const result = await loadCertificatePreview({
      previewUrl: "data:application/pdf;base64,AA==",
    });

    expect(result.previewUrl).toContain("data:application/pdf");
    expect(result.revokePreview).toBe(false);
    expect(getBlob).not.toHaveBeenCalled();
  });

  it("descarga el archivo remoto mediante el SDK autenticado", async () => {
    isFirebaseProvider.mockReturnValue(true);
    getBlob.mockResolvedValue(new Blob(["certificado"], { type: "application/pdf" }));

    const result = await loadCertificatePreview({
      storagePath: "certificados/CM-001/documento.pdf",
      type: "application/pdf",
    });

    expect(ref).toHaveBeenCalledWith(
      { name: "storage" },
      "certificados/CM-001/documento.pdf",
    );
    expect(getBlob).toHaveBeenCalledTimes(1);
    expect(result.previewUrl).toBe("blob:certificado-seguro");
    expect(result.revokePreview).toBe(true);
  });

  it("libera solamente las vistas temporales creadas desde blobs", () => {
    releaseCertificatePreview({
      previewUrl: "blob:certificado-seguro",
      revokePreview: true,
    });
    releaseCertificatePreview({
      previewUrl: "https://legacy.example/doc",
      revokePreview: false,
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:certificado-seguro");
  });
});
