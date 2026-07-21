import { describe, expect, it } from "vitest";
import { buildDashboardReportCsv } from "./dashboardReport.js";

describe("reporte agregado del dashboard", () => {
  it("incluye metricas, sectores y prevalencia sin datos clinicos individuales", () => {
    const csv = buildDashboardReportCsv({
      periodLabel: "julio 2026",
      generatedAt: "20/7/2026, 21:00:00",
      nombreCompleto: "Nicolas Caamano",
      diagnostico: "Dolor lumbar agudo",
      cie10: "M25.5",
      downloadUrl: "https://storage.example/certificado.pdf",
      metrics: [
        {
          title: "Tasa de Ausentismo",
          value: "1.3%",
          primaryLabel: "Dias perdidos",
          primaryValue: 22,
          secondaryLabel: "Dias Trabajados",
          secondaryValue: 1755,
        },
      ],
      sectors: [
        {
          sector: "Produccion",
          absenceCount: 3,
          daysLost: 11,
          avgRisk: 6.6,
          alerts: 1,
        },
      ],
      prevalence: [
        {
          label: "Enfermedades respiratorias",
          count: 3,
          days: 11,
          percentage: 60,
        },
      ],
    });

    expect(csv).toContain("Tasa de Ausentismo");
    expect(csv).toContain("Produccion");
    expect(csv).toContain("Enfermedades respiratorias");
    expect(csv).not.toContain("Nicolas Caamano");
    expect(csv).not.toContain("Dolor lumbar agudo");
    expect(csv).not.toContain("M25.5");
    expect(csv).not.toContain("https://storage.example");
  });

  it("neutraliza valores que una planilla podria interpretar como formula", () => {
    const csv = buildDashboardReportCsv({
      periodLabel: "=CMD()",
      generatedAt: "20/7/2026",
    });

    expect(csv).toContain("'=CMD()");
  });
});
