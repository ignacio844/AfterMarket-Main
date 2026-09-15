import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import sql from "mssql";

const SOURCE_SYSTEM = "SQL_SERVER";
const SOURCE_NAME = "VS_REPORTING.dbo.Vista_Ventas_origen_v2";
const QUERY_VERSION = "legacy-bajada-mensual-v2.1";
const PERIOD_FROM = "2025-07-31";
const TWO_HOURS_MS = 2 * 60 * 60 * 1_000;
const POLL_MS = Math.max(5_000, Number(process.env.VENTAS_REQUEST_POLL_MS ?? 15_000));
const SYNC_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.VENTAS_SYNC_INTERVAL_MS ?? TWO_HOURS_MS),
);
const host = process.env.VENTAS_BRIDGE_HOST ?? "127.0.0.1";
const port = Number(process.env.VENTAS_BRIDGE_PORT ?? 8789);

const BASE_MAP = Object.freeze({
  DISTRIMAR: "DTM",
  IMPORT: "IMP",
  JUNIMAR: "JNM",
  NLI: "NLI",
  NLD: "NLD",
});

const EXCLUDED_CODES = new Set([
  "1E+21",
  "999       XXX",
  "999999999999999999999",
]);

function envRequired(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

function booleanEnv(value, fallback) {
  return value === undefined ? fallback : value.toLowerCase() === "true";
}

function getSqlConfig() {
  return {
    server: envRequired("SQL_SERVER"),
    database: envRequired("SQL_DATABASE"),
    user: envRequired("SQL_USER"),
    password: envRequired("SQL_PASSWORD"),
    port: Number(process.env.SQL_PORT ?? 1433),
    connectionTimeout: 15_000,
    requestTimeout: 180_000,
    options: {
      encrypt: booleanEnv(process.env.SQL_ENCRYPT, true),
      trustServerCertificate: booleanEnv(process.env.SQL_TRUST_SERVER_CERTIFICATE, true),
    },
    pool: { min: 0, max: 2, idleTimeoutMillis: 10_000 },
  };
}

function localDateText(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateText(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

function clean(value) {
  return String(value ?? "").trim();
}

export function normalizeSkuKey(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function decimal(value, scale) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) throw new Error(`Valor numérico inválido: ${value}`);
  return number.toFixed(scale);
}

const DETAIL_QUERY = `
DECLARE @fecha_inicio date = @FechaInicio;
DECLARE @fecha_fin date = @FechaFin;

WITH DatosLimpios AS (
  SELECT
    LTRIM(RTRIM(articulo)) AS codigo,
    NULLIF(LTRIM(RTRIM(cod_bam)), '') AS cod_bam,
    NULLIF(LTRIM(RTRIM(desc_articulo)), '') AS descripcion,
    fecha,
    LTRIM(RTRIM(Base_Origen)) AS base_origen,
    CASE
      WHEN Importe_sin_iva < 0 AND cantidad > 0 THEN cantidad * -1
      ELSE cantidad
    END AS cantidad_neta,
    CASE
      WHEN
        CASE
          WHEN Importe_sin_iva < 0 AND cantidad > 0 THEN cantidad * -1
          ELSE cantidad
        END < 0
        AND Importe_sin_iva > 0
      THEN Importe_sin_iva * -1
      ELSE Importe_sin_iva
    END AS importe_neto
  FROM dbo.Vista_Ventas_origen_v2
  WHERE fecha >= @fecha_inicio
    AND fecha < DATEADD(day, 1, @fecha_fin)
),
CodigoInfo AS (
  SELECT
    codigo,
    MAX(cod_bam) AS cod_bam,
    MAX(descripcion) AS descripcion,
    COUNT(DISTINCT cod_bam) AS cod_bam_distintos
  FROM DatosLimpios
  WHERE codigo NOT IN ('1E+21', '999       XXX', '999999999999999999999')
  GROUP BY codigo
),
Mensual AS (
  SELECT
    codigo,
    base_origen,
    DATEFROMPARTS(YEAR(fecha), MONTH(fecha), 1) AS periodo,
    SUM(cantidad_neta) AS unidades_netas,
    SUM(importe_neto) AS facturado_neto_sin_iva,
    COUNT_BIG(*) AS source_rows
  FROM DatosLimpios
  WHERE codigo NOT IN ('1E+21', '999       XXX', '999999999999999999999')
  GROUP BY
    codigo,
    base_origen,
    DATEFROMPARTS(YEAR(fecha), MONTH(fecha), 1)
)
SELECT
  m.codigo,
  c.cod_bam,
  c.descripcion,
  c.cod_bam_distintos,
  m.base_origen,
  m.periodo,
  m.unidades_netas,
  m.facturado_neto_sin_iva,
  m.source_rows
FROM Mensual m
JOIN CodigoInfo c ON c.codigo = m.codigo
ORDER BY m.codigo, m.base_origen, m.periodo;
`;

const PROFILE_QUERY = `
DECLARE @fecha_inicio date = @FechaInicio;
DECLARE @fecha_fin date = @FechaFin;

WITH DatosLimpios AS (
  SELECT
    LTRIM(RTRIM(articulo)) AS codigo,
    NULLIF(LTRIM(RTRIM(cod_bam)), '') AS cod_bam,
    fecha,
    LTRIM(RTRIM(Base_Origen)) AS base_origen
  FROM dbo.Vista_Ventas_origen_v2
  WHERE fecha >= @fecha_inicio
    AND fecha < DATEADD(day, 1, @fecha_fin)
),
CodigoInfo AS (
  SELECT codigo, MAX(cod_bam) AS cod_bam
  FROM DatosLimpios
  WHERE codigo NOT IN ('1E+21', '999       XXX', '999999999999999999999')
  GROUP BY codigo
)
SELECT
  COUNT_BIG(*) AS filas_origen,
  MIN(fecha) AS min_fecha,
  MAX(fecha) AS max_fecha,
  SUM(CASE WHEN codigo IN ('1E+21', '999       XXX', '999999999999999999999') THEN 1 ELSE 0 END) AS filas_excluidas,
  SUM(CASE WHEN codigo IS NULL OR codigo = '' THEN 1 ELSE 0 END) AS filas_codigo_vacio
FROM DatosLimpios;

WITH DatosLimpios AS (
  SELECT
    LTRIM(RTRIM(articulo)) AS codigo,
    NULLIF(LTRIM(RTRIM(cod_bam)), '') AS cod_bam
  FROM dbo.Vista_Ventas_origen_v2
  WHERE fecha >= @fecha_inicio
    AND fecha < DATEADD(day, 1, @fecha_fin)
),
CodigoInfo AS (
  SELECT codigo, MAX(cod_bam) AS cod_bam, COUNT_BIG(*) AS affected_rows
  FROM DatosLimpios
  WHERE codigo NOT IN ('1E+21', '999       XXX', '999999999999999999999')
  GROUP BY codigo
)
SELECT codigo, affected_rows
FROM CodigoInfo
WHERE cod_bam IS NULL OR cod_bam = ''
ORDER BY affected_rows DESC, codigo;

SELECT
  LTRIM(RTRIM(Base_Origen)) AS base_origen,
  MAX(fecha) AS max_fecha,
  COUNT_BIG(*) AS filas
FROM dbo.Vista_Ventas_origen_v2
WHERE fecha >= @fecha_inicio
  AND fecha < DATEADD(day, 1, @fecha_fin)
GROUP BY LTRIM(RTRIM(Base_Origen));
`;

async function queryVentas() {
  let pool;
  try {
    pool = await new sql.ConnectionPool(getSqlConfig()).connect();
    const fechaFin = localDateText();
    const request = () => pool.request()
      .input("FechaInicio", sql.Date, PERIOD_FROM)
      .input("FechaFin", sql.Date, fechaFin);
    const [detail, profile] = await Promise.all([
      request().query(DETAIL_QUERY),
      request().query(PROFILE_QUERY),
    ]);
    return {
      fechaFin,
      detailRows: detail.recordset,
      profile: profile.recordsets[0]?.[0] ?? {},
      invalidCodes: profile.recordsets[1] ?? [],
      bases: profile.recordsets[2] ?? [],
    };
  } finally {
    await pool?.close().catch(() => undefined);
  }
}

export function prepareSnapshot(raw) {
  const warnings = [];
  const baseLatestTransactionDates = {};
  const baseSyncDates = {};
  const baseRows = {};

  for (const base of raw.bases) {
    const sourceBase = clean(base.base_origen).toUpperCase();
    const empresa = BASE_MAP[sourceBase];
    if (!empresa) throw new Error(`Base_Origen inesperada: ${sourceBase || "VACÍA"}.`);
    baseLatestTransactionDates[empresa] = dateText(base.max_fecha);
    baseSyncDates[empresa] = raw.fechaFin;
    baseRows[empresa] = Number(base.filas ?? 0);
  }

  for (const empresa of Object.values(BASE_MAP)) {
    if (!baseLatestTransactionDates[empresa]) {
      throw new Error(`La extracción no contiene la empresa ${empresa}.`);
    }
  }

  const items = [];
  let mappingConflicts = 0;
  for (const row of raw.detailRows) {
    const codigo = clean(row.codigo);
    if (!codigo || EXCLUDED_CODES.has(codigo)) continue;
    const sku = clean(row.cod_bam);
    if (!sku) continue;
    const skuKey = normalizeSkuKey(sku);
    if (!skuKey) continue;
    const sourceBase = clean(row.base_origen).toUpperCase();
    const empresa = BASE_MAP[sourceBase];
    if (!empresa) throw new Error(`Base_Origen inesperada: ${sourceBase || "VACÍA"}.`);
    const conflictCount = Number(row.cod_bam_distintos ?? 0);
    if (conflictCount > 1) mappingConflicts += 1;
    items.push({
      codigo,
      sku,
      sku_key: skuKey,
      descripcion: clean(row.descripcion) || null,
      empresa,
      periodo: dateText(row.periodo),
      unidades_netas: decimal(row.unidades_netas, 3),
      facturado_neto_sin_iva: decimal(row.facturado_neto_sin_iva, 4),
      source_rows: Number(row.source_rows ?? 0),
    });
  }

  items.sort((a, b) =>
    a.codigo.localeCompare(b.codigo) ||
    a.empresa.localeCompare(b.empresa) ||
    a.periodo.localeCompare(b.periodo),
  );

  if (mappingConflicts > 0) {
    throw new Error(`${mappingConflicts} códigos tienen más de un Cod_BAM en la extracción.`);
  }
  if (!items.length) throw new Error("La consulta SQL no devolvió ventas válidas.");

  const skuKeys = new Set(items.map((row) => row.sku_key));
  const codes = new Set(items.map((row) => row.codigo));
  const periods = new Set(items.map((row) => row.periodo));
  const totalUnits = items.reduce((sum, row) => sum + Number(row.unidades_netas), 0);
  const totalBilling = items.reduce((sum, row) => sum + Number(row.facturado_neto_sin_iva), 0);
  const hash = createHash("sha256");
  hash.update(`${SOURCE_SYSTEM}|${SOURCE_NAME}|${QUERY_VERSION}|${PERIOD_FROM}|${raw.fechaFin}\n`);
  for (const row of items) {
    hash.update([
      row.codigo,
      row.sku,
      row.sku_key,
      row.descripcion ?? "",
      row.empresa,
      row.periodo,
      row.unidades_netas,
      row.facturado_neto_sin_iva,
      row.source_rows,
    ].join("|") + "\n");
  }

  const errors = raw.invalidCodes.map((row) => ({
    codigo_raw: clean(row.codigo) || null,
    sku_raw: null,
    error_code: "MISSING_COD_BAM",
    error_message: "El Código no tiene Cod_BAM y el legacy descarta esa fila.",
    affected_rows: Number(row.affected_rows ?? 0),
    raw_data: {},
  }));

  const rejectedRows = errors.reduce((sum, row) => sum + row.affected_rows, 0);
  if (rejectedRows > 0) warnings.push(`${rejectedRows} renglones quedaron fuera por falta de Cod_BAM.`);

  return {
    items,
    errors,
    warnings,
    datasetHash: hash.digest("hex"),
    periodFrom: PERIOD_FROM,
    periodTo: raw.fechaFin,
    sourceMaxDate: dateText(raw.profile.max_fecha),
    sourceRows: Number(raw.profile.filas_origen ?? 0),
    rejectedRows,
    skuCount: skuKeys.size,
    codeCount: codes.size,
    periodCount: periods.size,
    totalUnits: decimal(totalUnits, 3),
    totalBilling: decimal(totalBilling, 4),
    metadata: {
      baseSyncDates,
      baseLatestTransactionDates,
      baseRows,
      sourceMinDate: dateText(raw.profile.min_fecha),
      excludedRows: Number(raw.profile.filas_excluidas ?? 0),
      emptyCodeRows: Number(raw.profile.filas_codigo_vacio ?? 0),
      mappingConflicts,
      aggregation: "codigo+empresa+periodo",
      netRule: "legacy-sql-bajada-mensual-v2",
    },
  };
}

class SupabaseRest {
  constructor() {
    this.url = envRequired("SUPABASE_URL").replace(/\/+$/, "");
    this.key = envRequired("SUPABASE_SECRET_KEY");
    this.schema = process.env.SUPABASE_SCHEMA?.trim() || "portal_aftermarket";
  }

  async request(table, { method = "GET", params, body, representation = false } = {}) {
    const url = new URL(`${this.url}/rest/v1/${table}`);
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
    const headers = {
      apikey: this.key,
      "Accept-Profile": this.schema,
      "Content-Profile": this.schema,
      "Content-Type": "application/json",
      Prefer: representation ? "return=representation" : "return=minimal",
    };
    // Las claves legacy son JWT y se envían también como Bearer. Las claves
    // modernas sb_secret_* se autentican exclusivamente mediante apikey.
    if (!this.key.startsWith("sb_secret_")) {
      headers.Authorization = `Bearer ${this.key}`;
    }
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 800);
      const error = new Error(`Supabase ${method} ${table}: ${response.status} ${detail}`);
      error.status = response.status;
      throw error;
    }
    if (!representation) return [];
    return response.json();
  }

  select(table, params) {
    return this.request(table, { params, representation: true });
  }

  insert(table, body, representation = false) {
    return this.request(table, { method: "POST", body, representation });
  }

  update(table, params, body, representation = false) {
    return this.request(table, { method: "PATCH", params, body, representation });
  }
}

