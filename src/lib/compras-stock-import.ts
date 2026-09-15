import "server-only";

import { createHash } from "node:crypto";
import * as XLSX from "xlsx";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

const SOURCE_SYSTEM = "WMS";
const DEPOSITO = "WARNES";
const PARSER_VERSION = "wms-stock-v1";
const INSERT_BATCH_SIZE = 500;

type RawCell = string | number | boolean | Date | null | undefined;
type RawRow = RawCell[];

export type WmsStockImportError = {
  sourceRowNumber: number;
  skuRaw: string;
  errorCode: string;
  errorMessage: string;
  rawData: Record<string, unknown>;
};

export type WmsStockItem = {
  sku: string;
  stock: number;
  sourceRowNumber: number;
};

export type WmsStockParseResult = {
  fileName: string;
  fileSha256: string;
  worksheet: string;
  headerRowNumber: number;
  sourceRows: number;
  validRows: number;
  rejectedRows: number;
  uniqueSkus: number;
  duplicateSkus: number;
  mergedRows: number;
  totalStock: number;
  items: WmsStockItem[];
  errors: WmsStockImportError[];
};

export type WmsStockImportResult = Omit<WmsStockParseResult, "items" | "errors"> & {
  importId: number;
  status: "VALIDADO";
};

function text(value: RawCell) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\u00a0/g, " ").trim();
}

function normalizeHeader(value: RawCell) {
  return text(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeSku(value: RawCell) {
  return text(value)
    .replace(/\s+/g, "")
    .toUpperCase();
}

function localizedNumber(value: RawCell): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = text(value).replace(/\s/g, "");
  if (!raw) return null;

  let normalized = raw;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized =
      normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowHasContent(row: RawRow) {
  return row.some((cell) => text(cell) !== "");
}

function toBuffer(input: ArrayBuffer | Uint8Array | Buffer) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  return Buffer.from(input);
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function batch<T>(rows: T[], size = INSERT_BATCH_SIZE) {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    result.push(rows.slice(index, index + size));
  }
  return result;
}

function detectHeader(rows: RawRow[]) {
  const limit = Math.min(rows.length, 30);

  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const headers = rows[rowIndex].map(normalizeHeader);
    const skuColumn = headers.indexOf("ARTICULO");
    const stockColumn = headers.indexOf("UNIDADES_DISPONIBLES");

    if (skuColumn >= 0 && stockColumn >= 0) {
      return {
        headerRowIndex: rowIndex,
        headerRowNumber: rowIndex + 1,
        skuColumn,
        stockColumn,
      };
    }
  }

  throw new Error(
    'No se encontraron las columnas "Artículo" y "Unidades Disponibles" en las primeras 30 filas del archivo WMS.',
  );
}

export function parseWmsStockFile(
  input: ArrayBuffer | Uint8Array | Buffer,
  fileName: string,
): WmsStockParseResult {
  const normalizedFileName = fileName.trim();
  if (!normalizedFileName) throw new Error("El archivo WMS debe tener un nombre.");

  if (!/\.(xls|xlsx)$/i.test(normalizedFileName)) {
    throw new Error("El archivo WMS debe estar en formato .xls o .xlsx.");
  }

  const fileBuffer = toBuffer(input);
  if (!fileBuffer.length) throw new Error("El archivo WMS está vacío.");

  const workbook = XLSX.read(fileBuffer, {
    type: "buffer",
    cellDates: false,
  });

  const worksheetName = workbook.SheetNames[0];
  if (!worksheetName) throw new Error("El archivo WMS no contiene hojas.");

  const worksheet = workbook.Sheets[worksheetName];
  if (!worksheet) throw new Error("No se pudo leer la primera hoja del archivo WMS.");

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  }) as RawRow[];

  const header = detectHeader(rows);
  const sourceRows = rows.slice(header.headerRowIndex + 1);

  const errors: WmsStockImportError[] = [];
  const aggregated = new Map<
    string,
    { stock: number; sourceRowNumber: number; occurrences: number }
  >();

  let processedSourceRows = 0;
  let validRows = 0;

  sourceRows.forEach((row: RawRow, relativeIndex: number) => {
    if (!rowHasContent(row)) return;

    processedSourceRows += 1;

    const sourceRowNumber = header.headerRowNumber + relativeIndex + 1;
    const skuRaw = text(row[header.skuColumn]);
    const sku = normalizeSku(row[header.skuColumn]);
    const stock = localizedNumber(row[header.stockColumn]);

    if (!sku) {
      errors.push({
        sourceRowNumber,
        skuRaw,
        errorCode: "MISSING_SKU",
        errorMessage: "La fila no contiene Artículo/SKU.",
        rawData: {
          articulo: row[header.skuColumn] ?? null,
          unidadesDisponibles: row[header.stockColumn] ?? null,
        },
      });
      return;
    }

    if (stock === null) {
      errors.push({
        sourceRowNumber,
        skuRaw,
        errorCode: "INVALID_STOCK",
        errorMessage: "Unidades Disponibles no contiene un valor numérico válido.",
        rawData: {
          articulo: row[header.skuColumn] ?? null,
          unidadesDisponibles: row[header.stockColumn] ?? null,
        },
      });
      return;
    }

    validRows += 1;

    const current = aggregated.get(sku);
    if (current) {
      current.stock += stock;
      current.occurrences += 1;
    } else {
      aggregated.set(sku, {
        stock,
        sourceRowNumber,
        occurrences: 1,
      });
    }
  });

  const items: WmsStockItem[] = Array.from(aggregated, ([sku, item]) => ({
    sku,
    stock: Number(item.stock.toFixed(3)),
    sourceRowNumber: item.sourceRowNumber,
  })).sort((a, b) => a.sku.localeCompare(b.sku));

  if (!items.length) {
    throw new Error("El archivo WMS no contiene ningún SKU válido para importar.");
  }

  const duplicateSkus = Array.from(aggregated.values()).filter(
    (item) => item.occurrences > 1,
  ).length;

  const totalStock = Number(
    items.reduce((sum, item) => sum + item.stock, 0).toFixed(3),
  );

  return {
    fileName: normalizedFileName,
    fileSha256: sha256(fileBuffer),
    worksheet: worksheetName,
    headerRowNumber: header.headerRowNumber,
    sourceRows: processedSourceRows,
    validRows,
    rejectedRows: errors.length,
    uniqueSkus: items.length,
    duplicateSkus,
    mergedRows: Math.max(0, validRows - items.length),
    totalStock,
    items,
    errors,
  };
}

