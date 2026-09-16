import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { JWT } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";

const SHEETS = Object.freeze({
  MODELO_COMPRAS: 25_000,
  CONFIG_MARCAS_COMPRA: 1,
  ALIAS_MARCAS_COMPRA: 1,
  MAPA_SKU: 25_000,
  CONTROL_IMPORTACIONES_STOCK: 1,
  DETALLE_IMPORTACIONES: 2_000,
  PENDIENTES_EQUIVALENCIA_IMPORT: 1,
  EQUIVALENCIAS_SKU: 1,
  ORDENES: 1,
  PARAMETROS_COMPRAS: 1,
  MARCAS: 1,
});
const PAGE_ROWS = 5_000;
const INSERT_ROWS = 300;
const INTERVAL_MS = Math.max(30 * 60_000, Number(process.env.COMPRAS_SHEETS_SYNC_INTERVAL_MS ?? 2 * 60 * 60_000));
const PORT = Number(process.env.COMPRAS_SHEETS_BRIDGE_PORT ?? 8793);
let running = false;
let lastRunAt = null;
let lastError = null;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

function dbClient() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "portal_aftermarket" },
  });
}

function columnLabel(index) {
  let label = "";
  for (let value = index; value > 0; value = Math.floor((value - 1) / 26)) {
    label = String.fromCharCode(65 + (value - 1) % 26) + label;
  }
  return label;
}

