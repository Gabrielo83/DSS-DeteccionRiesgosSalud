import assert from "node:assert/strict";
import test from "node:test";
import { buildAlertSummary } from "../src/alertSummary.js";

test("publica solo cantidades agregadas de alertas activas", () => {
  const result = buildAlertSummary([
    {
      estado: "activa",
      sector: "Produccion",
      motivos: ["recurrencia_diagnostica"],
      grupoPatologia: "musculoesqueletica",
      recurrencias: 3,
      ventanaMeses: 6,
      ultimaFecha: "2026-05-18",
      nombreCompleto: "Dato sensible",
    },
    {
      estado: "activa",
      sector: "Produccion",
      motivos: ["riesgo_alto"],
      grupoPatologia: "respiratoria",
      recurrencias: 1,
      ventanaMeses: 6,
      ultimaFecha: "2026-06-02",
    },
    { estado: "resuelta", sector: "Logistica", motivos: ["riesgo_alto"] },
  ]);

  assert.equal(result.totalActivas, 2);
  assert.deepEqual(result.sectores, [
    {
      sector: "Produccion",
      cantidad: 2,
      grupos: [
        {
          grupoPatologia: "musculoesqueletica",
          cantidadAlertas: 1,
          recurrencias: 3,
          ventanaMeses: 6,
        },
        {
          grupoPatologia: "respiratoria",
          cantidadAlertas: 1,
          recurrencias: 1,
          ventanaMeses: 6,
        },
      ],
    },
  ]);
  assert.deepEqual(result.motivos, {
    recurrenciaDiagnostica: 1,
    riesgoAlto: 1,
  });
  assert.deepEqual(result.periodos, [
    { periodo: "2026-05", cantidad: 1 },
    { periodo: "2026-06", cantidad: 1 },
  ]);
  assert.equal("nombreCompleto" in result, false);
  assert.equal(JSON.stringify(result).includes("Dato sensible"), false);
});

test("ordena los grupos diagnosticos por cantidad de alertas y recurrencias", () => {
  const result = buildAlertSummary([
    {
      estado: "activa",
      sector: "Comercializacion",
      grupoPatologia: "respiratoria",
      recurrencias: 3,
    },
    {
      estado: "activa",
      sector: "Comercializacion",
      grupoPatologia: "musculoesqueletica",
      recurrencias: 4,
    },
    {
      estado: "activa",
      sector: "Comercializacion",
      grupoPatologia: "respiratoria",
      recurrencias: 3,
    },
  ]);

  assert.deepEqual(
    result.sectores[0].grupos.map((group) => group.grupoPatologia),
    ["respiratoria", "musculoesqueletica"],
  );
  assert.equal(result.sectores[0].grupos[0].cantidadAlertas, 2);
  assert.equal(result.sectores[0].grupos[0].recurrencias, 6);
});
