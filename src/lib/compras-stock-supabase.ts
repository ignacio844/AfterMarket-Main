import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SheetRows, SheetValue } from "@/lib/compras-dashboard";

export type ComprasStockWarnesActual = {
  stockBySku: Map<string, number>;
  fechaImportacion: string | null;
  importId: number | null;
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
  let fechaImportacion: string | null = null;
  let importId: number | null = null;

  const PAGE_SIZE = 1000;

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("compras_stock_actual_por_sku")
      .select("sku,stock_warnes,fecha_stock_warnes,import_id_warnes")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`No se pudo leer el stock WARNES desde Supabase: ${error.message}`);
    }

    const rows = data ?? [];

    for (const row of rows) {
      const sku = normalizeSku(row.sku);
      if (!sku) continue;

      stockBySku.set(sku, numberValue(row.stock_warnes));

      if (!fechaImportacion && row.fecha_stock_warnes) {
        fechaImportacion = String(row.fecha_stock_warnes);
      }

      if (importId === null && row.import_id_warnes !== null && row.import_id_warnes !== undefined) {
        importId = Number(row.import_id_warnes);
      }
    }

    if (rows.length < PAGE_SIZE) break;
  }

  if (!stockBySku.size) {
    throw new Error(
      "Supabase no contiene un snapshot WARNES validado en compras_stock_actual_por_sku.",
    );
  }

  return { stockBySku, fechaImportacion, importId };
}

export function applyWarnesStockToDashboardModel(
  modelo: SheetRows,
  stockBySku: Map<string, number>,
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

  for (let rowIndex = 2; rowIndex < result.length; rowIndex += 1) {
    const row = result[rowIndex];
    const sku = normalizeSku(row[skuIndex]);
    if (!sku) continue;

    // El snapshot representa el inventario completo de WARNES.
    // Si el SKU no existe en el último snapshot, su stock actual es 0.
    const warnes = stockBySku.get(sku) ?? 0;
    row[warnesIndex] = warnes;

    // Durante la transición ESCOBAR sigue viniendo del modelo legacy.
    // Recalculamos únicamente STOCK_TOTAL para que el Dashboard utilice
    // WARNES de Supabase + ESCOBAR de Sheets.
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
  if (!fechaImportacion) return controlStock;

  if (!controlStock.length) {
    return [
      ["DEPOSITO", "ULTIMA_IMPORTACION"],
      ["WARNES", fechaImportacion],
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

    if (deposito.includes("WARNES")) {
      result[rowIndex][fechaIndex] = fechaImportacion;
      updated = true;
      break;
    }
  }

  if (!updated) {
    const row: SheetValue[] = Array.from({ length: result[0].length }, () => "");
    row[depositoIndex] = "WARNES";
    row[fechaIndex] = fechaImportacion;
    result.push(row);
  }

  return result;
}
