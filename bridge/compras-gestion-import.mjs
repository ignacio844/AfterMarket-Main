import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { auditGestionSheets, hasBlockingGestionIssues } from "./compras-gestion-audit.mjs";

const NAMES = ["GESTION_COMPRAS", "GESTION_COMPRAS_ACTIVA"];

function header(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/\s+/g, "_");
}

function dateFromSheet(value, timeZone) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value !== "number") {
    const raw = String(value).trim();
    const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(raw);
    if (local) {
      const serial = (Date.UTC(Number(local[3]), Number(local[2]) - 1, Number(local[1]), Number(local[4] || 0), Number(local[5] || 0)) - Date.UTC(1899, 11, 30)) / 86_400_000;
      return dateFromSheet(serial, timeZone);
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) throw new Error("Fecha de decisión inválida en el origen.");
    return date.toISOString();
  }
  const wallClock = Date.UTC(1899, 11, 30) + value * 86_400_000;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" });
  let instant = wallClock;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const zone = formatter.formatToParts(new Date(instant)).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
    const offset = /^GMT([+-]\d{1,2})(?::(\d{2}))?$/.exec(zone);
    const minutes = offset ? Number(offset[1]) * 60 + Math.sign(Number(offset[1])) * Number(offset[2] || 0) : 0;
    const corrected = wallClock - minutes * 60_000;
    if (corrected === instant) break;
    instant = corrected;
  }
  return new Date(instant).toISOString();
}

export function buildGestionImportRows(persistent, active, timeZone) {
  const audit = auditGestionSheets({ GESTION_COMPRAS: persistent, GESTION_COMPRAS_ACTIVA: active });
  if (hasBlockingGestionIssues(audit) || audit.reconciliation.activeWithoutPersistent || audit.reconciliation.persistentWithoutActive) {
    throw new Error("Las hojas de Gestión no están íntegras o no contienen los mismos SKU.");
  }
  const conflictSkus = new Set(audit.reconciliation.conflictingSkuReferences.map((entry) => entry.sku));
  const indexes = new Map(persistent[0].map((name, index) => [header(name), index]));
  const records = persistent.slice(1).filter((row) => String(row[indexes.get("SKU")] ?? "").trim());
  const rows = records.map((row) => {
    const get = (name) => row[indexes.get(name)] ?? "";
    const sku = String(get("SKU")).trim().toUpperCase();
    const review = conflictSkus.has(sku);
    return {
      sku,
      estado_gestion: review ? null : String(get("ESTADO_GESTION") || "PENDIENTE").trim().toUpperCase(),
      cantidad_decidida: Number(get("CANTIDAD_DECIDIDA") || 0),
      observacion: String(get("OBSERVACION") ?? "").trim(),
      responsable: review ? "" : String(get("RESPONSABLE") ?? "").trim(),
      fecha_decision: review ? null : dateFromSheet(get("FECHA_DECISION"), timeZone),
      requiere_revision: review,
    };
  });
  if (rows.length !== audit.sheets.GESTION_COMPRAS.uniqueSkus) throw new Error("SKU faltantes en la importación.");
  return { rows, conflictSkus: [...conflictSkus] };
}

export function selectNewGestionRows(rows, existingSkus) {
  return rows.filter((row) => !existingSkus.has(row.sku));
}

