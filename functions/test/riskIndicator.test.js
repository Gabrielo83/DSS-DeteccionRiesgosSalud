import assert from "node:assert/strict";
import test from "node:test";
import { buildRiskIndicator } from "../src/riskIndicator.js";

test("agrega riesgo mensual y sectorial sin datos personales", () => {
  const result = buildRiskIndicator([
    {
      estadoFinal: "validado",
      fechaInicio: "2026-06-03",
      riesgoPuntaje: 8,
      dias: 2,
      sector: "Produccion",
      nombreCompleto: "Dato sensible",
    },
    {
      estadoFinal: "validado",
      fechaInicio: "2026-06-18",
      riesgoPuntaje: 4,
      dias: 4,
      sector: "Logistica",
    },
    {
      estadoFinal: "rechazado",
      fechaInicio: "2026-06-20",
      riesgoPuntaje: 10,
      dias: 5,
      sector: "Produccion",
    },
  ]);

  assert.equal(result.periodos.length, 1);
  assert.deepEqual(result.periodos[0], {
    periodo: "2026-06",
    certificados: 2,
    diasPerdidos: 6,
    promedioRiesgo: 6,
    sectores: [
      {
        sector: "Logistica",
        certificados: 1,
        diasPerdidos: 4,
        promedioRiesgo: 4,
      },
      {
        sector: "Produccion",
        certificados: 1,
        diasPerdidos: 2,
        promedioRiesgo: 8,
      },
    ],
  });
  assert.equal(JSON.stringify(result).includes("Dato sensible"), false);
});
