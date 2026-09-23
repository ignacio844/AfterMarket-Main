import assert from "node:assert/strict";
import test from "node:test";
import { buildGestionImportRows, selectNewGestionRows, verifyGestionSnapshot } from "../bridge/compras-gestion-import.mjs";

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

test("interprets textual decision dates in the spreadsheet time zone", () => {
  const left = structuredClone(persistent);
  const right = structuredClone(active);
  left[1][5] = "17/09/2026 12:30";
  right[1][7] = "17/09/2026 12:30";
  const { rows } = buildGestionImportRows(left, right, "America/Los_Angeles");
  assert.equal(rows[0].fecha_decision, "2026-09-17T19:30:00.000Z");
});

test("incremental import excludes decisions that already exist in Supabase", () => {
  const { rows } = buildGestionImportRows(persistent, active, "America/Los_Angeles");
  assert.deepEqual(selectNewGestionRows(rows, new Set(["A"])).map((row) => row.sku), ["B"]);
  assert.deepEqual(selectNewGestionRows(rows, new Set(["A", "B"])), []);
});

test("cutover verification detects legacy drift without treating newer Supabase edits as drift", () => {
  const { rows } = buildGestionImportRows(persistent, active, "America/Los_Angeles");
  const current = rows.map((row) => ({ ...row, version: 1 }));
  assert.equal(verifyGestionSnapshot(rows, current).changedInLegacy.count, 0);
  current[0].estado_gestion = "POSTERGAR";
  assert.deepEqual(verifyGestionSnapshot(rows, current).changedInLegacy.sample, ["A"]);
  current[0].version = 2;
  assert.equal(verifyGestionSnapshot(rows, current).changedInLegacy.count, 0);
  assert.equal(verifyGestionSnapshot(rows, current).editedInSupabase, 1);
  assert.deepEqual(verifyGestionSnapshot(rows, current.slice(0, 1)).missing.sample, ["B"]);
});
