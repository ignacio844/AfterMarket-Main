import assert from "node:assert/strict";
import test from "node:test";
import { buildGestionImportRows } from "../bridge/compras-gestion-import.mjs";

const persistent = [
  ["SKU", "ESTADO_GESTION", "CANTIDAD_DECIDIDA", "RESPONSABLE", "OBSERVACION", "FECHA_DECISION", "ACTIVO_EN_PLAN"],
  ["A", "APROBADO", 3, "Ana", "ok", 46200.5, "SI"],
  ["B", "APROBADO", 4, "Ana", "", 46200.5, "SI"],
];
const active = [
  ["SKU", "RIESGO", "COMPRA_SUGERIDA", "ESTADO_GESTION", "CANTIDAD_DECIDIDA", "RESPONSABLE", "OBSERVACION", "FECHA_DECISION"],
  ["A", "COMPRAR", 10, "APROBADO", 3, "Ana", "ok", 46200.5],
  ["B", "COMPRAR", 10, "ENVIADO A COMPRA", 4, "Ana", "", 46200.5],
];

test("imports reconciled decisions and quarantines disagreements", () => {
  const { rows, conflictSkus } = buildGestionImportRows(persistent, active, "America/Los_Angeles");
  assert.deepEqual(conflictSkus, ["B"]);
  assert.equal(rows[0].estado_gestion, "APROBADO");
  assert.match(rows[0].fecha_decision, /^20\d\d-/);
  assert.equal(rows[1].estado_gestion, null);
  assert.equal(rows[1].requiere_revision, true);
  assert.equal(rows[1].fecha_decision, null);
});

test("refuses import if the active and persistent SKU sets differ", () => {
  assert.throws(() => buildGestionImportRows(persistent, active.slice(0, 2), "America/Los_Angeles"), /mismos SKU/);
});
