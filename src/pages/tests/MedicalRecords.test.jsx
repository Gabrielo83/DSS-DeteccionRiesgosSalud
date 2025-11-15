import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MedicalRecords from "../MedicalRecords.jsx";
import { mockEmployees } from "../../data/mockEmployees.js";

vi.mock("../../components/AppHeader.jsx", () => ({
  default: () => <div data-testid="app-header">Header Mock</div>,
}));

const renderPage = () =>
  render(<MedicalRecords isDark={false} onToggleTheme={vi.fn()} />);

const [firstEmployee, secondEmployee, thirdEmployee] = mockEmployees;

describe("Funcionalidad de Legajos Medicos", () => {
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
});
