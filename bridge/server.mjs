import { timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import sql from "mssql";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REQUEST_RANGE_DAYS = 93;
const TWO_HOURS_MS = 2 * 60 * 60 * 1_000;
const host = process.env.BRIDGE_HOST ?? "127.0.0.1";
const port = Number(process.env.BRIDGE_PORT ?? 8788);
const token = process.env.BRIDGE_TOKEN;
const refreshIntervalMs = Math.max(
  60_000,
  Number(process.env.EXECUTIVE_REFRESH_INTERVAL_MS ?? TWO_HOURS_MS),
);
const cachePath = resolve(
  process.env.EXECUTIVE_CACHE_PATH ?? resolve(process.cwd(), ".runtime", "executive-daily-lines-cache.json"),
);

if (!token || token.length < 32) {
  throw new Error("BRIDGE_TOKEN debe estar configurado y tener al menos 32 caracteres.");
}

function booleanEnv(value, fallback) {
  return value === undefined ? fallback : value.toLowerCase() === "true";
}

function getSqlConfig() {
  const required = ["SQL_SERVER", "SQL_DATABASE", "SQL_USER", "SQL_PASSWORD"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Faltan variables SQL: ${missing.join(", ")}`);

  return {
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    port: Number(process.env.SQL_PORT ?? 1433),
    connectionTimeout: 15_000,
    requestTimeout: 120_000,
    options: {
      encrypt: booleanEnv(process.env.SQL_ENCRYPT, true),
      trustServerCertificate: booleanEnv(process.env.SQL_TRUST_SERVER_CERTIFICATE, true),
    },
    pool: { min: 0, max: 2, idleTimeoutMillis: 10_000 },
  };
}

function isAuthorized(request) {
  const authorization = request.headers.authorization ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expectedBuffer = Buffer.from(token);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function localDateText(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function refreshRange() {
  const toText = localDateText();
  const defaultFrom = `${toText.slice(0, 4)}-01-01`;
  const fromText = process.env.EXECUTIVE_CACHE_FROM || defaultFrom;
  if (!ISO_DATE.test(fromText) || fromText > toText) throw new Error("INVALID_CACHE_RANGE");
  return {
    fromText,
    toText,
    from: addDays(fromText, 0),
    toExclusive: addDays(toText, 1),
  };
}

function parseRequestRange(url) {
  const fromText = url.searchParams.get("from");
  const toText = url.searchParams.get("to");
  if (!fromText || !toText || !ISO_DATE.test(fromText) || !ISO_DATE.test(toText)) {
    throw new Error("INVALID_DATE");
  }
  const days = (addDays(toText, 0).getTime() - addDays(fromText, 0).getTime()) / 86_400_000;
  if (days < 0 || days > MAX_REQUEST_RANGE_DAYS) throw new Error("INVALID_RANGE");
  return { fromText, toText };
}

function respond(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function queryDailyLines(range) {
  let pool;
  try {
    pool = await new sql.ConnectionPool(getSqlConfig()).connect();
    return await pool.request()
      .input("FechaDesde", sql.Date, range.from)
      .input("FechaHasta", sql.Date, range.toExclusive)
      .query(`
        WITH Renglones AS (
          SELECT
            CAST(fecha AS date) AS fecha,
            [Base_Origen],
            cuit_cl,
            [Razon_social_cliente],
            num_pedido,
            nume_comprobante,
            [Nombre_vendedor_cliente],
            [Nombre_vendedor_factura],
            [articulo],
            [desc_articulo],
            [Desc_familia]
          FROM dbo.Vista_Ventas_origen_v2
          WHERE fecha >= @FechaDesde
            AND fecha < @FechaHasta
            AND cod_cliente >= 1
            AND cod_cliente <= 999999
            AND num_pedido >= 1
            AND num_pedido <= 9999999
          GROUP BY
            CAST(fecha AS date),
            [Base_Origen],
            cuit_cl,
            [Razon_social_cliente],
            num_pedido,
            nume_comprobante,
            [Nombre_vendedor_cliente],
            [Nombre_vendedor_factura],
            [articulo],
            [desc_articulo],
            [Desc_familia]
        ),
        Totales AS (
          SELECT fecha, COUNT(*) AS renglones
          FROM Renglones
          GROUP BY fecha
        ),
        Pedidos AS (
          SELECT fecha, COUNT(*) AS pedidos
          FROM (
            SELECT DISTINCT fecha, [Base_Origen], num_pedido
            FROM Renglones
          ) AS PedidosUnicos
          GROUP BY fecha
        ),
        Marcas AS (
          SELECT
            fecha,
            LTRIM(RTRIM([Desc_familia])) AS desc_familia,
            COUNT(*) AS marca_renglones
          FROM Renglones
          WHERE NULLIF(LTRIM(RTRIM([Desc_familia])), '') IS NOT NULL
          GROUP BY fecha, LTRIM(RTRIM([Desc_familia]))
        )
        SELECT
          CONVERT(varchar(10), Totales.fecha, 23) AS fecha,
          Totales.renglones,
          Pedidos.pedidos,
          Marcas.desc_familia,
          Marcas.marca_renglones
        FROM Totales
        INNER JOIN Pedidos ON Pedidos.fecha = Totales.fecha
        LEFT JOIN Marcas ON Marcas.fecha = Totales.fecha
        ORDER BY Totales.fecha, Marcas.marca_renglones DESC;
      `);
  } finally {
    await pool?.close().catch(() => undefined);
  }
}

let cache = { updatedAt: null, range: null, rows: [], brandRows: [] };
let refreshing = false;

async function loadPersistedCache() {
  try {
    const stored = JSON.parse(await readFile(cachePath, "utf8"));
    if (
      typeof stored.updatedAt === "string" &&
      stored.range &&
      ISO_DATE.test(stored.range.from) &&
      ISO_DATE.test(stored.range.to) &&
      Array.isArray(stored.rows)
    ) {
      cache = {
        ...stored,
        brandRows: Array.isArray(stored.brandRows) ? stored.brandRows : [],
      };
      console.log(`Caché restaurada. Última actualización: ${cache.updatedAt}`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") console.error("No se pudo restaurar la caché:", error);
  }
}

async function persistCache() {
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(cache), "utf8");
}

async function refreshCache() {
  if (refreshing) return;
  refreshing = true;
  const startedAt = Date.now();

  try {
    const range = refreshRange();
    console.log(`Actualizando caché SQL desde ${range.fromText} hasta ${range.toText}...`);
    const result = await queryDailyLines(range);
    const rowsByDate = new Map();
    const brandRows = [];
    for (const row of result.recordset) {
      if (!rowsByDate.has(row.fecha)) {
        rowsByDate.set(row.fecha, {
          fecha: row.fecha,
          renglones: row.renglones,
          pedidos: row.pedidos,
        });
      }
      if (typeof row.desc_familia === "string" && row.desc_familia.trim() && Number(row.marca_renglones) > 0) {
        brandRows.push({
          fecha: row.fecha,
          desc_familia: row.desc_familia.trim(),
          renglones: Number(row.marca_renglones),
        });
      }
    }
    cache = {
      updatedAt: new Date().toISOString(),
      range: { from: range.fromText, to: range.toText },
      rows: [...rowsByDate.values()],
      brandRows,
    };
    await persistCache();
    console.log(`Caché actualizada con ${cache.rows.length} días y ${cache.brandRows.length} totales diarios por familia en ${Date.now() - startedAt} ms.`);
  } catch (error) {
    console.error("No se pudo actualizar la caché; se conserva la última copia válida:", error);
  } finally {
    refreshing = false;
  }
}

await loadPersistedCache();

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    return respond(response, 200, {
      status: "ok",
      cacheUpdatedAt: cache.updatedAt,
      refreshing,
    });
  }
  const isDailyLines = url.pathname === "/executive/daily-lines";
  const isBrandLines = url.pathname === "/executive/brand-lines";
  if (request.method !== "GET" || (!isDailyLines && !isBrandLines)) {
    return respond(response, 404, { error: "NOT_FOUND" });
  }
  if (!isAuthorized(request)) return respond(response, 401, { error: "UNAUTHORIZED" });

  try {
    const range = parseRequestRange(url);
    if (!cache.updatedAt) return respond(response, 503, { error: "CACHE_NOT_READY" });
    const sourceRows = isBrandLines ? cache.brandRows : cache.rows;
    const rows = sourceRows.filter((row) => row.fecha >= range.fromText && row.fecha <= range.toText);
    return respond(response, 200, {
      rows,
      range: { from: range.fromText, to: range.toText },
      cacheRange: cache.range,
      updatedAt: cache.updatedAt,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "BRIDGE_ERROR";
    if (code === "INVALID_DATE" || code === "INVALID_RANGE") {
      return respond(response, 400, { error: code });
    }
    console.error("Error leyendo la caché de renglones:", error);
    return respond(response, 500, { error: "CACHE_ERROR" });
  }
});

server.listen(port, host, () => {
  console.log(`Executive Bridge escuchando en http://${host}:${port}`);
  void refreshCache();
});

const refreshTimer = setInterval(() => void refreshCache(), refreshIntervalMs);

function shutdown() {
  clearInterval(refreshTimer);
  server.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
