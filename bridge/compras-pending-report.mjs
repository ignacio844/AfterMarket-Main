import { createClient } from "@supabase/supabase-js";
import { reconcileComprasPending } from "../src/lib/compras-pending-reconciliation.ts";
import { applyLegacyComprasMetricsToDashboardModel } from "../src/lib/compras-dashboard-model.ts";
import { columns, dashboardNumber } from "../src/lib/compras-dashboard.ts";

const NAMES = [
  "MODELO_COMPRAS",
  "DETALLE_IMPORTACIONES",
  "MAPA_SKU",
  "PENDIENTES_EQUIVALENCIA_IMPORT",
  "EQUIVALENCIAS_SKU",
  "ORDENES",
  "PARAMETROS_COMPRAS",
  "MARCAS",
];
const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!spreadsheetId || !supabaseUrl || !supabaseKey) {
  throw new Error("Falta configurar el acceso privado al espejo de Compras.");
}

const db = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "portal_aftermarket" },
});

async function currentImports() {
  const { data, error } = await db.from("compras_sheet_actual_import")
    .select("batch_id,import_id,sheet_name,row_count")
    .eq("spreadsheet_id", spreadsheetId).in("sheet_name", NAMES);
  if (error) throw new Error(`No se pudo leer el lote vigente: ${error.message}`);
  const byName = new Map((data ?? []).map((row) => [row.sheet_name, row]));
  if (NAMES.some((name) => !byName.has(name))) throw new Error("Faltan hojas validadas para la conciliación.");
  if (new Set([...byName.values()].map((row) => row.batch_id)).size !== 1) {
    throw new Error("Las hojas no pertenecen al mismo lote.");
  }
  return byName;
}

async function readRows(info) {
  const rows = [];
  for (let start = 0; start < info.row_count; start += 1_000) {
    const { data, error } = await db.from("compras_sheet_import_rows")
      .select("row_index,row_values").eq("import_id", info.import_id)
      .order("row_index").range(start, start + 999);
    if (error) throw new Error(`${info.sheet_name}: ${error.message}`);
    for (const row of data ?? []) {
      if (row.row_index !== rows.length || !Array.isArray(row.row_values)) {
        throw new Error(`${info.sheet_name}: snapshot incompleto.`);
      }
      rows.push(row.row_values);
    }
  }
  if (rows.length !== info.row_count) throw new Error(`${info.sheet_name}: conteo incompleto.`);
  return rows;
}

const before = await currentImports();
const values = Object.fromEntries(await Promise.all(NAMES.map(async (name) => [name, await readRows(before.get(name))])));
const after = await currentImports();
for (const name of NAMES) {
  if (before.get(name).batch_id !== after.get(name).batch_id ||
      before.get(name).import_id !== after.get(name).import_id) {
    throw new Error("El lote cambió durante la lectura; reintentá la conciliación.");
  }
}

const report = reconcileComprasPending({
  modelo: values.MODELO_COMPRAS,
  detalle: values.DETALLE_IMPORTACIONES,
  mapaSku: values.MAPA_SKU,
  pendientesEquivalencia: values.PENDIENTES_EQUIVALENCIA_IMPORT,
  equivalenciasSku: values.EQUIVALENCIAS_SKU,
  ordenes: values.ORDENES,
});
const detailColumn = columns(values.DETALLE_IMPORTACIONES[0]);
const recalculatedModel = applyLegacyComprasMetricsToDashboardModel({
  modelo: values.MODELO_COMPRAS,
  // Preview histórico: este informe sigue contrastando el cálculo anterior del Sheet.
  ordenes: values.DETALLE_IMPORTACIONES.slice(1).map((row) => ({
    item: String(row[detailColumn("ITEM")] ?? ""),
    cantidad: dashboardNumber(row[detailColumn("CANTIDAD")]),
    status: String(row[detailColumn("STATUS_LINEA")] ?? ""),
  })),
  mapaSku: values.MAPA_SKU,
  pendientesEquivalencia: values.PENDIENTES_EQUIVALENCIA_IMPORT,
  parametros: values.PARAMETROS_COMPRAS,
  marcas: values.MARCAS,
});
const modelColumn = columns(values.MODELO_COMPRAS[1]);
const pendingColumn = modelColumn("PENDIENTE_TOTAL");
const purchaseColumn = modelColumn("COMPRA_SUGERIDA");
const riskColumn = modelColumn("RIESGO");
const objectiveColumn = modelColumn("COBERTURA_OBJETIVO");
const preview = { changedPendingRows: 0, changedPurchaseRows: 0, changedRiskRows: 0, changedObjectiveRows: 0, purchaseTotal: 0, riskCounts: {} };
for (let index = 2; index < recalculatedModel.length; index += 1) {
  const beforeRow = values.MODELO_COMPRAS[index];
  const afterRow = recalculatedModel[index];
  if (dashboardNumber(beforeRow[pendingColumn]) !== dashboardNumber(afterRow[pendingColumn])) preview.changedPendingRows += 1;
  if (dashboardNumber(beforeRow[purchaseColumn]) !== dashboardNumber(afterRow[purchaseColumn])) preview.changedPurchaseRows += 1;
  if (String(beforeRow[riskColumn] ?? "") !== String(afterRow[riskColumn] ?? "")) preview.changedRiskRows += 1;
  if (dashboardNumber(beforeRow[objectiveColumn]) !== dashboardNumber(afterRow[objectiveColumn])) preview.changedObjectiveRows += 1;
  preview.purchaseTotal += dashboardNumber(afterRow[purchaseColumn]);
  const risk = String(afterRow[riskColumn] ?? "");
  preview.riskCounts[risk] = (preview.riskCounts[risk] ?? 0) + 1;
}
const showDetails = process.argv.includes("--details");
console.log(JSON.stringify({
  sourceBatchId: before.get("MODELO_COMPRAS").batch_id,
  analyzedAt: new Date().toISOString(),
  ...report,
  legacyModelPreview: preview,
  largestDifferences: showDetails ? report.largestDifferences : report.largestDifferences.slice(0, 10),
}, null, 2));
