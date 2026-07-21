import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AuthContext from "../../context/AuthContext.jsx";
import { replaceEmployees } from "../../utils/employeeStorage.js";
import { replaceAbsenceIndicator } from "../../utils/absenceIndicatorStorage.js";

vi.mock("../../services/appMode.js", () => ({
  DATA_PROVIDERS: { local: "local", firebase: "firebase" },
  getDataProvider: () => "firebase",
  isFirebaseProvider: () => true,
}));

import Dashboard from "../Dashboard.jsx";

describe("Dashboard Firebase agregado para Gerencia", () => {
  beforeEach(() => {
    localStorage.clear();
    replaceEmployees([
      {
        employeeId: "LEG-001",
        fullName: "Empleado Uno",
        sector: "Produccion",
        active: true,
        hireDate: "2020-01-01",
      },
      {
        employeeId: "LEG-002",
        fullName: "Empleado Dos",
        sector: "Ventas",
        active: true,
        hireDate: "2020-01-01",
      },
    ]);
    replaceAbsenceIndicator({
      version: "absence-indicator-v1",
      periods: [
        {
          period: "2026-07",
          absenceCount: 4,
          daysLost: 12,
          sectors: [
            {
              sector: "Produccion",
              absenceCount: 3,
              daysLost: 10,
              types: [],
            },
            {
              sector: "Ventas",
              absenceCount: 1,
              daysLost: 2,
              types: [],
            },
          ],
          types: [],
        },
      ],
    });
  });

  it("muestra dias y ausencias agregadas sin leer registros individuales", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthContext.Provider
          value={{
            role: "gerente",
            isAuthenticated: true,
            allowedRoutes: ["dashboard"],
            user: { fullName: "Gerente Prueba", roleLabel: "Gerente" },
            logout: vi.fn(),
          }}
        >
          <Dashboard isDark={false} onToggleTheme={vi.fn()} />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    const absenceCard = screen.getByText("Tasa de Ausentismo").closest("article");
    expect(absenceCard).not.toBeNull();
    expect(within(absenceCard).getByText("12")).toBeInTheDocument();

    const productionCard = screen.getByText("Produccion").closest("button");
    expect(productionCard).not.toBeNull();
    expect(within(productionCard).getByText(/3 ausencias/i)).toBeInTheDocument();
  });
});
