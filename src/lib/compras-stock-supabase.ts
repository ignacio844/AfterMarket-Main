import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SheetRows, SheetValue } from "@/lib/compras-dashboard";

export type ComprasStockWarnesActual = {
  stockBySku: Map<string, number>;
  stockEscobarBySku: Map<string, number>;
  fechaImportacion: string | null;
  fechaImportacionEscobar: string | null;
  importId: number | null;
  importIdEscobar: number | null;
};

function normalizeSku(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function normalizeHeader(value: SheetValue | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getComprasStockWarnesActual(): Promise<ComprasStockWarnesActual> {
  const supabase = getSupabaseAdmin();

  const stockBySku = new Map<string, number>();
  const stockEscobarBySku = new Map<string, number>();
  let fechaImportacion: string | null = null;
  let fechaImportacionEscobar: string | null = null;
  let importId: number | null = null;
  let importIdEscobar: number | null = null;

  const PAGE_SIZE = 1000;

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("compras_stock_actual_por_sku")
      .select("sku,stock_warnes,stock_escobar,fecha_stock_warnes,fecha_stock_escobar,import_id_warnes,import_id_escobar")
      .order("sku")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`No se pudo leer el stock WARNES desde Supabase: ${error.message}`);
    }

    const rows = data ?? [];

    for (const row of rows) {
      const sku = normalizeSku(row.sku);
      if (!sku) continue;

      if (row.import_id_warnes !== null && row.import_id_warnes !== undefined) {
        stockBySku.set(sku, numberValue(row.stock_warnes));
      }
      if (row.import_id_escobar !== null && row.import_id_escobar !== undefined) {
        stockEscobarBySku.set(sku, numberValue(row.stock_escobar));
      }

      if (!fechaImportacion && row.fecha_stock_warnes) {
        fechaImportacion = String(row.fecha_stock_warnes);
      }

      if (importId === null && row.import_id_warnes !== null && row.import_id_warnes !== undefined) {
        importId = Number(row.import_id_warnes);
      } else if (row.import_id_warnes != null && importId !== Number(row.import_id_warnes)) {
        throw new Error("El snapshot WARNES cambió durante la lectura. Reintentá la carga del Dashboard.");
      }
      if (!fechaImportacionEscobar && row.fecha_stock_escobar) {
        fechaImportacionEscobar = String(row.fecha_stock_escobar);
      }
      if (importIdEscobar === null && row.import_id_escobar !== null && row.import_id_escobar !== undefined) {
        importIdEscobar = Number(row.import_id_escobar);
      } else if (row.import_id_escobar != null && importIdEscobar !== Number(row.import_id_escobar)) {
        throw new Error("El snapshot ESCOBAR cambió durante la lectura. Reintentá la carga del Dashboard.");
      }
    }

    if (rows.length < PAGE_SIZE) break;
  }

  if (!stockBySku.size) {
    throw new Error(
      "Supabase no contiene un snapshot WARNES validado en compras_stock_actual_por_sku.",
    );
  }

  return { stockBySku, stockEscobarBySku, fechaImportacion, fechaImportacionEscobar, importId, importIdEscobar };
}

export function applyWarnesStockToDashboardModel(
  modelo: SheetRows,
  stockBySku: Map<string, number>,
  stockEscobarBySku?: Map<string, number>,
): SheetRows {
  if (modelo.length < 2) return modelo;

  const result = modelo.map((row) => [...row]);
  const headers = result[1].map(normalizeHeader);

  const skuIndex = headers.indexOf("SKU");
  const warnesIndex = headers.indexOf("STOCK_WARNES");
  const escobarIndex = headers.indexOf("STOCK_ESCOBAR");
  const totalIndex = headers.indexOf("STOCK_TOTAL");

  if (skuIndex < 0) {
    throw new Error("MODELO_COMPRAS debe contener la columna SKU.");
  }

  if (warnesIndex < 0) {
    throw new Error(
      "MODELO_COMPRAS debe contener STOCK_WARNES para reemplazarlo por Supabase.",
    );
  }
  if (stockEscobarBySku && escobarIndex < 0) {
    throw new Error("MODELO_COMPRAS debe contener STOCK_ESCOBAR para reemplazarlo por Supabase.");
  }

  for (let rowIndex = 2; rowIndex < result.length; rowIndex += 1) {
    const row = result[rowIndex];
    const sku = normalizeSku(row[skuIndex]);
    if (!sku) continue;

    // El snapshot representa el inventario completo de WARNES.
    // Si el SKU no existe en el último snapshot, su stock actual es 0.
    const warnes = stockBySku.get(sku) ?? 0;
    row[warnesIndex] = warnes;

    if (stockEscobarBySku) {
      row[escobarIndex] = stockEscobarBySku.get(sku) ?? 0;
    }

    // Sin snapshot Escobar validado se conserva el valor legacy de Sheets.
    // Cuando existe, ambos depósitos se leen exclusivamente de Supabase.
    if (totalIndex >= 0 && escobarIndex >= 0) {
      row[totalIndex] = warnes + numberValue(row[escobarIndex]);
    }
  }

  return result;
}

export function applyWarnesImportDateToControlStock(
  controlStock: SheetRows,
  fechaImportacion: string | null,
): SheetRows {
  return applyStockImportDateToControlStock(controlStock, "WARNES", fechaImportacion);
}

export function applyEscobarImportDateToControlStock(
  controlStock: SheetRows,
  fechaImportacion: string | null,
): SheetRows {
  return applyStockImportDateToControlStock(controlStock, "ESCOBAR", fechaImportacion);
}

function applyStockImportDateToControlStock(
  controlStock: SheetRows,
  depositoNombre: "WARNES" | "ESCOBAR",
  fechaImportacion: string | null,
): SheetRows {
  if (!fechaImportacion) return controlStock;

  if (!controlStock.length) {
    return [
      ["DEPOSITO", "ULTIMA_IMPORTACION"],
      [depositoNombre, fechaImportacion],
    ];
  }

  const result = controlStock.map((row) => [...row]);
  const headers = result[0].map(normalizeHeader);
  const depositoIndex = headers.indexOf("DEPOSITO");
  const fechaIndex = headers.indexOf("ULTIMA_IMPORTACION");

  if (depositoIndex < 0 || fechaIndex < 0) return result;

  let updated = false;

  for (let rowIndex = 1; rowIndex < result.length; rowIndex += 1) {
    const deposito = String(result[rowIndex][depositoIndex] ?? "")
      .trim()
      .toUpperCase();

    if (deposito.includes(depositoNombre)) {
      result[rowIndex][fechaIndex] = fechaImportacion;
      updated = true;
      break;
    }
  }

  if (!updated) {
    const row: SheetValue[] = Array.from({ length: result[0].length }, () => "");
    row[depositoIndex] = depositoNombre;
    row[fechaIndex] = fechaImportacion;
    result.push(row);
  }

  return result;
}
