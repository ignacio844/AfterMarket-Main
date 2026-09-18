import assert from "node:assert/strict";
import test from "node:test";
import { auditGestionSheets, hasBlockingGestionIssues } from "../bridge/compras-gestion-audit.mjs";

const persistentHeaders = ["SKU", "ESTADO_GESTION", "CANTIDAD_DECIDIDA", "RESPONSABLE", "OBSERVACION", "FECHA_DECISION", "ACTIVO_EN_PLAN"];
const activeHeaders = ["SKU", "RIESGO", "COMPRA_SUGERIDA", "ESTADO_GESTION", "CANTIDAD_DECIDIDA", "RESPONSABLE", "OBSERVACION", "FECHA_DECISION"];

test("reconciles decisions by normalized SKU without treating inactive history as an error", () => {
  const result = auditGestionSheets({
    GESTION_COMPRAS: [
      persistentHeaders,
      [" sku-1 ", "APROBADO", 7, "Ana", "Nota", 46300, "SI"],
      ["old", "NO COMPRAR", "", "Ana", "", 46200, "NO"],
    ],
    GESTION_COMPRAS_ACTIVA: [
      activeHeaders,
      ["SKU-1", "COMPRAR", 10, "APROBADO", 7, "Ana", "Nota", 46300],
      ["new", "COMPRAR", 5, "PENDIENTE", "", "", "", ""],
    ],
  });
  assert.equal(result.sheets.GESTION_COMPRAS.uniqueSkus, 2);
  assert.equal(result.reconciliation.activeWithoutPersistent, 1);
  assert.equal(result.reconciliation.persistentWithoutActive, 1);
  assert.equal(result.reconciliation.inactivePersistent, 1);
  assert.equal(result.reconciliation.decisionDifferences.ESTADO_GESTION.count, 0);
  assert.equal(hasBlockingGestionIssues(result), false);
});

test("reports missing headers, duplicates and invalid decision values", () => {
  const result = auditGestionSheets({
    GESTION_COMPRAS: [persistentHeaders, ["A", "WRONG", -1, "", "x".repeat(1001), "", "SI"], ["a", "PENDIENTE", "", "", "", "", "SI"]],
    GESTION_COMPRAS_ACTIVA: [["SKU", "RIESGO"], ["A", "COMPRAR"]],
  });
  assert.deepEqual(result.sheets.GESTION_COMPRAS_ACTIVA.missingHeaders, ["COMPRA_SUGERIDA", ...persistentHeaders.slice(1, -1)]);
  assert.equal(result.sheets.GESTION_COMPRAS.duplicateSkus.count, 1);
  assert.equal(result.sheets.GESTION_COMPRAS.invalidStates.count, 1);
  assert.equal(result.sheets.GESTION_COMPRAS.invalidQuantities.count, 1);
  assert.equal(result.sheets.GESTION_COMPRAS.oversizedObservations.count, 1);
  assert.equal(hasBlockingGestionIssues(result), true);
});

test("reports differences between persistent and active decisions", () => {
  const result = auditGestionSheets({
    GESTION_COMPRAS: [persistentHeaders, ["A", "APROBADO", 4, "Ana", "", 46300, "SI"]],
    GESTION_COMPRAS_ACTIVA: [activeHeaders, ["A", "COMPRAR", 6, "PENDIENTE", 4, "Ana", "", 46301]],
    ENVIOS_COMPRA: [["NRO_ENVIO", "SKU"], ["EC-1", "a"]],
  });
  assert.deepEqual(result.reconciliation.decisionDifferences.ESTADO_GESTION.sample, [{ sku: "A", active: "PENDIENTE", persistent: "APROBADO" }]);
  assert.deepEqual(result.reconciliation.decisionDifferences.FECHA_DECISION.sample, [{ sku: "A", active: "46301", persistent: "46300" }]);
  assert.deepEqual(result.reconciliation.conflictingSkuReferences[0], {
    sku: "A",
    references: { ENVIOS_COMPRA: 1, COMPRAS_EN_PROCESO: null, MOVIMIENTOS_COMPRA: null, ORDENES_COMPRA_PORTAL: null },
  });
  assert.equal(hasBlockingGestionIssues(result), false);
});