async function removeRetryablePreviousImport(importId: number) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("compras_stock_imports")
    .delete()
    .eq("id", importId);

  if (error) {
    throw new Error(
      `Existe una importación previa fallida del mismo archivo, pero no pudo limpiarse para reintentar: ${error.message}`,
    );
  }
}

export async function importWmsStockFile(
  input: ArrayBuffer | Uint8Array | Buffer,
  fileName: string,
  requestedBy?: string | null,
): Promise<WmsStockImportResult> {
  const parsed = parseWmsStockFile(input, fileName);
  const supabase = getSupabaseAdmin();

  const { data: previous, error: previousError } = await supabase
    .from("compras_stock_imports")
    .select("id, estado, archivo_origen, fecha_importacion")
    .eq("source_system", SOURCE_SYSTEM)
    .eq("deposito", DEPOSITO)
    .eq("archivo_sha256", parsed.fileSha256)
    .maybeSingle();

  if (previousError) {
    throw new Error(
      `No se pudo verificar si el archivo WMS ya fue importado: ${previousError.message}`,
    );
  }

  if (previous) {
    if (previous.estado === "ERROR" || previous.estado === "DESCARTADO") {
      await removeRetryablePreviousImport(Number(previous.id));
    } else {
      throw new Error(
        `Este archivo WMS ya fue importado anteriormente (importación #${previous.id}, estado ${previous.estado}).`,
      );
    }
  }

  const metadata = {
    parserVersion: PARSER_VERSION,
    worksheet: parsed.worksheet,
    headerRowNumber: parsed.headerRowNumber,
    duplicateSkus: parsed.duplicateSkus,
    mergedRows: parsed.mergedRows,
    uniqueSkus: parsed.uniqueSkus,
    totalStock: parsed.totalStock,
    requestedBy: requestedBy?.trim() || null,
  };

  const { data: created, error: createError } = await supabase
    .from("compras_stock_imports")
    .insert({
      source_system: SOURCE_SYSTEM,
      deposito: DEPOSITO,
      archivo_origen: parsed.fileName,
      archivo_sha256: parsed.fileSha256,
      estado: "PROCESANDO",
      filas_origen: parsed.sourceRows,
      filas_validas: parsed.validRows,
      filas_rechazadas: parsed.rejectedRows,
      metadata,
    })
    .select("id")
    .single();

  if (createError || !created?.id) {
    throw new Error(
      `No se pudo iniciar la importación WMS en Supabase: ${createError?.message || "respuesta sin ID"}`,
    );
  }

  const importId = Number(created.id);

  try {
    const itemRows = parsed.items.map((item) => ({
      import_id: importId,
      sku: item.sku,
      stock: item.stock,
      source_row_number: item.sourceRowNumber,
    }));

    for (const rows of batch(itemRows)) {
      const { error } = await supabase
        .from("compras_stock_import_items")
        .insert(rows);

      if (error) {
        throw new Error(`No se pudieron guardar los SKU del WMS: ${error.message}`);
      }
    }

    if (parsed.errors.length) {
      const errorRows = parsed.errors.map((item) => ({
        import_id: importId,
        source_row_number: item.sourceRowNumber,
        sku_raw: item.skuRaw || null,
        error_code: item.errorCode,
        error_message: item.errorMessage,
        raw_data: item.rawData,
      }));

      for (const rows of batch(errorRows)) {
        const { error } = await supabase
          .from("compras_stock_import_errors")
          .insert(rows);

        if (error) {
          throw new Error(
            `No se pudieron guardar los errores detectados en el WMS: ${error.message}`,
          );
        }
      }
    }

    const { error: validateError } = await supabase
      .from("compras_stock_imports")
      .update({
        estado: "VALIDADO",
        filas_origen: parsed.sourceRows,
        filas_validas: parsed.validRows,
        filas_rechazadas: parsed.rejectedRows,
        error_message: null,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", importId);

    if (validateError) {
      throw new Error(
        `Los datos se cargaron, pero no se pudo validar la importación: ${validateError.message}`,
      );
    }

    return {
      importId,
      status: "VALIDADO",
      fileName: parsed.fileName,
      fileSha256: parsed.fileSha256,
      worksheet: parsed.worksheet,
      headerRowNumber: parsed.headerRowNumber,
      sourceRows: parsed.sourceRows,
      validRows: parsed.validRows,
      rejectedRows: parsed.rejectedRows,
      uniqueSkus: parsed.uniqueSkus,
      duplicateSkus: parsed.duplicateSkus,
      mergedRows: parsed.mergedRows,
      totalStock: parsed.totalStock,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido durante la importación WMS.";

    await supabase
      .from("compras_stock_imports")
      .update({
        estado: "ERROR",
        error_message: message.slice(0, 4000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", importId);

    throw error;
  }
}
