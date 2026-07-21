import assert from "node:assert/strict";
import test from "node:test";
import { buildAbsenceIndicator } from "../src/absenceIndicator.js";

test("agrega ausencias por periodo, sector y tipo sin datos personales", () => {
  const result = buildAbsenceIndicator(
    [{
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
    }],
    [
      {
        employeeId: "LEG-001",
        nombreCompleto: "Dato personal que no debe persistir",
        sector: "Produccion",
        fechaAlta: "2025-01-01",
        activo: true,
      },
      {
        employeeId: "LEG-002",
        sector: "Ventas",
        fechaAlta: "2026-07-01",
        activo: true,
      },
    ],
    new Date("2026-07-20T12:00:00Z"),
  );

  assert.equal(result.version, "absence-indicator-v2");
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
  assert.equal(
    JSON.stringify(result).includes("Dato personal que no debe persistir"),
    false,
  );
  assert.deepEqual(result.dotacionPeriodos.at(-1), {
    periodo: "2026-07",
    activos: 2,
    sectores: [
      { sector: "Produccion", activos: 1 },
      { sector: "Ventas", activos: 1 },
    ],
  });
});

test("descarta ausencias sin un periodo interpretable", () => {
  assert.deepEqual(
    buildAbsenceIndicator([{ sector: "Ventas", dias: 4 }]).periodos,
    [],
  );
});

test("incluye historicamente a empleados dados de baja en su periodo activo", () => {
  const result = buildAbsenceIndicator(
    [],
    [
      {
        employeeId: "LEG-BAJA",
        sector: "Produccion",
        fechaAlta: "2025-01-01",
        fechaBaja: "2026-03-15",
        activo: false,
      },
      {
        employeeId: "LEG-INACTIVO-SIN-FECHA",
        sector: "Produccion",
        fechaAlta: "2025-01-01",
        activo: false,
      },
    ],
    new Date("2026-07-20T12:00:00Z"),
  );

  const february = result.dotacionPeriodos.find(
    (period) => period.periodo === "2026-02",
  );
  const april = result.dotacionPeriodos.find(
    (period) => period.periodo === "2026-04",
  );

  assert.equal(february.activos, 1);
  assert.deepEqual(february.sectores, [
    { sector: "Produccion", activos: 1 },
  ]);
  assert.equal(april.activos, 0);
  assert.deepEqual(april.sectores, []);
});
