import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppHeader from "./AppHeader.jsx";
import AuthContext from "../context/AuthContext.jsx";
import { upsertAbsence } from "../utils/absenceStorage.js";

const authValue = {
  role: "respRRHH",
  isAuthenticated: true,
  allowedRoutes: ["dashboard", "registro"],
  user: {
    email: "rrhh@test",
    fullName: "Responsable RRHH",
    roleLabel: "Responsable RRHH",
  },
  logout: vi.fn(),
};

const renderHeader = () =>
  render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        <AppHeader
          active="Panel de Control"
          isDark={false}
          onToggleTheme={vi.fn()}
        />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("notificaciones administrativas para RRHH", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("actualiza la campanita al recibir una ausencia sin exponer datos clinicos", () => {
    renderHeader();
    expect(screen.queryByText("Nueva ausencia registrada")).not.toBeInTheDocument();

    upsertAbsence({
      absenceId: "AUS-REALTIME-001",
      employeeId: "LEG-020",
      employeeName: "Marcos Pereyra",
      sector: "Produccion",
      position: "Operario",
      absenceType: "licencia-personal",
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      absenceDays: 3,
      status: "registrada",
      submittedAt: "2026-08-20T12:00:00.000Z",
      diagnostico: "Dato que no debe mostrarse",
      cie10: "Z00.0",
      certificadoDigital: { nombre: "documento-secreto.pdf" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Notificaciones" }));

    expect(screen.getByText("Nueva ausencia registrada")).toBeInTheDocument();
    expect(screen.getByText("Marcos Pereyra - Licencia personal")).toBeInTheDocument();
    expect(
      screen.getByText("Produccion · 01/09/2026 - 03/09/2026 · 3 dias"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dato que no debe mostrarse")).not.toBeInTheDocument();
    expect(screen.queryByText("Z00.0")).not.toBeInTheDocument();
    expect(screen.queryByText("documento-secreto.pdf")).not.toBeInTheDocument();
  });

  it("deja de contar la notificacion cuando RRHH la atiende", () => {
    upsertAbsence({
      absenceId: "AUS-ACK-001",
      employeeName: "Empleado Prueba",
      sector: "Administracion",
      absenceType: "vacaciones",
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      absenceDays: 5,
      submittedAt: "2026-09-20T12:00:00.000Z",
    });
    renderHeader();

    const bell = screen.getByRole("button", { name: "Notificaciones" });
    expect(within(bell).getByText("1")).toBeInTheDocument();
    fireEvent.click(bell);
    fireEvent.click(screen.getByText("Nueva ausencia registrada"));

    expect(within(bell).queryByText("1")).not.toBeInTheDocument();
    expect(
      JSON.parse(
        window.localStorage.getItem("app_acknowledged_notifications") || "[]",
      ),
    ).toContain("absence:AUS-ACK-001");
  });
});
