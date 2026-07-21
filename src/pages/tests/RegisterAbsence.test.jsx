import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterAbsence from "../RegisterAbsence.jsx";
import { mockEmployees } from "../../data/mockEmployees.js";
import AuthContext from "../../context/AuthContext.jsx";

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

const renderPage = (role = "administrativoSalud") =>
  render(
    <AuthContext.Provider
      value={{
        role,
        user: {
          uid: `uid-${role}`,
          email: `${role}@example.test`,
          fullName: "Usuario de prueba",
        },
      }}
    >
      <RegisterAbsence isDark={false} onToggleTheme={vi.fn()} />
    </AuthContext.Provider>,
  );

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

  it("ofrece acceso al historial completo del colaborador seleccionado", async () => {
    const user = userEvent.setup();
    renderPage();

    const nameInput = screen.getByPlaceholderText(
      /Escribe el nombre del empleado/i
    );
    await user.type(nameInput, firstEmployee.fullName);

    const historyLink = screen.getByRole("link", {
      name: /Ver historial completo/i,
    });
    expect(historyLink).toHaveAttribute(
      "href",
      `/legajos-medicos?employeeId=${firstEmployee.employeeId}`,
    );
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

    const startInput = screen.getByTestId("start-date-input");
    const endInput = screen.getByTestId("end-date-input");

    await user.type(startInput, "2025-02-01");
    await user.type(endInput, "2025-02-05");

    expect(
      screen.getByText(
        (text) =>
          text.toLowerCase().includes("duracion estimada") &&
          text.includes("5")
      )
    ).toBeInTheDocument();
  });

  it("reserva certificados e informacion clinica al administrativo de salud", async () => {
    const user = userEvent.setup();
    renderPage("administrativo");

    const typeSelect = screen.getByTestId("dropdown-absenceType");
    expect(typeSelect).not.toHaveTextContent("Certificado Medico");
    expect(screen.queryByText("Codigo CIE-10 (opcional)")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Certificados en revision/i }),
    ).not.toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/Escribe el nombre del empleado/i),
      firstEmployee.fullName,
    );
    expect(
      screen.queryByRole("heading", {
        name: /Certificados recientes del colaborador/i,
      }),
    ).not.toBeInTheDocument();
  });

  it.each([
    "vacaciones",
    "permiso-especial",
    "licencia-personal",
  ])(
    "registra %s sin crear una validacion medica",
    async (absenceType) => {
      const user = userEvent.setup();
      renderPage();

      await user.type(
        screen.getByPlaceholderText(/Escribe el nombre del empleado/i),
        firstEmployee.fullName,
      );
      await user.selectOptions(
        screen.getByTestId("dropdown-absenceType"),
        absenceType,
      );
      await user.type(screen.getByTestId("start-date-input"), "2026-08-03");
      await user.type(screen.getByTestId("end-date-input"), "2026-08-07");
      await user.click(
        screen.getByRole("button", { name: /Enviar para Aprobacion/i }),
      );

      const absences = JSON.parse(
        localStorage.getItem("app_absences") || "[]",
      );
      expect(absences).toHaveLength(1);
      expect(absences[0]).toMatchObject({
        employeeId: firstEmployee.employeeId,
        absenceType,
        absenceDays: 5,
        requiresCertificate: false,
      });
      expect(localStorage.getItem("app_medical_validations")).toBeNull();
    },
  );

  it("persiste una ausencia general reanudada desde un borrador", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByPlaceholderText(/Escribe el nombre del empleado/i),
      firstEmployee.fullName,
    );
    await user.selectOptions(
      screen.getByTestId("dropdown-absenceType"),
      "permiso-especial",
    );
    await user.type(screen.getByTestId("start-date-input"), "2026-09-14");
    await user.type(screen.getByTestId("end-date-input"), "2026-09-15");
    await user.click(screen.getByRole("button", { name: /Guardar Borrador/i }));
    await user.click(
      screen.getByRole("button", { name: /Reanudar borrador/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /Enviar para Aprobacion/i }),
    );

    const absences = JSON.parse(localStorage.getItem("app_absences") || "[]");
    const drafts = JSON.parse(
      localStorage.getItem("app_absence_drafts") || "[]",
    );
    expect(absences).toHaveLength(1);
    expect(absences[0]).toMatchObject({
      employeeId: firstEmployee.employeeId,
      absenceType: "permiso-especial",
      absenceDays: 2,
      requiresCertificate: false,
    });
    expect(drafts).toEqual([]);
    expect(localStorage.getItem("app_medical_validations")).toBeNull();
  });
});
