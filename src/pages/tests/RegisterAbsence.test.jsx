import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterAbsence from "../RegisterAbsence.jsx";
import { mockEmployees } from "../../data/mockEmployees.js";

vi.mock("../../components/AppHeader.jsx", () => ({
  default: () => <div data-testid="app-header">Header Mock</div>,
}));

vi.mock("../../components/DropdownSelect.jsx", () => ({
  default: ({
    name,
    value,
    onChange,
    options = [],
    placeholder = "Seleccionar",
  }) => (
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

const renderPage = () =>
  render(<RegisterAbsence isDark={false} onToggleTheme={vi.fn()} />);

const firstEmployee = mockEmployees[0];
const secondEmployee = mockEmployees[1];

const getInputByLabel = (labelText) => {
  const label = screen.getByText(labelText, { selector: "label" });
  const container = label.closest("div");
  if (!container) throw new Error(`No input container for ${labelText}`);
  const input = container.querySelector("input");
  if (!input) throw new Error(`No input for ${labelText}`);
  return input;
};

describe("Funcionalidad de Registro de Ausencias", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("muestra el encabezado y descripcion principal", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /Registro de Ausencia/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Formulario para registrar y gestionar ausencias de empleados/i
      )
    ).toBeInTheDocument();
  });

  it("autocompleta los campos del empleado al ingresar un nombre valido", async () => {
    const user = userEvent.setup();
    renderPage();

    const nameInput = screen.getByPlaceholderText(
      /Escribe el nombre del empleado/i
    );
    await user.type(nameInput, firstEmployee.fullName);

    expect(
      screen.getByDisplayValue(firstEmployee.employeeId)
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(firstEmployee.sector)
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(firstEmployee.position)
    ).toBeInTheDocument();
  });

  it("limpia los campos dependientes cuando el nombre no coincide", async () => {
    const user = userEvent.setup();
    renderPage();

    const nameInput = screen.getByPlaceholderText(
      /Escribe el nombre del empleado/i
    );
    await user.type(nameInput, "Nombre Desconocido");

    const idInput = getInputByLabel("ID Empleado");
    const deptInput = screen.getByPlaceholderText("Sector asignado");
    const jobInput = screen.getByPlaceholderText("Posicion asignada");

    expect(idInput).toHaveValue("");
    expect(deptInput).toHaveValue("");
    expect(jobInput).toHaveValue("");
  });

  it("incluye todas las opciones del listado de empleados en el datalist", () => {
    renderPage();
    const dataList = document.getElementById("employee-options");
    expect(dataList).not.toBeNull();
    const options = Array.from(dataList.querySelectorAll("option")).map(
      (option) => option.value
    );

    expect(options).toEqual(
      expect.arrayContaining([
        firstEmployee.fullName,
        secondEmployee.fullName,
        mockEmployees[10].fullName,
      ])
    );
  });

  it("muestra la card de certificado medico cuando la ausencia lo requiere", async () => {
    const user = userEvent.setup();
    renderPage();

    const typeSelect = screen.getByTestId("dropdown-absenceType");
    await user.selectOptions(typeSelect, "enfermedad");

    expect(
      screen.getByRole("heading", { name: /Certificado Medico Digital/i })
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Hospital \/ Clinica donde se emitio/i)
    ).toBeInTheDocument();
  });

  it("calcula la cantidad de dias entre fecha de inicio y fin", async () => {
    const user = userEvent.setup();
    renderPage();

    const startInput = screen.getByLabelText(/Fecha de Inicio/i);
    const endInput = screen.getByLabelText(/Fecha de Fin/i);

    await user.type(startInput, "2025-02-01");
    await user.type(endInput, "2025-02-05");

    expect(
      screen.getByText(/Duracion estimada: 5 dias/i)
    ).toBeInTheDocument();
  });
});
