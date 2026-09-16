import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { JWT } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";
import { millisecondsUntilNextCheck } from "./escobar-sync.mjs";
import { parseOrdenesWorkbook, ORDERS_SHEET } from "./ordenes-parse.mjs";

const FILE_ID = process.env.ORDENES_DRIVE_FILE_ID?.trim() || "1Og794dOWR7pcJqs2NVYwtH4FnBrPlj32";
const PORT = Number(process.env.ORDENES_BRIDGE_PORT ?? 8792);
const REQUEST_POLL_MS = 15_000;
const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
let running = false;
let lastRunAt = null;
let lastError = null;
let nextCheckAt = null;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

function supabaseClient() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "portal_aftermarket" },
  });
}

async function driveFetch(url, headers, timeoutMs) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (response.status !== 429 && response.status < 500) return response;
    if (attempt === 3) return response;
    await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 2000));
  }
}

async function driveFile() {
  const client = new JWT({
    email: required("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: required("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("No se obtuvo token de sólo lectura de Drive.");
  const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(FILE_ID)}`;
  const headers = { Authorization: `Bearer ${token}` };
  const metadataResponse = await driveFetch(`${base}?fields=id,name,mimeType,size,modifiedTime&supportsAllDrives=true`, headers, 60_000);
  if (!metadataResponse.ok) throw new Error(`No se pudo consultar el Excel de órdenes en Drive (HTTP ${metadataResponse.status}).`);
  const metadata = await metadataResponse.json();
  if (metadata.mimeType !== MIME) throw new Error("La fuente de Órdenes ya no es un XLSX; revisar el conector.");
  const response = await driveFetch(`${base}?alt=media&supportsAllDrives=true`, headers, 180_000);
  if (!response.ok) throw new Error(`No se pudo descargar el Excel de órdenes (HTTP ${response.status}).`);
  return { metadata, bytes: Buffer.from(await response.arrayBuffer()) };
}

function delta(current, previous) { return previous > 0 ? Math.abs(current - previous) / previous : 0; }

async function saveSnapshot(snapshot, metadata, db) {
  const { data: existing, error: existingError } = await db.from("compras_ordenes_imports")
    .select("id,estado").eq("dataset_sha256", snapshot.datasetHash).limit(1);
  if (existingError) throw new Error(`No se pudo comprobar idempotencia de Órdenes: ${existingError.message}`);
  if (existing?.length) {
    if (existing[0].estado !== "VALIDADO") throw new Error(`El dataset ya existe en estado ${existing[0].estado}.`);
    return { importId: Number(existing[0].id), unchanged: true };
  }
  const { data: previous, error: previousError } = await db.from("compras_ordenes_imports")
    .select("filas_validas,ordenes_count,total_unidades").eq("estado", "VALIDADO")
    .order("fecha_importacion", { ascending: false }).order("id", { ascending: false }).limit(1);
  if (previousError) throw new Error(`No se pudo comparar Órdenes: ${previousError.message}`);
  if (previous?.length) {
    const old = previous[0];
    if (delta(snapshot.items.length, Number(old.filas_validas)) > 0.25 ||
        delta(snapshot.orderCount, Number(old.ordenes_count)) > 0.25 ||
        delta(snapshot.totalUnits, Number(old.total_unidades)) > 0.40) {
      throw new Error("Variación extraordinaria de filas, órdenes o unidades frente al snapshot anterior.");
    }
  }
  const { data: created, error: createError } = await db.from("compras_ordenes_imports").insert({
    source_file_id: FILE_ID,
    source_name: metadata.name,
    source_modified_at: metadata.modifiedTime,
    dataset_sha256: snapshot.datasetHash,
    estado: "PROCESANDO",
    filas_origen: snapshot.sourceRows,
    filas_validas: snapshot.items.length,
    filas_rechazadas: snapshot.invalidRows.length,
    ordenes_count: snapshot.orderCount,
    total_unidades: snapshot.totalUnits,
    status_counts: snapshot.statuses,
    metadata: { sheet: ORDERS_SHEET, fileSize: Number(metadata.size), parserVersion: "orders-xlsx-v1", invalidRows: snapshot.invalidRows.slice(0, 20) },
  }).select("id").single();
  if (createError || !created?.id) throw new Error(`No se pudo crear el snapshot de Órdenes: ${createError?.message ?? "sin ID"}`);
  const importId = Number(created.id);
  try {
    for (let start = 0; start < snapshot.items.length; start += 500) {
      const { error } = await db.from("compras_ordenes_import_items")
        .insert(snapshot.items.slice(start, start + 500).map((item) => ({ import_id: importId, ...item })));
      if (error) throw new Error(`No se pudieron guardar ítems de Órdenes: ${error.message}`);
    }
    const { error } = await db.from("compras_ordenes_imports").update({ estado: "VALIDADO" }).eq("id", importId);
    if (error) throw new Error(`No se pudo validar Órdenes: ${error.message}`);
    return { importId, unchanged: false };
  } catch (error) {
    await db.from("compras_ordenes_imports").update({ estado: "ERROR", error_message: String(error.message).slice(0, 4000) }).eq("id", importId);
    throw error;
  }
}

async function sync(db, requestId = null, localFile = null) {
  if (running) return;
  running = true;
  try {
    if (requestId) await db.from("compras_sync_requests").update({ status: "PROCESANDO", started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", requestId);
    const localBytes = localFile ? await readFile(localFile) : null;
    const { metadata, bytes } = localBytes
      ? { metadata: { name: localFile, modifiedTime: new Date().toISOString(), size: localBytes.length }, bytes: localBytes }
      : await driveFile();
    const snapshot = parseOrdenesWorkbook(bytes);
    const result = localFile ? { importId: null, unchanged: false } : await saveSnapshot(snapshot, metadata, db);
    if (requestId) {
      const { error } = await db.from("compras_sync_requests").update({ status: "COMPLETADO", finished_at: new Date().toISOString(), ordenes_import_id: result.importId, updated_at: new Date().toISOString() }).eq("id", requestId);
      if (error) throw error;
    }
    lastRunAt = new Date().toISOString();
    lastError = null;
    console.log(`Órdenes: ${snapshot.orderCount} órdenes, ${snapshot.items.length} líneas${result.importId ? `, snapshot #${result.importId}` : ""}${result.unchanged ? " sin cambios" : ""}.`);
  } catch (error) {
    lastError = String(error?.message ?? error);
    console.error("Órdenes sync:", lastError);
    if (requestId) await db.from("compras_sync_requests").update({ status: "ERROR", finished_at: new Date().toISOString(), error_message: lastError.slice(0, 4000), updated_at: new Date().toISOString() }).eq("id", requestId);
    if (localFile) throw error;
  } finally { running = false; }
}

async function pollRequests(db) {
  if (running) return;
  const { data, error } = await db.from("compras_sync_requests").select("id")
    .eq("sync_type", "ORDENES").eq("status", "PENDIENTE")
    .order("requested_at", { ascending: true }).limit(1);
  if (error) { console.error("Órdenes requests:", error.message); return; }
  if (data?.[0]) await sync(db, Number(data[0].id));
}

async function scheduledSync(db) {
  const { data, error } = await db.from("compras_sync_requests").insert({
    sync_type: "ORDENES",
    status: "PENDIENTE",
    requested_by: "bridge:scheduler",
    metadata: { source: "scheduler", localTime: "11:30 America/Argentina/Buenos_Aires" },
  }).select("id").single();
  if (error?.code === "23505") return; // Ya hay una solicitud manual activa.
  if (error || !data?.id) throw new Error(`No se pudo programar Órdenes: ${error?.message ?? "sin ID"}`);
  await sync(db, Number(data.id));
}

async function main() {
  const localFileIndex = process.argv.indexOf("--file");
  const localFile = localFileIndex >= 0 ? process.argv[localFileIndex + 1] : null;
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    if (!localFile) throw new Error("--dry-run requiere --file para evitar una descarga remota innecesaria.");
    await sync(null, null, localFile);
    return;
  }
  const db = supabaseClient();
  if (process.argv.includes("--once")) { await sync(db); if (lastError) process.exitCode = 1; return; }
  const server = createServer((request, response) => {
    if (request.method !== "GET" || request.url !== "/health") { response.writeHead(404); return response.end(); }
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ status: lastError ? "degraded" : "ok", running, lastRunAt, lastError, nextCheckAt }));
  });
  server.listen(PORT, "127.0.0.1", () => console.log(`Órdenes worker en http://127.0.0.1:${PORT}`));
  let dailyTimer;
  const scheduleDaily = () => {
    const delay = millisecondsUntilNextCheck(new Date(), 11, 30); // 11:30 ART.
    nextCheckAt = new Date(Date.now() + delay).toISOString();
    dailyTimer = setTimeout(async () => {
      nextCheckAt = null;
      try { await scheduledSync(db); }
      catch (error) { lastError = String(error?.message ?? error); console.error("Órdenes scheduler:", lastError); }
      finally { scheduleDaily(); }
    }, delay);
  };
  scheduleDaily();
  const requestTimer = setInterval(() => void pollRequests(db), REQUEST_POLL_MS);
  const shutdown = () => { clearTimeout(dailyTimer); clearInterval(requestTimer); server.close(); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error("Órdenes sync fatal:", error); process.exitCode = 1; });
}
