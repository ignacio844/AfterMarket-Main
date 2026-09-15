import { createClient } from "@supabase/supabase-js";
import { JWT } from "google-auth-library";

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SECRET_KEY?.trim();
const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!supabaseUrl || !supabaseKey || !spreadsheetId || !serviceAccountEmail || !serviceAccountKey) {
  throw new Error("Falta configuración privada de Supabase o Google Sheets.");
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function numeric(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "portal_aftermarket" },
});

const demanda = new Map();
const pageSize = 1000;
let importId = null;
let periodFrom = null;
let periodTo = null;

for (let from = 0; ; from += pageSize) {
  const { data, error } = await supabase
    .from("compras_ventas_demanda_legacy")
    .select("sku_key,consumo_12_meses,promedio_mensual,period_from,period_to,import_id")
    .order("sku_key")
    .range(from, from + pageSize - 1);
  if (error) throw new Error(`Supabase: ${error.message}`);
  const rows = data ?? [];
  for (const row of rows) {
    demanda.set(normalize(row.sku_key), {
      consumo: numeric(row.consumo_12_meses),
      promedio: numeric(row.promedio_mensual),
    });
    importId ??= Number(row.import_id);
    periodFrom ??= String(row.period_from);
    periodTo ??= String(row.period_to);
  }
  if (rows.length < pageSize) break;
}

