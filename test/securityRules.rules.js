import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";

const PROJECT_ID = "dss-ausentismo";
const USERS = {
  superAdmin: "uid-superadmin",
  medico: "uid-medico",
  administrativo: "uid-administrativo",
  administrativoSalud: "uid-administrativo-salud",
  respRRHH: "uid-rrhh",
  gerente: "uid-gerente",
};

let testEnvironment;

const contextFor = (role) =>
  testEnvironment.authenticatedContext(USERS[role], {
    email: `${role}@example.test`,
  });

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await testEnvironment.clearStorage();
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all(
      Object.entries(USERS).map(([role, uid]) =>
        setDoc(doc(db, "usuarios", uid), {
          uid,
          email: `${role}@example.test`,
          nombreVisible: role,
          rol: role,
        }),
      ),
    );
    await Promise.all([
      setDoc(doc(db, "empleados", "LEG-001"), {
        employeeId: "LEG-001",
        nombreCompleto: "Empleado confidencial",
        tipoSangre: "A+",
      }),
      setDoc(doc(db, "ausencias", "AUS-001"), {
        absenceId: "AUS-001",
        employeeId: "LEG-001",
        tipo: "vacaciones",
      }),
      setDoc(doc(db, "validaciones_medicas", "CM-001"), {
        reference: "CM-001",
        estado: "pendiente",
        diagnostico: "Dato clinico",
      }),
      setDoc(doc(db, "indicadores_ausentismo", "global"), {
        version: "absence-indicator-v2",
        periodos: [],
      }),
      setDoc(doc(db, "borradores", "BOR-OWNER"), {
        draftId: "BOR-OWNER",
        ownerUid: USERS.administrativoSalud,
        diagnostico: "Dato pendiente",
      }),
      setDoc(doc(db, "borradores", "BOR-LEGACY"), {
        draftId: "BOR-LEGACY",
        guardadoPor: "administrativoSalud",
        diagnostico: "Dato legacy pendiente",
      }),
      setDoc(doc(db, "operations", "OP-OWNER"), {
        id: "OP-OWNER",
        ownerUid: USERS.administrativoSalud,
        type: "submitCertificate",
      }),
      setDoc(doc(db, "operations", "OP-LEGACY"), {
        id: "OP-LEGACY",
        user: "administrativoSalud@example.test",
        type: "submitCertificate",
        payload: { diagnostico: "Dato legacy que debe eliminarse" },
      }),
    ]);
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe("autorizacion por rol", () => {
  it("Gerencia consume indicadores pero no legajos ni validaciones", async () => {
    const db = contextFor("gerente").firestore();
    await assertSucceeds(getDoc(doc(db, "indicadores_ausentismo", "global")));
    await assertFails(getDoc(doc(db, "empleados", "LEG-001")));
    await assertFails(getDoc(doc(db, "validaciones_medicas", "CM-001")));
  });

  it("RRHH accede a ausencias pero no crea validaciones medicas", async () => {
    const db = contextFor("respRRHH").firestore();
    await assertSucceeds(getDoc(doc(db, "ausencias", "AUS-001")));
    await assertFails(
      setDoc(doc(db, "validaciones_medicas", "CM-RRHH"), {
        reference: "CM-RRHH",
        estado: "pendiente",
      }),
    );
  });

  it("reserva la recepcion de certificados al administrativo de salud", async () => {
    const commonAdminDb = contextFor("administrativo").firestore();
    const healthAdminDb = contextFor("administrativoSalud").firestore();
    await assertFails(
      setDoc(doc(commonAdminDb, "validaciones_medicas", "CM-ADMIN"), {
        reference: "CM-ADMIN",
        estado: "pendiente",
      }),
    );
    await assertSucceeds(
      setDoc(doc(healthAdminDb, "validaciones_medicas", "CM-SALUD"), {
        reference: "CM-SALUD",
        estado: "pendiente",
      }),
    );
  });

  it("los roles clinicos leen validaciones y un administrativo comun no", async () => {
    await assertSucceeds(
      getDoc(
        doc(
          contextFor("administrativoSalud").firestore(),
          "validaciones_medicas",
          "CM-001",
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          contextFor("administrativo").firestore(),
          "validaciones_medicas",
          "CM-001",
        ),
      ),
    );
  });

  it("aisla borradores y operaciones por propietario", async () => {
    const ownerDb = contextFor("administrativoSalud").firestore();
    const otherDb = contextFor("medico").firestore();
    await assertSucceeds(getDoc(doc(ownerDb, "borradores", "BOR-OWNER")));
    await assertFails(getDoc(doc(otherDb, "borradores", "BOR-OWNER")));
    await assertSucceeds(getDoc(doc(ownerDb, "operations", "OP-OWNER")));
    await assertFails(getDoc(doc(otherDb, "operations", "OP-OWNER")));
    await assertSucceeds(
      getDocs(
        collection(
          contextFor("superAdmin").firestore(),
          "operations",
        ),
      ),
    );
  });

  it("permite que el usuario original adopte una operacion antigua", async () => {
    const ownerDb = contextFor("administrativoSalud").firestore();
    const otherDb = contextFor("medico").firestore();
    const legacyPath = doc(ownerDb, "operations", "OP-LEGACY");
    await assertSucceeds(
      setDoc(
        legacyPath,
        {
          ownerUid: USERS.administrativoSalud,
          syncStatus: "synced",
          payload: deleteField(),
        },
        { merge: true },
      ),
    );
    await assertFails(
      setDoc(
        doc(otherDb, "operations", "OP-LEGACY"),
        { ownerUid: USERS.medico },
        { merge: true },
      ),
    );
  });

  it("rechaza payloads en operations y permite sanear una operacion legacy", async () => {
    const ownerDb = contextFor("administrativoSalud").firestore();
    await assertFails(
      setDoc(doc(ownerDb, "operations", "OP-CON-PAYLOAD"), {
        id: "OP-CON-PAYLOAD",
        type: "submitCertificate",
        ownerUid: USERS.administrativoSalud,
        payload: { diagnostico: "No debe persistir" },
      }),
    );

    const legacyPath = doc(ownerDb, "operations", "OP-LEGACY");
    await assertSucceeds(
      setDoc(
        legacyPath,
        {
          ownerUid: USERS.administrativoSalud,
          syncStatus: "synced",
          payload: deleteField(),
        },
        { merge: true },
      ),
    );
    const sanitized = await getDoc(legacyPath);
    expect(sanitized.data()).not.toHaveProperty("payload");
  });

  it("permite al superAdmin asignar propietario a un borrador legacy", async () => {
    const superAdminDb = contextFor("superAdmin").firestore();
    const ownerDb = contextFor("administrativoSalud").firestore();
    const legacyPath = doc(superAdminDb, "borradores", "BOR-LEGACY");

    await assertFails(getDoc(doc(ownerDb, "borradores", "BOR-LEGACY")));
    await assertSucceeds(
      setDoc(
        legacyPath,
        {
          ownerUid: USERS.administrativoSalud,
        },
        { merge: true },
      ),
    );
    await assertSucceeds(getDoc(doc(ownerDb, "borradores", "BOR-LEGACY")));
  });
});