function relativeDelta(current, previous) {
  return previous === 0 ? (current === 0 ? 0 : Infinity) : Math.abs(current - previous) / Math.abs(previous);
}

async function validateAgainstPrevious(snapshot, supabase) {
  const minSkus = Number(process.env.VENTAS_MIN_SKUS ?? 3000);
  if (snapshot.skuCount < minSkus) {
    throw new Error(`Sólo se detectaron ${snapshot.skuCount} SKU; mínimo de seguridad: ${minSkus}.`);
  }

  const previousRows = await supabase.select("compras_ventas_imports", {
    select: "id,sku_count,total_unidades_netas,total_facturado_neto_sin_iva",
    estado: "eq.VALIDADO",
    order: "fecha_importacion.desc,id.desc",
    limit: "1",
  });
  if (!previousRows.length) return;

  const previous = previousRows[0];
  const checks = [
    ["cantidad de SKU", snapshot.skuCount, Number(previous.sku_count), Number(process.env.VENTAS_MAX_SKU_DELTA ?? 0.25)],
    ["unidades netas", Number(snapshot.totalUnits), Number(previous.total_unidades_netas), Number(process.env.VENTAS_MAX_UNITS_DELTA ?? 0.40)],
    ["facturación neta", Number(snapshot.totalBilling), Number(previous.total_facturado_neto_sin_iva), Number(process.env.VENTAS_MAX_BILLING_DELTA ?? 0.40)],
  ];
  const errors = checks
    .filter(([, current, old, max]) => relativeDelta(current, old) > max)
    .map(([label, current, old]) => `${label}: ${old} → ${current}`);
  if (errors.length) throw new Error(`CONTROL DE SEGURIDAD: variación extraordinaria en ${errors.join("; ")}.`);
}

