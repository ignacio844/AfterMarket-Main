import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { JWT } from "google-auth-library";

const REFERENCE_SHEETS = ["ENVIOS_COMPRA", "COMPRAS_EN_PROCESO", "MOVIMIENTOS_COMPRA", "ORDENES_COMPRA_PORTAL"];
const SHEETS = ["GESTION_COMPRAS", "GESTION_COMPRAS_ACTIVA", ...REFERENCE_SHEETS];
const STATES = new Set(["PENDIENTE", "COTIZAR", "APROBADO", "NO COMPRAR", "POSTERGAR", "ENVIADO A COMPRA"]);
const DECISION_FIELDS = ["ESTADO_GESTION", "CANTIDAD_DECIDIDA", "RESPONSABLE", "OBSERVACION", "FECHA_DECISION"];
const REQUIRED = {
  GESTION_COMPRAS: ["SKU", ...DECISION_FIELDS, "ACTIVO_EN_PLAN"],
  GESTION_COMPRAS_ACTIVA: ["SKU", "RIESGO", "COMPRA_SUGERIDA", ...DECISION_FIELDS],
};

function headerName(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/\s+/g, "_");
}

function skuKey(value) {
  return String(value ?? "").trim().toUpperCase();
}

function cell(row, index) {
  return index < 0 ? "" : row[index] ?? "";
}

function comparable(field, value) {
  if (field === "ESTADO_GESTION") return String(value || "PENDIENTE").trim().toUpperCase();
  if (field === "CANTIDAD_DECIDIDA") return value === "" || value === null ? "" : String(Number(value));
  if (field === "FECHA_DECISION") return value === "" || value === null ? "" : String(value);
  return String(value ?? "").trim();
}

function inspectSheet(name, rows) {
  const headers = (rows[0] ?? []).map(headerName);
  const indexes = new Map(headers.map((header, index) => [header, index]));
  const missingHeaders = REQUIRED[name].filter((header) => !indexes.has(header));
  const records = new Map();
  const duplicateSkus = [];
  const invalidStates = [];
  const invalidQuantities = [];
  const oversizedObservations = [];
  let blankSkus = 0;

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const sku = skuKey(cell(row, indexes.get("SKU") ?? -1));
    if (!sku) {
      if (row.some((value) => value !== "" && value !== null)) blankSkus += 1;
      continue;
    }
    if (records.has(sku)) duplicateSkus.push(sku);
    else records.set(sku, row);

    const state = String(cell(row, indexes.get("ESTADO_GESTION") ?? -1) || "PENDIENTE").trim().toUpperCase();
    if (indexes.has("ESTADO_GESTION") && !STATES.has(state)) invalidStates.push(sku);
    const quantity = cell(row, indexes.get("CANTIDAD_DECIDIDA") ?? -1);
    if (indexes.has("CANTIDAD_DECIDIDA") && quantity !== "" && (!Number.isFinite(Number(quantity)) || Number(quantity) < 0)) invalidQuantities.push(sku);
    const observation = cell(row, indexes.get("OBSERVACION") ?? -1);
    if (indexes.has("OBSERVACION") && String(observation).length > 1000) oversizedObservations.push(sku);
  }

  return {
    indexes,
    records,
    summary: {
      rows: Math.max(0, rows.length - 1),
      uniqueSkus: records.size,
      missingHeaders,
      blankSkus,
      duplicateSkus: { count: duplicateSkus.length, sample: duplicateSkus.slice(0, 10) },
      invalidStates: { count: invalidStates.length, sample: invalidStates.slice(0, 10) },
      invalidQuantities: { count: invalidQuantities.length, sample: invalidQuantities.slice(0, 10) },
      oversizedObservations: { count: oversizedObservations.length, sample: oversizedObservations.slice(0, 10) },
    },
  };
}

export function auditGestionSheets(sheets) {
  const persistent = inspectSheet("GESTION_COMPRAS", sheets.GESTION_COMPRAS ?? []);
  const active = inspectSheet("GESTION_COMPRAS_ACTIVA", sheets.GESTION_COMPRAS_ACTIVA ?? []);
  const differences = Object.fromEntries(DECISION_FIELDS.map((field) => [field, { count: 0, sample: [] }]));
  let activeWithoutPersistent = 0;
  let persistentWithoutActive = 0;
  let inactivePersistent = 0;
  const conflictingSkus = new Set();

  if (!persistent.summary.missingHeaders.length && !active.summary.missingHeaders.length) {
    for (const [sku, activeRow] of active.records) {
      const persistentRow = persistent.records.get(sku);
      if (!persistentRow) {
        activeWithoutPersistent += 1;
        continue;
      }
      for (const field of DECISION_FIELDS) {
        const left = comparable(field, cell(activeRow, active.indexes.get(field)));
        const right = comparable(field, cell(persistentRow, persistent.indexes.get(field)));
        if (left !== right) {
          conflictingSkus.add(sku);
          differences[field].count += 1;
          if (differences[field].sample.length < 10) {
            differences[field].sample.push(
              field === "ESTADO_GESTION" || field === "FECHA_DECISION"
                ? { sku, active: left, persistent: right }
                : { sku },
            );
          }
        }
      }
    }
    for (const [sku, row] of persistent.records) {
      if (!active.records.has(sku)) persistentWithoutActive += 1;
      if (String(cell(row, persistent.indexes.get("ACTIVO_EN_PLAN"))).trim().toUpperCase() === "NO") inactivePersistent += 1;
    }
  }

  const conflictingSkuReferences = [...conflictingSkus].map((sku) => ({
    sku,
    references: Object.fromEntries(REFERENCE_SHEETS.map((name) => {
      const rows = sheets[name] ?? [];
      const skuIndex = (rows[0] ?? []).map(headerName).indexOf("SKU");
      const count = skuIndex < 0 ? null : rows.slice(1).filter((row) => skuKey(cell(row, skuIndex)) === sku).length;
      return [name, count];
    })),
  }));

  return {
    sheets: { GESTION_COMPRAS: persistent.summary, GESTION_COMPRAS_ACTIVA: active.summary },
    reconciliation: {
      activeWithoutPersistent,
      persistentWithoutActive,
      inactivePersistent,
      decisionDifferences: differences,
      conflictingSkuReferences,
    },
  };
}

export function hasBlockingGestionIssues(audit) {
  return Object.values(audit.sheets).some((sheet) =>
    sheet.missingHeaders.length > 0 ||
    sheet.blankSkus > 0 ||
    sheet.duplicateSkus.count > 0 ||
    sheet.invalidStates.count > 0 ||
    sheet.invalidQuantities.count > 0 ||
    sheet.oversizedObservations.count > 0,
  );
}

async function readLiveSheets() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!spreadsheetId || !email || !key) throw new Error("Falta configurar el acceso de solo lectura a Google Sheets.");
  const client = new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("No se pudo autenticar la cuenta de servicio de Google.");
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet`);
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "SERIAL_NUMBER");
  for (const name of SHEETS) url.searchParams.append("ranges", `'${name}'`);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`No se pudo leer Google Sheets (HTTP ${response.status}).`);
  const body = await response.json();
  if (body.valueRanges?.length !== SHEETS.length) throw new Error("No se recibieron todas las hojas de conciliación de Gestión.");
  return Object.fromEntries(SHEETS.map((name, index) => [name, body.valueRanges[index]?.values ?? []]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = auditGestionSheets(await readLiveSheets());
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (hasBlockingGestionIssues(result)) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
