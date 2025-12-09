import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterAbsence from "../RegisterAbsence.jsx";
import MedicalValidation from "../MedicalValidation.jsx";
import { mockEmployees } from "../../data/mockEmployees.js";
import { MEDICAL_VALIDATIONS_STORAGE_KEY } from "../../utils/storageKeys.js";

vi.mock("../../components/AppHeader.jsx", () => ({
  default: () => <div data-testid="app-header">Header Mock</div>,
}));

vi.mock("../../components/DropdownSelect.jsx", () => ({
  default: ({ name, value, onChange, options = [], placeholder = "Seleccionar" }) => (
    <select
      data-testid={`dropdown-${name}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

const firstEmployee = mockEmployees[0];

const seedRegisterAbsence = async () => {
  const user = userEvent.setup();
  const view = render(<RegisterAbsence isDark={false} onToggleTheme={vi.fn()} />);

  const nameInput = screen.getByPlaceholderText(/Escribe el nombre del empleado/i);
  await user.type(nameInput, firstEmployee.fullName);

  // DatePicker usa button; para tests expusimos inputs ocultos
  const startInput = screen.getByTestId("start-date-input");
  const endInput = screen.getByTestId("end-date-input");
  await user.type(startInput, "2025-03-01");
  await user.type(endInput, "2025-03-05");

  const absenceSelect = screen.getByTestId("dropdown-absenceType");
  await user.selectOptions(absenceSelect, "enfermedad");

  const pathologySelect = screen.getByTestId("dropdown-pathologyCategory");
  await user.selectOptions(pathologySelect, "musculoesqueletica");

  const detailedTextarea = screen.getByPlaceholderText(/Describe el diagnostico/i);
  await user.type(detailedTextarea, "Dolor lumbar intenso con reposo indicado.");

  const institutionInput = screen.getByPlaceholderText(/Hospital \/ Clinica donde se emitio/i);
  await user.type(institutionInput, "Clinica Integral Central");

  const fileInput = screen.getByLabelText(/Certificado digital/i);
  const mockFile = new File(["contenido-pdf"], "certificado_test.pdf", {
    type: "application/pdf",
  });
  await user.upload(fileInput, mockFile);

  await user.click(screen.getByRole("button", { name: /Enviar para Aprobacion/i }));

  // La app muestra feedback al enviar; se verifica por submissionFeedback en pantalla
  await screen.findByText(/Solicitud enviada para aprobacion/i);

  return view;
};

const readStoredValidations = () => {
  const raw = window.localStorage.getItem(MEDICAL_VALIDATIONS_STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
};

describe("Flujo integral Registro → Validacion", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persiste el certificado generado y lo muestra en la tabla de Validacion Medica", async () => {
    const registerView = await seedRegisterAbsence();

    const storedEntries = readStoredValidations();
    expect(storedEntries).toHaveLength(1);
    const [entry] = storedEntries;
    expect(entry.employee).toBe(firstEmployee.fullName);
    expect(entry.status).toBe("Pendiente");

    registerView.unmount();

    render(<MedicalValidation isDark={false} onToggleTheme={vi.fn()} />);

    const referenceCell = await screen.findByText(entry.reference);
    const row = referenceCell.closest("tr");
    expect(row).not.toBeNull();
    await waitFor(() => {
      expect(within(row).getByText(firstEmployee.fullName)).toBeInTheDocument();
      expect(within(row).getByText(/Pendiente/i)).toBeInTheDocument();
    });
  });
});