async function saveSnapshot(snapshot, supabase) {
  const existing = await supabase.select("compras_ventas_imports", {
    select: "id,estado,fecha_importacion",
    source_system: `eq.${SOURCE_SYSTEM}`,
    dataset_sha256: `eq.${snapshot.datasetHash}`,
    limit: "1",
  });
  if (existing.length && existing[0].estado === "VALIDADO") {
    return { importId: Number(existing[0].id), unchanged: true };
  }
  if (existing.length) {
    throw new Error(`El dataset ya existe como importación #${existing[0].id} en estado ${existing[0].estado}.`);
  }

  await validateAgainstPrevious(snapshot, supabase);
  const now = new Date().toISOString();
  const created = await supabase.insert("compras_ventas_imports", {
    source_system: SOURCE_SYSTEM,
    source_name: SOURCE_NAME,
    query_version: QUERY_VERSION,
    dataset_sha256: snapshot.datasetHash,
    period_from: snapshot.periodFrom,
    period_to: snapshot.periodTo,
    source_max_date: snapshot.sourceMaxDate || null,
    fecha_importacion: now,
    estado: "PROCESANDO",
    filas_origen: snapshot.sourceRows,
    filas_validas: snapshot.items.length,
    filas_rechazadas: snapshot.rejectedRows,
    sku_count: snapshot.skuCount,
    codigo_count: snapshot.codeCount,
    period_count: snapshot.periodCount,
    total_unidades_netas: snapshot.totalUnits,
    total_facturado_neto_sin_iva: snapshot.totalBilling,
    warnings: snapshot.warnings,
    metadata: snapshot.metadata,
    updated_at: now,
  }, true);
  const importId = Number(created[0]?.id);
  if (!importId) throw new Error("Supabase no devolvió el ID de la importación de Ventas.");

  try {
    for (let start = 0; start < snapshot.items.length; start += 500) {
      const rows = snapshot.items.slice(start, start + 500).map((row) => ({ import_id: importId, ...row }));
      await supabase.insert("compras_ventas_import_items", rows);
    }
    for (let start = 0; start < snapshot.errors.length; start += 500) {
      const rows = snapshot.errors.slice(start, start + 500).map((row) => ({ import_id: importId, ...row }));
      await supabase.insert("compras_ventas_import_errors", rows);
    }
    await supabase.update("compras_ventas_imports", { id: `eq.${importId}` }, {
      estado: "VALIDADO",
      error_message: null,
      updated_at: new Date().toISOString(),
    });
    return { importId, unchanged: false };
  } catch (error) {
    await supabase.update("compras_ventas_imports", { id: `eq.${importId}` }, {
      estado: "ERROR",
      error_message: String(error?.message ?? error).slice(0, 4000),
      updated_at: new Date().toISOString(),
    }).catch(() => undefined);
    throw error;
  }
}