async function googleJson(url, token) {
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(120_000),
    });
    if (response.ok) return response.json();
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 6) {
      throw new Error(`Lectura de Google Sheets falló (HTTP ${response.status}).`);
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1_000
      : response.status === 429 ? Math.min(60_000, 15_000 * (attempt + 1)) : 2 ** attempt * 1_000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function googleSource() {
  const spreadsheetId = required("GOOGLE_SHEETS_SPREADSHEET_ID");
  const client = new JWT({
    email: required("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: required("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("No se obtuvo token de lectura de Google Sheets.");
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
  const metadata = await googleJson(`${base}?fields=properties(timeZone),sheets(properties(title,gridProperties(rowCount,columnCount)))`, token);
  const available = new Map(metadata.sheets?.map((sheet) => [sheet.properties?.title, sheet.properties?.gridProperties]) ?? []);
  for (const sheetName of Object.keys(SHEETS)) {
    if (!available.has(sheetName)) throw new Error(`Falta la hoja ${sheetName} en el origen.`);
  }
  return { spreadsheetId, token, base, timeZone: metadata.properties?.timeZone ?? "America/Argentina/Buenos_Aires", available };
}

async function readSheet(source, sheetName) {
  const grid = source.available.get(sheetName);
  const endColumn = columnLabel(grid.columnCount);
  const rows = [];
  for (let first = 1; first <= grid.rowCount; first += PAGE_ROWS) {
    const last = Math.min(grid.rowCount, first + PAGE_ROWS - 1);
    const range = `'${sheetName.replaceAll("'", "''")}'!A${first}:${endColumn}${last}`;
    const url = new URL(`${source.base}/values/${encodeURIComponent(range)}`);
    url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
    url.searchParams.set("dateTimeRenderOption", "SERIAL_NUMBER");
    const response = await googleJson(url, source.token);
    const values = response.values ?? [];
    for (let index = 0; index < last - first + 1; index += 1) rows.push(values[index] ?? []);
  }
  while (rows.length && !rows.at(-1).some((value) => value !== "" && value !== null)) rows.pop();
  if (rows.length < SHEETS[sheetName]) throw new Error(`${sheetName}: sólo ${rows.length} filas; mínimo ${SHEETS[sheetName]}.`);
  const headerIndex = sheetName === "MODELO_COMPRAS" ? 1 : 0;
  if (!rows[headerIndex]?.length) throw new Error(`${sheetName}: falta el encabezado.`);
  const hash = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  return { rows, hash };
}

async function publishSheet(db, source, sheetName, dataset) {
  const { data: existing, error: existingError } = await db.from("compras_sheet_imports")
    .select("id").eq("spreadsheet_id", source.spreadsheetId).eq("sheet_name", sheetName)
    .eq("dataset_sha256", dataset.hash).eq("estado", "VALIDADO").limit(1);
  if (existingError) throw new Error(`${sheetName}: ${existingError.message}`);
  if (existing?.length) {
    const { error } = await db.from("compras_sheet_imports")
      .update({ ultima_revision: new Date().toISOString() }).eq("id", existing[0].id);
    if (error) throw new Error(`${sheetName}: no se pudo registrar revisión: ${error.message}`);
    return { id: Number(existing[0].id), unchanged: true, rows: dataset.rows.length };
  }

  const { data: created, error: createError } = await db.from("compras_sheet_imports").insert({
    spreadsheet_id: source.spreadsheetId,
    sheet_name: sheetName,
    dataset_sha256: dataset.hash,
    estado: "PROCESANDO",
    row_count: dataset.rows.length,
    time_zone: source.timeZone,
    metadata: { importer: "compras-sheets-readonly-v1" },
  }).select("id").single();
  if (createError || !created?.id) throw new Error(`${sheetName}: no se pudo crear importación: ${createError?.message ?? "sin ID"}`);
  const importId = Number(created.id);
  try {
    for (let start = 0; start < dataset.rows.length; start += INSERT_ROWS) {
      const batch = dataset.rows.slice(start, start + INSERT_ROWS)
        .map((row, offset) => ({ import_id: importId, row_index: start + offset, row_values: row }));
      const { error } = await db.from("compras_sheet_import_rows").insert(batch);
      if (error) throw new Error(`${sheetName}: no se pudieron guardar filas: ${error.message}`);
    }
    const { count, error: countError } = await db.from("compras_sheet_import_rows")
      .select("import_id", { count: "exact", head: true }).eq("import_id", importId);
    if (countError || count !== dataset.rows.length) {
      throw new Error(`${sheetName}: conteo incompleto (${count ?? "sin respuesta"}/${dataset.rows.length}).`);
    }
    const { error } = await db.from("compras_sheet_imports").update({ estado: "VALIDADO" }).eq("id", importId);
    if (error) throw new Error(`${sheetName}: no se pudo validar: ${error.message}`);
    return { id: importId, unchanged: false, rows: dataset.rows.length };
  } catch (cause) {
    await db.from("compras_sheet_imports").update({ estado: "ERROR", error_message: String(cause?.message ?? cause).slice(0, 4_000) }).eq("id", importId);
    throw cause;
  }
}

async function publishBatch(db, source, results) {
  const { data: batch, error: batchError } = await db.from("compras_sheet_batches").insert({
    spreadsheet_id: source.spreadsheetId,
    estado: "PROCESANDO",
    sheet_count: results.length,
  }).select("id").single();
  if (batchError || !batch?.id) throw new Error(`No se pudo crear el lote de Compras: ${batchError?.message ?? "sin ID"}`);
  try {
    const { error: itemsError } = await db.from("compras_sheet_batch_items").insert(
      results.map((result) => ({ batch_id: batch.id, sheet_name: result.sheet, import_id: result.id })),
    );
    if (itemsError) throw new Error(`No se pudieron asociar las hojas al lote: ${itemsError.message}`);
    const { count, error: countError } = await db.from("compras_sheet_batch_items")
      .select("sheet_name", { count: "exact", head: true }).eq("batch_id", batch.id);
    if (countError || count !== results.length) throw new Error("El lote de Compras quedó incompleto.");
    const { error: validError } = await db.from("compras_sheet_batches")
      .update({ estado: "VALIDADO" }).eq("id", batch.id);
    if (validError) throw new Error(`No se pudo publicar el lote de Compras: ${validError.message}`);
    return Number(batch.id);
  } catch (cause) {
    await db.from("compras_sheet_batches").update({ estado: "ERROR", error_message: String(cause?.message ?? cause).slice(0, 4_000) }).eq("id", batch.id);
    throw cause;
  }
}

async function sync({ dryRun = false } = {}) {
  if (running) return;
  running = true;
  try {
    const source = await googleSource();
    const db = dryRun ? null : dbClient();
    const results = [];
    for (const sheetName of Object.keys(SHEETS)) {
      const dataset = await readSheet(source, sheetName);
      results.push(dryRun
        ? { sheet: sheetName, rows: dataset.rows.length, dryRun: true }
        : { sheet: sheetName, ...await publishSheet(db, source, sheetName, dataset) });
    }
    const batchId = dryRun ? null : await publishBatch(db, source, results);
    lastRunAt = new Date().toISOString();
    lastError = null;
    console.log(JSON.stringify({ source: "Google Sheets readonly", batchId, results }));
  } catch (cause) {
    lastError = String(cause?.message ?? cause);
    console.error("Compras Sheet mirror:", lastError);
    if (process.argv.includes("--once") || process.argv.includes("--dry-run")) throw cause;
  } finally {
    running = false;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun || process.argv.includes("--once")) return sync({ dryRun });
  const server = createServer((request, response) => {
    if (request.method !== "GET" || request.url !== "/health") { response.writeHead(404); return response.end(); }
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ status: lastError ? "degraded" : "ok", running, lastRunAt, lastError }));
  });
  server.listen(PORT, "127.0.0.1", () => console.log(`Compras Sheet mirror en 127.0.0.1:${PORT}`));
  await sync();
  const timer = setInterval(() => void sync(), INTERVAL_MS);
  const shutdown = () => { clearInterval(timer); server.close(); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((cause) => { console.error("Compras Sheet mirror fatal:", cause); process.exitCode = 1; });
}
