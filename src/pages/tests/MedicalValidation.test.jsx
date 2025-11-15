import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MedicalValidation from "../MedicalValidation.jsx";
import mockEmployees from "../../data/mockEmployees.js";
import {
  MEDICAL_HISTORY_STORAGE_KEY,
  MEDICAL_VALIDATIONS_STORAGE_KEY,
} from "../../utils/storageKeys.js";

vi.mock("../../components/AppHeader.jsx", () => ({
  default: () => <div data-testid="app-header">Header Mock</div>,
}));

vi.mock("../../components/DropdownSelect.jsx", () => ({
  default: ({ name = "select", options = [], value, onChange }) => (
    <select
      data-testid={`dropdown-${name}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

const renderPage = () =>
  render(<MedicalValidation isDark={false} onToggleTheme={vi.fn()} />);

const TARGET_REFERENCE = "CM-2024-001234";
const BASE_EMPLOYEE_NAME = mockEmployees[0]?.fullName || /CM-2024-001234/;
const seedValidationEntries = () => {
  const employee = mockEmployees[0];
  const entry = {
    reference: TARGET_REFERENCE,
    employee: employee.fullName,
    employeeId: employee.employeeId,
    position: employee.position,
    sector: employee.sector,
    status: "Pendiente",
    priority: "Alta",
    submitted: "10/03/2025 10:00",
    badgeTone: "bg-rose-100 text-rose-700",
    detailedReason: "Dolor lumbar intenso con reposo indicado.",
    absenceDays: 3,
    absenceType: "enfermedad",
    certificateType: "Reposo medico",
    institution: "Clinica del Sur",
    startDate: "2025-03-10",
    endDate: "2025-03-12",
    notes: "Carga de prueba para validacion.",
    certificateFileMeta: {
      name: "CM-2024-001234.pdf",
      size: "0.40 MB",
      uploadedAt: "10/03/2025 10:00",
      type: "application/pdf",
      previewUrl: "data:application/pdf;base64,ZmFrZQ==",
    },
    receivedTimestamp: Date.now(),
  };
  window.localStorage.setItem(
    MEDICAL_VALIDATIONS_STORAGE_KEY,
    JSON.stringify([entry]),
  );
};

const openTargetCertificateModal = async (user) => {
  const reviewButtons = await screen.findAllByRole("button", { name: /Revisar/i });
  expect(reviewButtons.length).toBeGreaterThan(0);
  await user.click(reviewButtons[0]);
  await screen.findByText(/Validacion de Certificado Medico/i);
};

const getRowByReference = (reference) => {
  const cell = screen.getByText(new RegExp(reference, "i"));
  const row = cell.closest("tr");
  if (!row) {
    throw new Error(`No se encontro la fila para la referencia ${reference}`);
  }
  return row;
};

const expectRowStatus = async (reference, statusRegex) => {
  await waitFor(() => {
    const row = getRowByReference(reference);
    expect(within(row).getByText(statusRegex)).toBeInTheDocument();
  });
};

describe("Funcionalidad de Validacion Medica", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  it("muestra mensaje cuando no hay certificados en proceso", () => {
    renderPage();
    expect(
      screen.getByText(/Aun no hay certificados en proceso/i),
    ).toBeInTheDocument();
  });
  it("muestra las tarjetas resumen y el encabezado principal", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /Validacion Medica/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Pendientes/i)).toBeInTheDocument();
    expect(screen.getByText(/Validados/i)).toBeInTheDocument();
  });

  it("actualiza filtros de texto y selects, y permite limpiarlos", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = screen.getByPlaceholderText(/Empleado o numero de referencia/i);
    await user.type(searchInput, "CM-2024");
    expect(searchInput).toHaveValue("CM-2024");

    const statusSelect = screen.getByTestId("dropdown-status");
    const prioritySelect = screen.getByTestId("dropdown-priority");
    await user.selectOptions(statusSelect, "pendiente");
    await user.selectOptions(prioritySelect, "alta");
    expect(statusSelect).toHaveValue("pendiente");
    expect(prioritySelect).toHaveValue("alta");

    await user.click(screen.getByRole("button", { name: /Limpiar filtros/i }));
    expect(searchInput).toHaveValue("");
    expect(statusSelect).toHaveValue("todos");
    expect(prioritySelect).toHaveValue("todas");
  });

  it("renderiza la tabla de certificados con columnas y filas esperadas", () => {
    seedValidationEntries();
    renderPage();

    ;["Referencia", "Empleado", "Estado", "Prioridad", "Recibido", "Acciones"].forEach((header) => {
      expect(screen.getByRole("columnheader", { name: new RegExp(header, "i") })).toBeInTheDocument();
    });

    expect(screen.getByText(/CM-2024-001234/i)).toBeInTheDocument();
    const targetMatcher =
      typeof BASE_EMPLOYEE_NAME === "string"
        ? new RegExp(BASE_EMPLOYEE_NAME, "i")
        : BASE_EMPLOYEE_NAME;
    expect(screen.getByText(targetMatcher)).toBeInTheDocument();
  });

  it("gestiona historicos desde el gestor e importa datos en JSON", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole("button", { name: /Gestionar historicos/i }),
    );

    const textarea = await screen.findByPlaceholderText(/\{/);
    const payload =
      '{"EMP-777":[{"id":"HIST-1","title":"Demo","status":"Validado"}]}';
    await user.click(textarea);
    await user.paste(payload);

    await user.click(screen.getByRole("button", { name: /Importar JSON/i }));

    expect(
      await screen.findByText(/Importacion exitosa/i),
    ).toBeInTheDocument();

    const stored = JSON.parse(
      window.localStorage.getItem(MEDICAL_HISTORY_STORAGE_KEY),
    );
    expect(stored["EMP-777"]).toBeDefined();

    await user.click(
      screen.getByRole("button", { name: /Cerrar gestor de historicos/i }),
    );
  });

  it("abre el modal de historial y muestra registros anteriores", async () => {
    const user = userEvent.setup();
    seedValidationEntries();
    window.localStorage.setItem(
      MEDICAL_HISTORY_STORAGE_KEY,
      JSON.stringify({
        [mockEmployees[0].employeeId]: [
          {
            id: "HIS-001",
            title: "Control post operatorio",
            issued: "2024-05-12",
            days: 7,
            status: "Validado",
            document: "control_postop.pdf",
            institution: "Hospital Central",
            notes: "Alta sin restricciones.",
            reviewer: "Dr. Demo",
          },
        ],
      }),
    );
    renderPage();

    const historyButtons = screen.getAllByRole("button", { name: /Historial/i });
    expect(historyButtons.length).toBeGreaterThan(0);

    await user.click(historyButtons[0]);

    expect(
      await screen.findByText(/Historial medico/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Certificados previos/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Control post operatorio/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Dr. Demo/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Cerrar historial/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Historial medico/i)).not.toBeInTheDocument();
    });
  });

  it("deshabilita rechazar y aprobar hasta ingresar observaciones", async () => {
    const user = userEvent.setup();
    seedValidationEntries();
    renderPage();
    await openTargetCertificateModal(user);
    await user.click(screen.getByRole("button", { name: /Validacion/i }));

    const rejectButton = screen.getByRole("button", { name: /Rechazar/i });
    const approveButton = screen.getByRole("button", { name: /Aprobar/i });
    const notesTextarea = screen.getByPlaceholderText(/observaciones profesionales/i);

    expect(rejectButton).toBeDisabled();
    expect(approveButton).toBeDisabled();

    await user.type(notesTextarea, "Observacion medica de prueba");

    expect(rejectButton).not.toBeDisabled();
    expect(approveButton).not.toBeDisabled();
  });

  it("permite marcar para revision y actualiza el estado en la tabla", async () => {
    const user = userEvent.setup();
    seedValidationEntries();
    renderPage();
    await openTargetCertificateModal(user);
    await user.click(screen.getByRole("button", { name: /Validacion/i }));

    await user.click(screen.getByRole("button", { name: /Marcar para revision/i }));

    await expectRowStatus(TARGET_REFERENCE, /En Revision/i);
  });

  it("rechaza un certificado con observaciones y refleja el estado", async () => {
    const user = userEvent.setup();
    seedValidationEntries();
    renderPage();
    await openTargetCertificateModal(user);
    await user.click(screen.getByRole("button", { name: /Validacion/i }));

    const notesTextarea = screen.getByPlaceholderText(/observaciones profesionales/i);
    await user.type(notesTextarea, "El certificado no coincide con la historia clinica.");

    await user.click(screen.getByRole("button", { name: /Rechazar/i }));

    await expectRowStatus(TARGET_REFERENCE, /Rechazado/i);
  });

  it("aprueba un certificado con observaciones y refleja el estado", async () => {
    const user = userEvent.setup();
    seedValidationEntries();
    renderPage();
    await openTargetCertificateModal(user);
    await user.click(screen.getByRole("button", { name: /Validacion/i }));

    const notesTextarea = screen.getByPlaceholderText(/observaciones profesionales/i);
    await user.type(notesTextarea, "Se valida el certificado para los dias solicitados.");

    await user.click(screen.getByRole("button", { name: /Aprobar/i }));

    await expectRowStatus(TARGET_REFERENCE, /Validado/i);
    const historyRaw = window.localStorage.getItem(MEDICAL_HISTORY_STORAGE_KEY);
    const history = historyRaw ? JSON.parse(historyRaw) : {};
    const employeeKey = mockEmployees[0].employeeId;
    expect(history[employeeKey]).toBeDefined();
    expect(history[employeeKey].some((item) => /Validado/i.test(item.status))).toBe(
      true,
    );
  });
});