async function updateRequest(supabase, requestId, values) {
  await supabase.update("compras_sync_requests", {
    id: `eq.${requestId}`,
    sync_type: "eq.VENTAS",
  }, { ...values, updated_at: new Date().toISOString() });
}

async function executeSync(supabase, requestId = null, dryRun = false) {
  if (requestId) {
    await updateRequest(supabase, requestId, {
      status: "PROCESANDO",
      started_at: new Date().toISOString(),
      error_message: null,
    });
  }
  try {
    console.log("Consultando Ventas en SQL Server...");
    const raw = await queryVentas();
    const snapshot = prepareSnapshot(raw);
    console.log(`Ventas: ${snapshot.skuCount} SKU, ${snapshot.codeCount} códigos, ${snapshot.items.length} filas mensuales.`);
    if (dryRun) {
      console.log(`DRY RUN OK. Hash: ${snapshot.datasetHash}. No se escribió en Supabase.`);
      return { importId: null, unchanged: false };
    }
    const result = await saveSnapshot(snapshot, supabase);
    if (requestId) {
      await updateRequest(supabase, requestId, {
        status: "COMPLETADO",
        finished_at: new Date().toISOString(),
        ventas_import_id: result.importId,
        error_message: null,
      });
    }
    console.log(`Ventas: importación #${result.importId} ${result.unchanged ? "sin cambios" : "VALIDADA"}.`);
    return result;
  } catch (error) {
    if (requestId && supabase) {
      await updateRequest(supabase, requestId, {
        status: "ERROR",
        finished_at: new Date().toISOString(),
        error_message: String(error?.message ?? error).slice(0, 4000),
      }).catch(() => undefined);
    }
    throw error;
  }
}