describe("certificados en Storage", () => {
  const validPdf = new Uint8Array([37, 80, 68, 70]);
  const metadataFor = (uid) => ({
    contentType: "application/pdf",
    customMetadata: { uploaderUid: uid },
  });

  it("permite PDF, JPEG y PNG al administrativo de salud", async () => {
    const clinicalStorage = contextFor("administrativoSalud").storage();
    await assertSucceeds(
      uploadBytes(
        ref(clinicalStorage, "certificados/CM-OK/certificado.pdf"),
        validPdf,
        metadataFor(USERS.administrativoSalud),
      ),
    );
    await assertSucceeds(
      uploadBytes(
        ref(clinicalStorage, "certificados/CM-JPEG/certificado.jpg"),
        new Uint8Array([255, 216, 255]),
        {
          contentType: "image/jpeg",
          customMetadata: { uploaderUid: USERS.administrativoSalud },
        },
      ),
    );
    await assertSucceeds(
      uploadBytes(
        ref(clinicalStorage, "certificados/CM-PNG/certificado.png"),
        new Uint8Array([137, 80, 78, 71]),
        {
          contentType: "image/png",
          customMetadata: { uploaderUid: USERS.administrativoSalud },
        },
      ),
    );
  });

  it("rechaza cargas de RRHH y del administrativo comun", async () => {
    const rrhhStorage = contextFor("respRRHH").storage();
    const commonAdminStorage = contextFor("administrativo").storage();
    await assertFails(
      uploadBytes(
        ref(rrhhStorage, "certificados/CM-RRHH/certificado.pdf"),
        validPdf,
        metadataFor(USERS.respRRHH),
      ),
    );
    await assertFails(
      uploadBytes(
        ref(commonAdminStorage, "certificados/CM-ADMIN/certificado.pdf"),
        validPdf,
        metadataFor(USERS.administrativo),
      ),
    );
  });

  it("rechaza tipos no permitidos y archivos mayores a 5 MB", async () => {
    const storage = contextFor("medico").storage();
    await assertFails(
      uploadBytes(
        ref(storage, "certificados/CM-TXT/archivo.txt"),
        new TextEncoder().encode("contenido"),
        {
          contentType: "text/plain",
          customMetadata: { uploaderUid: USERS.medico },
        },
      ),
    );
    await assertFails(
      uploadBytes(
        ref(storage, "certificados/CM-LARGE/certificado.pdf"),
        new Uint8Array(5 * 1024 * 1024 + 1),
        metadataFor(USERS.medico),
      ),
    );
  });
});
