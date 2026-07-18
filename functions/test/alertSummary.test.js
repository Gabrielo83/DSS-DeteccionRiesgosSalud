import assert from "node:assert/strict";
import test from "node:test";
import { buildAlertSummary } from "../src/alertSummary.js";

test("publica solo cantidades agregadas de alertas activas", () => {
  const result = buildAlertSummary([
    {
      estado: "activa",
      sector: "Produccion",
      motivos: ["recurrencia_diagnostica"],
      nombreCompleto: "Dato sensible",
    },
    {
      estado: "activa",
      sector: "Produccion",
      motivos: ["riesgo_alto"],
    },
    { estado: "resuelta", sector: "Logistica", motivos: ["riesgo_alto"] },
  ]);

  assert.equal(result.totalActivas, 2);
  assert.deepEqual(result.sectores, [{ sector: "Produccion", cantidad: 2 }]);
  assert.deepEqual(result.motivos, {
    recurrenciaDiagnostica: 1,
    riesgoAlto: 1,
  });
  assert.equal("nombreCompleto" in result, false);
});