const auth = new JWT({
  email: serviceAccountEmail,
  key: serviceAccountKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const { token } = await auth.getAccessToken();
if (!token) throw new Error("Google: no se obtuvo token de sólo lectura.");

async function readSheet(name) {
  const range = encodeURIComponent(`'${name}'`);
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
  );
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Google Sheets (${name}): HTTP ${response.status}`);
  return (await response.json()).values ?? [];
}

const [rows, mapaRows, ventasRows] = await Promise.all([
  readSheet("MODELO_COMPRAS"),
  readSheet("MAPA_SKU"),
  readSheet("VENTAS"),
]);
const mapaHeaders = (mapaRows[0] ?? []).map(normalizeHeader);
const mapaColumns = [
  "CODIGO_NUEVO",
  "CODIGO_VIEJO",
  "BASE_OCTOSIS",
  "BASE_SISFACTURA",
  "BASE_MELIKOBO",
  "BASE_TORETTOS",
  "BASE_WARNES",
];
const newSkuIndex = mapaHeaders.indexOf("CODIGO_NUEVO");
if (newSkuIndex < 0) throw new Error("MAPA_SKU no contiene CODIGO_NUEVO.");
const mappingIndexes = mapaColumns
  .map((column) => mapaHeaders.indexOf(column))
  .filter((index) => index >= 0);
const equivalencias = new Map();
for (const row of mapaRows.slice(1)) {
  const newSku = normalize(row[newSkuIndex]);
  if (!newSku) continue;
  equivalencias.set(newSku, newSku);
  for (const index of mappingIndexes) {
    const sourceSku = normalize(row[index]);
    if (sourceSku && !equivalencias.has(sourceSku)) equivalencias.set(sourceSku, newSku);
  }
}
const demandaCanonica = new Map();
for (const [sourceSku, item] of demanda) {
  const canonicalSku = equivalencias.get(sourceSku) ?? sourceSku;
  const consumo = (demandaCanonica.get(canonicalSku)?.consumo ?? 0) + item.consumo;
  demandaCanonica.set(canonicalSku, { consumo, promedio: consumo / 12 });
}

const ventasHeaders = (ventasRows[0] ?? []).map(normalizeHeader);
const ventasSkuIndex = ventasHeaders.indexOf("COD_BAM");
const legacyMonths = [
  "AGO_2025", "SEP_2025", "OCT_2025", "NOV_2025", "DIC_2025", "ENE_2026",
  "FEB_2026", "MAR_2026", "ABR_2026", "MAY_2026", "JUN_2026", "JUL_2026",
];
const monthIndexes = legacyMonths.map((month) => ventasHeaders.indexOf(month));
if (ventasSkuIndex < 0 || monthIndexes.some((index) => index < 0)) {
  throw new Error("VENTAS no contiene COD_BAM o los doce meses legacy.");
}
const demandaVentasLegacy = new Map();
for (const row of ventasRows.slice(1)) {
  const sourceSku = normalize(row[ventasSkuIndex]);
  if (!sourceSku) continue;
  const canonicalSku = equivalencias.get(sourceSku) ?? sourceSku;
  const consumo = monthIndexes.reduce((sum, index) => sum + numeric(row[index]), 0);
  demandaVentasLegacy.set(
    canonicalSku,
    (demandaVentasLegacy.get(canonicalSku) ?? 0) + consumo,
  );
}

const comparisonSku = new Set([...demandaCanonica.keys(), ...demandaVentasLegacy.keys()]);
let sqlVsVentasMismatches = 0;
let sqlVsVentasLegacyTotal = 0;
let sqlVsVentasSnapshotTotal = 0;
for (const sku of comparisonSku) {
  const legacy = demandaVentasLegacy.get(sku) ?? 0;
  const snapshot = demandaCanonica.get(sku)?.consumo ?? 0;
  sqlVsVentasLegacyTotal += legacy;
  sqlVsVentasSnapshotTotal += snapshot;
  if (Math.abs(legacy - snapshot) > 0.001) sqlVsVentasMismatches += 1;
}

const headers = (rows[1] ?? []).map(normalizeHeader);
const skuIndex = headers.indexOf("SKU");
const consumoIndex = Math.max(headers.indexOf("CONSUMO_12_MESES"), headers.indexOf("CONSUMO_12M"));
const promedioIndex = headers.indexOf("PROMEDIO_MENSUAL");
if (skuIndex < 0 || consumoIndex < 0 || promedioIndex < 0) {
  throw new Error("MODELO_COMPRAS no contiene las columnas requeridas.");
}

let modelSku = 0;
let matchedSku = 0;
let zeroFilledSku = 0;
let consumoMismatches = 0;
let promedioMismatches = 0;
let unchangedSku = 0;
let matchedMismatches = 0;
let missingWithLegacyDemand = 0;
let legacyZeroWithSnapshotDemand = 0;
let legacyConsumoTotal = 0;
let snapshotConsumoAppliedTotal = 0;
const distinctModelSku = new Set();

for (const row of rows.slice(2)) {
  const sku = normalize(row[skuIndex]);
  if (!sku) continue;
  modelSku += 1;
  distinctModelSku.add(sku);
  const actual = demandaCanonica.get(sku) ?? { consumo: 0, promedio: 0 };
  if (demandaCanonica.has(sku)) matchedSku += 1;
  else zeroFilledSku += 1;
  const legacyConsumo = numeric(row[consumoIndex]);
  legacyConsumoTotal += legacyConsumo;
  snapshotConsumoAppliedTotal += actual.consumo;
  const consumoMatches = Math.abs(legacyConsumo - actual.consumo) <= 0.001;
  const promedioMatches = Math.abs(numeric(row[promedioIndex]) - actual.promedio) <= 0.001;
  if (!consumoMatches) consumoMismatches += 1;
  if (!promedioMatches) promedioMismatches += 1;
  if (consumoMatches && promedioMatches) unchangedSku += 1;
  if (demandaCanonica.has(sku) && !consumoMatches) matchedMismatches += 1;
  if (!demandaCanonica.has(sku) && Math.abs(legacyConsumo) > 0.001) missingWithLegacyDemand += 1;
  if (demandaCanonica.has(sku) && Math.abs(legacyConsumo) <= 0.001 && Math.abs(actual.consumo) > 0.001) {
    legacyZeroWithSnapshotDemand += 1;
  }
}

console.log(JSON.stringify({
  importId,
  periodFrom,
  periodTo,
  snapshotSku: demanda.size,
  canonicalSnapshotSku: demandaCanonica.size,
  modelSku,
  distinctModelSku: distinctModelSku.size,
  matchedSku,
  zeroFilledSku,
  unchangedSku,
  consumoMismatches,
  promedioMismatches,
  matchedMismatches,
  missingWithLegacyDemand,
  legacyZeroWithSnapshotDemand,
  legacyConsumoTotal,
  snapshotConsumoAppliedTotal,
  ventasLegacySku: demandaVentasLegacy.size,
  sqlVsVentasMismatches,
  sqlVsVentasLegacyTotal,
  sqlVsVentasSnapshotTotal,
}, null, 2));
