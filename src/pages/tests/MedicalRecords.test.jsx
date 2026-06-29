import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MedicalRecords from "../MedicalRecords.jsx";
import { mockEmployees } from "../../data/mockEmployees.js";
import {
  MEDICAL_HISTORY_STORAGE_KEY,
  MEDICAL_HISTORY_UPDATED_EVENT,
} from "../../utils/storageKeys.js";

vi.mock("../../components/AppHeader.jsx", () => ({
  default: () => <div data-testid="app-header">Header Mock</div>,
}));

const renderPage = () =>
  render(<MedicalRecords isDark={false} onToggleTheme={vi.fn()} />);

const [firstEmployee, secondEmployee, thirdEmployee] = mockEmployees;

describe("Funcionalidad de Legajos Medicos", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("muestra los datos del perfil por defecto", () => {
    renderPage();
    expect(
      screen.getByText(new RegExp(`Legajo #${firstEmployee.employeeId}`, "i"))
    ).toBeInTheDocument();
    expect(screen.getByText(firstEmployee.fullName)).toBeInTheDocument();
    expect(
      screen.getByText(firstEmployee.position, { exact: false })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Chequeo clinico general/i)
    ).toBeInTheDocument();
  });

  it("filtra y muestra otro legajo al escribir un nombre valido", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = screen.getByPlaceholderText(/Escribe el nombre/i);
    await user.clear(searchInput);
    await user.type(searchInput, secondEmployee.fullName);

    expect(
      screen.getByText(new RegExp(`Legajo #${secondEmployee.employeeId}`, "i"))
    ).toBeInTheDocument();
    expect(screen.getByText(secondEmployee.fullName)).toBeInTheDocument();
    expect(screen.getByText(/Control cardiovascular/i)).toBeInTheDocument();
  });

  it("restaura el ultimo legajo valido al perder el foco con un nombre inexistente", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = screen.getByPlaceholderText(/Escribe el nombre/i);
    await user.clear(searchInput);
    await user.type(searchInput, secondEmployee.fullName);
    expect(searchInput).toHaveValue(secondEmployee.fullName);

    await user.clear(searchInput);
    await user.type(searchInput, "Nombre invalido");
    fireEvent.blur(searchInput);

    expect(searchInput).toHaveValue(secondEmployee.fullName);
  });

  it("incluye todos los empleados en el datalist de busqueda", () => {
    renderPage();
    const dataList = document.getElementById("medical-records-employees");
    expect(dataList).not.toBeNull();
    const values = Array.from(dataList.querySelectorAll("option")).map(
      (option) => option.value
    );

    expect(values).toEqual(
      expect.arrayContaining([
        firstEmployee.fullName,
        secondEmployee.fullName,
        thirdEmployee.fullName,
      ])
    );
  });

  it("permite organizar el listado de empleados por sector", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Ver todos los empleados/i }));
    const lastNameButton = screen.getByRole("button", {
      name: /Apellido y nombre/i,
    });
    const sectorButton = screen.getByRole("button", { name: /^Sector$/i });

    expect(lastNameButton).toHaveAttribute("aria-pressed", "true");

    await user.click(sectorButton);

    expect(sectorButton).toHaveAttribute("aria-pressed", "true");
    expect(lastNameButton).toHaveAttribute("aria-pressed", "false");
  });

  it("actualiza certificados presentados cuando cambia el historial almacenado", async () => {
    renderPage();

    act(() => {
      window.localStorage.setItem(
        MEDICAL_HISTORY_STORAGE_KEY,
        JSON.stringify({
          [firstEmployee.employeeId]: [
            {
              id: "CM-TEST-001",
              reference: "CM-TEST-001",
              title: "Reposo medico validado",
              issued: new Date().toISOString(),
              status: "Validado",
              institution: "Clinica Test",
              days: 2,
              notes: "Registro cargado desde historial",
            },
          ],
        }),
      );
      window.dispatchEvent(new Event(MEDICAL_HISTORY_UPDATED_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByText(/Reposo medico validado/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Referencia: CM-TEST-001/i)).toBeInTheDocument();
  });

  it("mantiene certificados presentados en el ano actual aunque la fecha medica sea anterior", async () => {
    const user = userEvent.setup();
    renderPage();

    act(() => {
      window.localStorage.setItem(
        MEDICAL_HISTORY_STORAGE_KEY,
        JSON.stringify({
          [firstEmployee.employeeId]: [
            {
              id: "CM-202606271602-782",
              reference: "CM-202606271602-782",
              title: "Certificado Medico - Enfermedad",
              issued: "2025-12-31",
              startDate: "2025-12-31",
              status: "Validado",
              institution: "Sanatorio Central",
              days: 6,
              notes: "Dolor lumbar",
              pathologyCategory: "musculoesqueletica",
            },
          ],
        }),
      );
      window.dispatchEvent(new Event(MEDICAL_HISTORY_UPDATED_EVENT));
    });

    await user.selectOptions(
      screen.getByLabelText(/Seleccionar periodo/i),
      "year",
    );

    expect(
      await screen.findByText(/Certificado Medico - Enfermedad/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Referencia: CM-202606271602/i),
    ).toBeInTheDocument();
  });

  it("muestra el 1 de enero sin corrimiento al dia anterior", async () => {
    renderPage();

    act(() => {
      window.localStorage.setItem(
        MEDICAL_HISTORY_STORAGE_KEY,
        JSON.stringify({
          [firstEmployee.employeeId]: [
            {
              id: "CM-202601011030-123",
              reference: "CM-202601011030-123",
              title: "Certificado de inicio de ano",
              issued: "2026-01-01",
              startDate: "2026-01-01",
              status: "Validado",
              institution: "Clinica Test",
              days: 1,
              notes: "Control",
            },
          ],
        }),
      );
      window.dispatchEvent(new Event(MEDICAL_HISTORY_UPDATED_EVENT));
    });

    expect(
      await screen.findByText(/Certificado de inicio de ano/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/01\/01\/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/31\/12\/2025/)).not.toBeInTheDocument();
  });
});
