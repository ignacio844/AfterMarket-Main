import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { JWT } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";
import { parseEscobarWorkbook } from "./escobar-parse.mjs";

const FOLDER_ID = process.env.ESCOBAR_DRIVE_FOLDER_ID?.trim() || "1lEWgwWsxXBFfXHida9I2BWy0WodOv8ZF";
const POLL_MS = Math.max(60_000, Number(process.env.ESCOBAR_POLL_MS ?? 15 * 60_000));
const HOST = "127.0.0.1";
const PORT = Number(process.env.ESCOBAR_BRIDGE_PORT ?? 8791);
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function localDate(date) {
  const { year, month, day } = localParts(date);
  return `${year}-${month}-${day}`;
}

function supabaseClient() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "portal_aftermarket" },
  });
}

async function driveToken() {
  const client = new JWT({
    email: required("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: required("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("No se obtuvo un token de sólo lectura para Drive.");
  return token;
}

async function driveGet(url, token, binary = false) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Drive respondió HTTP ${response.status}.`);
  return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
}

async function findTodayFile(token, date = new Date()) {
  const { day, month } = localParts(date);
  const expectedName = `${day}-${month} INV GRAL.xlsx`;
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", `'${FOLDER_ID}' in parents and trashed = false`);
  url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,size)");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  const data = await driveGet(url, token);
  if (data.nextPageToken) throw new Error("La carpeta tiene más de 100 archivos; ajustar la paginación antes de importar.");
  const candidates = (data.files ?? [])
    .filter((file) => file.name?.toUpperCase() === expectedName.toUpperCase())
    .filter((file) => file.mimeType === XLSX_MIME)
    .filter((file) => localDate(new Date(file.createdTime)) === localDate(date))
    .sort((a, b) => b.createdTime.localeCompare(a.createdTime));
  return candidates[0] ?? null;
}

function relativeDelta(current, previous) {
  return previous > 0 ? Math.abs(current - previous) / previous : Infinity;
}

async function validateAgainstPrevious(parsed, supabase) {
  const { data, error } = await supabase.from("compras_stock_imports")
    .select("id,metadata")
    .eq("deposito", "ESCOBAR")
    .eq("estado", "VALIDADO")
    .order("fecha_importacion", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw new Error(`No se pudo leer el snapshot Escobar anterior: ${error.message}`);
  const previous = data?.[0]?.metadata;
  if (!previous) return;
  const skuDelta = relativeDelta(parsed.uniqueSkus, Number(previous.uniqueSkus));
  const stockDelta = relativeDelta(parsed.totalStock, Number(previous.totalStock));
  if (skuDelta > 0.25 || stockDelta > 0.30) {
    throw new Error(`Variación extraordinaria frente a Escobar anterior: SKU ${(skuDelta * 100).toFixed(1)} %, stock ${(stockDelta * 100).toFixed(1)} %.`);
  }
}

async function publish(file, parsed, supabase) {
  const { data: existing, error: existingError } = await supabase.from("compras_stock_imports")
    .select("id,estado")
    .eq("source_system", "OCTOSIS")
    .eq("deposito", "ESCOBAR")
    .eq("archivo_sha256", parsed.fileSha256)
    .limit(1);
  if (existingError) throw new Error(`No se pudo verificar la idempotencia de Escobar: ${existingError.message}`);
  if (existing?.length) return { importId: Number(existing[0].id), unchanged: true, estado: existing[0].estado };

  await validateAgainstPrevious(parsed, supabase);
  const now = new Date().toISOString();
  const metadata = {
    parserVersion: "octosis-drive-escobar-v1",
    driveFileId: file.id,
    driveFolderId: FOLDER_ID,
    driveCreatedTime: file.createdTime,
    driveModifiedTime: file.modifiedTime,
    worksheet: parsed.worksheet,
    uniqueSkus: parsed.uniqueSkus,
    totalStock: parsed.totalStock,
    includedRows: parsed.includedRows,
    excludedRows: parsed.excludedRows,
    duplicateRows: parsed.duplicateRows,
    categoryRows: parsed.categoryRows,
    depositFilter: "exclude EXT|REV|INV|TEP",
  };
  const { data: created, error: createError } = await supabase.from("compras_stock_imports")
    .insert({
      source_system: "OCTOSIS",
      deposito: "ESCOBAR",
      archivo_origen: file.name,
      archivo_sha256: parsed.fileSha256,
      fecha_archivo: file.createdTime,
      fecha_importacion: now,
      estado: "PROCESANDO",
      filas_origen: parsed.sourceRows,
      filas_validas: parsed.uniqueSkus,
      filas_rechazadas: 0,
      metadata,
      updated_at: now,
    })
    .select("id")
    .single();
  if (createError || !created?.id) throw new Error(`No se pudo iniciar la importación Escobar: ${createError?.message ?? "sin ID"}`);

  const importId = Number(created.id);
  try {
    for (let start = 0; start < parsed.items.length; start += 500) {
      const rows = parsed.items.slice(start, start + 500).map((item) => ({ import_id: importId, ...item }));
      const { error } = await supabase.from("compras_stock_import_items").insert(rows);
      if (error) throw new Error(`No se pudieron guardar los SKU de Escobar: ${error.message}`);
    }
    const { error } = await supabase.from("compras_stock_imports")
      .update({ estado: "VALIDADO", updated_at: new Date().toISOString() })
      .eq("id", importId);
    if (error) throw new Error(`No se pudo validar Escobar: ${error.message}`);
    return { importId, unchanged: false, estado: "VALIDADO" };
  } catch (error) {
    await supabase.from("compras_stock_imports")
      .update({ estado: "ERROR", error_message: String(error.message).slice(0, 4000), updated_at: new Date().toISOString() })
      .eq("id", importId);
    throw error;
  }
}

let running = false;
let lastRunAt = null;
let lastError = null;
let lastFile = null;
let lastFileVersion = null;

async function tick({ dryRun = false, localFile = null } = {}) {
  if (running) return;
  if (!dryRun && Number(localParts().hour) < 9) return;
  running = true;
  try {
    let file;
    let bytes;
    if (localFile) {
      bytes = await readFile(localFile);
      file = { id: "local-dry-run", name: localFile.split(/[\\/]/).at(-1), createdTime: new Date().toISOString(), modifiedTime: new Date().toISOString() };
    } else {
      const token = await driveToken();
      file = await findTodayFile(token);
      if (!file) {
        lastRunAt = new Date().toISOString();
        lastError = null;
        return;
      }
      const fileVersion = `${file.id}:${file.modifiedTime}`;
      if (!dryRun && fileVersion === lastFileVersion) {
        lastRunAt = new Date().toISOString();
        lastError = null;
        return;
      }
      const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`);
      url.searchParams.set("alt", "media");
      url.searchParams.set("supportsAllDrives", "true");
      bytes = await driveGet(url, token, true);
    }
    const parsed = await parseEscobarWorkbook(bytes, file.name);
    lastFile = file.name;
    if (dryRun) {
      console.log(JSON.stringify({ file: file.name, sourceRows: parsed.sourceRows, includedRows: parsed.includedRows, excludedRows: parsed.excludedRows, uniqueSkus: parsed.uniqueSkus, totalStock: parsed.totalStock, categoryRows: parsed.categoryRows }));
    } else {
      const result = await publish(file, parsed, supabaseClient());
      if (result.estado !== "VALIDADO") throw new Error(`El mismo archivo ya figura en estado ${result.estado} (importación #${result.importId}).`);
      lastFileVersion = `${file.id}:${file.modifiedTime}`;
      console.log(`Escobar: ${file.name}, importación #${result.importId}${result.unchanged ? " sin cambios" : " VALIDADA"}.`);
    }
    lastRunAt = new Date().toISOString();
    lastError = null;
  } catch (error) {
    lastError = String(error?.message ?? error);
    console.error("Escobar sync:", lastError);
    if (dryRun) throw error;
  } finally {
    running = false;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const once = process.argv.includes("--once") || dryRun;
  const localFileIndex = process.argv.indexOf("--file");
  const localFile = localFileIndex >= 0 ? process.argv[localFileIndex + 1] : null;
  if (once) {
    await tick({ dryRun, localFile });
    if (lastError) process.exitCode = 1;
    return;
  }
  const server = createServer((request, response) => {
    if (request.method !== "GET" || request.url !== "/health") {
      response.writeHead(404);
      return response.end();
    }
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ status: lastError ? "degraded" : "ok", running, lastRunAt, lastError, lastFile }));
  });
  server.listen(PORT, HOST, () => console.log(`Escobar worker en http://${HOST}:${PORT}`));
  await tick();
  const timer = setInterval(() => void tick(), POLL_MS);
  const shutdown = () => { clearInterval(timer); server.close(); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error("Escobar sync fatal:", error); process.exitCode = 1; });
}