async function claimPendingRequest(supabase) {
  const pending = await supabase.select("compras_sync_requests", {
    select: "id",
    sync_type: "eq.VENTAS",
    status: "eq.PENDIENTE",
    order: "requested_at.asc",
    limit: "1",
  });
  if (!pending.length) return null;
  const id = Number(pending[0].id);
  const claimed = await supabase.update("compras_sync_requests", {
    id: `eq.${id}`,
    sync_type: "eq.VENTAS",
    status: "eq.PENDIENTE",
  }, {
    status: "PROCESANDO",
    started_at: new Date().toISOString(),
    error_message: null,
  }, true);
  return claimed.length ? id : null;
}

async function ensureScheduledRequest(supabase) {
  const [latestImport, latestRequest] = await Promise.all([
    supabase.select("compras_ventas_imports", {
      select: "fecha_importacion",
      estado: "eq.VALIDADO",
      order: "fecha_importacion.desc,id.desc",
      limit: "1",
    }),
    supabase.select("compras_sync_requests", {
      select: "finished_at",
      sync_type: "eq.VENTAS",
      status: "eq.COMPLETADO",
      order: "finished_at.desc,id.desc",
      limit: "1",
    }),
  ]);
  const importTime = latestImport[0]?.fecha_importacion
    ? new Date(latestImport[0].fecha_importacion).getTime()
    : 0;
  const requestTime = latestRequest[0]?.finished_at
    ? new Date(latestRequest[0].finished_at).getTime()
    : 0;
  const lastTime = Math.max(importTime, requestTime);
  if (lastTime && Date.now() - lastTime < SYNC_INTERVAL_MS) return;
  try {
    await supabase.insert("compras_sync_requests", {
      sync_type: "VENTAS",
      status: "PENDIENTE",
      requested_by: "bridge:scheduler",
      metadata: { source: "scheduler", intervalMs: SYNC_INTERVAL_MS },
    });
  } catch (error) {
    if (error?.status !== 409) throw error;
  }
}

