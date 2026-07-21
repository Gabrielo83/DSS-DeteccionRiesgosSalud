import assert from "node:assert/strict";
import test from "node:test";
import { buildAbsenceIndicator } from "../src/absenceIndicator.js";

test("agrega ausencias por periodo, sector y tipo sin datos personales", () => {
  const result = buildAbsenceIndicator([
    {
      fechaInicio: "2026-07-02",
      sector: "Produccion",
      tipo: "enfermedad",
      dias: 3,
      nombreCompleto: "Dato que no debe persistir",
      diagnostico: "Dato clinico que no debe persistir",
    },
    {
      fechaInicio: "2026-07-10",
      sector: "Produccion",
      tipo: "vacaciones",
      dias: 5,
    },
    {
      fechaInicio: "2026-07-18",
      sector: "Ventas",
      tipo: "enfermedad",
      dias: 2,
    },
  ]);

  assert.equal(result.version, "absence-indicator-v1");
  assert.equal(result.periodos.length, 1);
  assert.deepEqual(result.periodos[0], {
    periodo: "2026-07",
    ausencias: 3,
    diasPerdidos: 10,
    tipos: [
      { tipo: "enfermedad", ausencias: 2, diasPerdidos: 5 },
      { tipo: "vacaciones", ausencias: 1, diasPerdidos: 5 },
    ],
    sectores: [
      {
        sector: "Produccion",
        ausencias: 2,
        diasPerdidos: 8,
        tipos: [
          { tipo: "enfermedad", ausencias: 1, diasPerdidos: 3 },
          { tipo: "vacaciones", ausencias: 1, diasPerdidos: 5 },
        ],
      },
      {
        sector: "Ventas",
        ausencias: 1,
        diasPerdidos: 2,
        tipos: [{ tipo: "enfermedad", ausencias: 1, diasPerdidos: 2 }],
      },
    ],
  });
  assert.equal(JSON.stringify(result).includes("Dato que no debe persistir"), false);
  assert.equal(JSON.stringify(result).includes("Dato clinico"), false);
});

test("descarta ausencias sin un periodo interpretable", () => {
  assert.deepEqual(
    buildAbsenceIndicator([{ sector: "Ventas", dias: 4 }]).periodos,
    [],
  );
});