export function verifyGestionSnapshot(rows, decisions) {
  const source = new Map(rows.map((row) => [row.sku, row]));
  const stored = new Map(decisions.map((row) => [row.sku, row]));
  const missing = [];
  const changedInLegacy = [];
  let editedInSupabase = 0;
  for (const row of rows) {
    const decision = stored.get(row.sku);
    if (!decision) { missing.push(row.sku); continue; }
    if (Number(decision.version) > 1) { editedInSupabase += 1; continue; }
    const sameDate = row.fecha_decision === null && decision.fecha_decision === null ||
      row.fecha_decision !== null && decision.fecha_decision !== null &&
      Math.abs(new Date(row.fecha_decision).getTime() - new Date(decision.fecha_decision).getTime()) < 1000;
    if (row.estado_gestion !== decision.estado_gestion ||
      Number(row.cantidad_decidida) !== Number(decision.cantidad_decidida) ||
      row.observacion !== decision.observacion ||
      row.responsable !== decision.responsable ||
      row.requiere_revision !== decision.requiere_revision || !sameDate) {
      changedInLegacy.push(row.sku);
    }
  }
  return {
    sourceSkuCount: rows.length,
    storedSkuCount: decisions.length,
    missing: { count: missing.length, sample: missing.slice(0, 20) },
    changedInLegacy: { count: changedInLegacy.length, sample: changedInLegacy.slice(0, 20) },
    editedInSupabase,
    noLongerInPlan: decisions.filter((decision) => !source.has(decision.sku)).length,
  };
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

async function readSheet(db, info) {
  const rows = [];
  for (let start = 0; start < info.row_count; start += 1000) {
    const { data, error } = await db.from("compras_sheet_import_rows")
      .select("row_index,row_values").eq("import_id", info.import_id)
      .order("row_index").range(start, start + 999);
    if (error) throw new Error(error.message);
    for (const item of data ?? []) {
      if (item.row_index !== rows.length || !Array.isArray(item.row_values)) throw new Error(`Snapshot incompleto de ${info.sheet_name}.`);
      rows.push(item.row_values);
    }
  }
  if (rows.length !== info.row_count) throw new Error(`Snapshot incompleto de ${info.sheet_name}.`);
  return rows;
}

async function readExistingDecisions(db) {
  const rows = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db.from("compras_gestion_decisiones")
      .select("sku,estado_gestion,cantidad_decidida,observacion,responsable,fecha_decision,requiere_revision,version")
      .order("sku").range(start, start + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

async function main() {
  const syncNew = process.argv.includes("--sync-new");
  const verify = process.argv.includes("--verify");
  if (verify && (syncNew || process.argv.includes("--apply"))) throw new Error("--verify no puede combinarse con --sync-new ni --apply.");
  const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "portal_aftermarket" },
  });
  const spreadsheetId = required("GOOGLE_SHEETS_SPREADSHEET_ID");
  const { data, error } = await db.from("compras_sheet_actual_import")
    .select("batch_id,import_id,sheet_name,row_count,time_zone")
    .eq("spreadsheet_id", spreadsheetId).in("sheet_name", NAMES);
  if (error) throw new Error(error.message);
  const info = new Map((data ?? []).map((row) => [row.sheet_name, row]));
  if (info.size !== NAMES.length) throw new Error("El lote vigente no contiene ambas hojas de Gestión.");
  const batchId = Number(info.get(NAMES[0]).batch_id);
  if (NAMES.some((name) => Number(info.get(name).batch_id) !== batchId)) throw new Error("Las hojas no pertenecen al mismo lote.");
  const [persistent, active] = await Promise.all(NAMES.map((name) => readSheet(db, info.get(name))));
  const { rows, conflictSkus } = buildGestionImportRows(persistent, active, info.get(NAMES[0]).time_zone);
  const { data: current, error: currentError } = await db.from("compras_sheet_actual_import")
    .select("batch_id,import_id,sheet_name").eq("spreadsheet_id", spreadsheetId).in("sheet_name", NAMES);
  if (currentError) throw new Error(currentError.message);
  if (current?.length !== NAMES.length || current.some((row) => Number(row.batch_id) !== batchId || Number(row.import_id) !== Number(info.get(row.sheet_name)?.import_id))) {
    throw new Error("El lote de Sheets cambió durante la lectura; reintentá.");
  }
  const existingDecisions = syncNew || verify ? await readExistingDecisions(db) : null;
  if (verify) {
    const report = verifyGestionSnapshot(rows, existingDecisions);
    process.stdout.write(`${JSON.stringify({ batchId, ...report, readOnly: true }, null, 2)}\n`);
    if (report.missing.count || report.changedInLegacy.count) process.exitCode = 1;
    return;
  }
  const existingSkus = existingDecisions ? new Set(existingDecisions.map((row) => row.sku)) : null;
  const newRows = existingSkus ? selectNewGestionRows(rows, existingSkus) : rows;
  const report = {
    batchId, skuCount: rows.length, newSkuCount: newRows.length,
    fractionalQuantityCount: rows.filter((row) => !Number.isInteger(row.cantidad_decidida)).length,
    needsReview: conflictSkus.filter((sku) => !existingSkus || !existingSkus.has(sku)),
  };
  if (!process.argv.includes("--apply")) {
    process.stdout.write(`${JSON.stringify({ ...report, dryRun: true }, null, 2)}\n`);
    return;
  }
  if (syncNew && newRows.length === 0) {
    process.stdout.write(`${JSON.stringify({ ...report, imported: 0 }, null, 2)}\n`);
    return;
  }
  const { data: imported, error: importError } = await db.rpc(
    syncNew ? "compras_gestion_importar_nuevos" : "compras_gestion_importar",
    { p_registros: newRows, p_lote_origen: batchId },
  );
  if (importError) throw new Error(importError.message);
  if (Number(imported) !== newRows.length) throw new Error("La cantidad importada no coincide.");
  process.stdout.write(`${JSON.stringify({ ...report, imported }, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
