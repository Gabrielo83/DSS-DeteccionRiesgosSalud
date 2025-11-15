import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MedicalCertificate from "../MedicalCertificate.jsx";

vi.mock("../../components/AppHeader.jsx", () => ({
  default: () => <div data-testid="app-header">Header Mock</div>,
}));

vi.mock("../../components/DropdownSelect.jsx", () => ({
  default: ({
    name = "select",
    options = [],
    value,
    onChange,
    placeholder,
  }) => (
    <select
      data-testid={`dropdown-${name}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder ?? "Seleccionar"}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

const renderPage = () =>
  render(<MedicalCertificate isDark={false} onToggleTheme={vi.fn()} />);

describe("Funcionalidad de Certificados Médicos", () => {
  it("muestra encabezados principales y cards de seccion", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /Carga de Certificado Medico/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Identificacion del Empleado/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Subida de Archivo/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Validacion y Fechas/i })
    ).toBeInTheDocument();
  });

  it("actualiza los selects de tipo de certificado y estado", async () => {
    const user = userEvent.setup();
    renderPage();

    const typeSelect = screen.getByTestId("dropdown-certificateType");
    expect(typeSelect).toHaveValue("");
    await user.selectOptions(typeSelect, "accidente-laboral");
    expect(typeSelect).toHaveValue("accidente-laboral");

    const statusSelect = screen.getByTestId("dropdown-status");
    expect(statusSelect).toHaveValue("pendiente");
    await user.selectOptions(statusSelect, "validado");
    expect(statusSelect).toHaveValue("validado");
  });

  it("muestra la tarjeta del archivo subido y permite eliminarla", async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    const fileInput = container.querySelector("#certificate-upload");
    const file = new File(["contenido"], "certificado.pdf", {
      type: "application/pdf",
    });

    await user.upload(fileInput, file);
    expect(screen.getByText("certificado.pdf")).toBeInTheDocument();

    const preview = screen.getByText("certificado.pdf").closest("div");
    const removeButton = screen.getByRole("button", {
      name: /Eliminar archivo/i,
    });
    await user.click(removeButton);

    expect(screen.queryByText("certificado.pdf")).toBeNull();
  });
});