let running = false;
let lastRunAt = null;
let lastError = null;

async function tick(supabase) {
  if (running) return;
  running = true;
  try {
    await ensureScheduledRequest(supabase);
    const requestId = await claimPendingRequest(supabase);
    if (requestId) await executeSync(supabase, requestId);
    lastRunAt = new Date().toISOString();
    lastError = null;
  } catch (error) {
    lastError = String(error?.message ?? error);
    console.error("Ventas sync:", error);
  } finally {
    running = false;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const once = process.argv.includes("--once") || dryRun;
  if (dryRun) {
    await executeSync(null, null, true);
    return;
  }

  const supabase = new SupabaseRest();
  if (once) {
    await tick(supabase);
    if (lastError) throw new Error(lastError);
    return;
  }

  const server = createServer((request, response) => {
    if (request.method !== "GET" || request.url !== "/health") {
      response.writeHead(404, { "Content-Type": "application/json" });
      return response.end(JSON.stringify({ error: "NOT_FOUND" }));
    }
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify({ status: lastError ? "degraded" : "ok", running, lastRunAt, lastError }));
  });
  server.listen(port, host, () => console.log(`Ventas Bridge escuchando en http://${host}:${port}`));

  await tick(supabase);
  const timer = setInterval(() => void tick(supabase), POLL_MS);
  const shutdown = () => {
    clearInterval(timer);
    server.close();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("Ventas sync fatal:", error);
    process.exitCode = 1;
  });
}
