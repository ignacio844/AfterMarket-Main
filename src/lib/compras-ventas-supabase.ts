import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SheetRows } from "@/lib/compras-dashboard";
import {
  normalizeVentasSku,
  type ComprasVentasDemanda,
} from "@/lib/compras-ventas-model";

export type ComprasVentasActual = {
  importId: number | null;
  fechaImportacion: string | null;
  sourceMaxDate: string | null;
  demandaBySku: Map<string, ComprasVentasDemanda>;
};

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getComprasVentasActual(): Promise<ComprasVentasActual> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("compras_ventas_actual_import")
    .select("import_id,fecha_importacion,source_max_date")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer la frescura de Ventas desde Supabase: ${error.message}`);
  }
  if (!data) {
    throw new Error("Supabase no contiene un snapshot de Ventas validado.");
  }

  const demandaBySku = new Map<string, ComprasVentasDemanda>();
  const PAGE_SIZE = 1000;

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: demanda, error: demandaError } = await supabase
      .from("compras_ventas_demanda_legacy")
      .select("sku_key,consumo_12_meses,promedio_mensual,import_id")
      .eq("import_id", data.import_id)
      .order("sku_key")
      .range(from, from + PAGE_SIZE - 1);

    if (demandaError) {
      throw new Error(
        `No se pudo leer la demanda de Ventas desde Supabase: ${demandaError.message}`,
      );
    }

    const rows = demanda ?? [];
    for (const row of rows) {
      const skuKey = normalizeVentasSku(row.sku_key);
      if (!skuKey) continue;
      demandaBySku.set(skuKey, {
        consumo12Meses: numberValue(row.consumo_12_meses),
        promedioMensual: numberValue(row.promedio_mensual),
      });
    }

    if (rows.length < PAGE_SIZE) break;
  }

  if (!demandaBySku.size) {
    throw new Error(
      "Supabase no contiene demanda de Ventas para la ventana legacy de agosto 2025 a julio 2026.",
    );
  }

  const { data: currentImport, error: currentImportError } = await supabase
    .from("compras_ventas_actual_import")
    .select("import_id")
    .limit(1)
    .maybeSingle();

  if (currentImportError) {
    throw new Error(
      `No se pudo confirmar el snapshot de Ventas en Supabase: ${currentImportError.message}`,
    );
  }
  if (Number(currentImport?.import_id) !== Number(data.import_id)) {
    throw new Error(
      "El snapshot de Ventas cambió durante la lectura. Reintentá la carga del Dashboard.",
    );
  }

  return {
    importId: Number(data.import_id),
    fechaImportacion: data.fecha_importacion ? String(data.fecha_importacion) : null,
    sourceMaxDate: data.source_max_date ? String(data.source_max_date) : null,
    demandaBySku,
  };
}

export function ventasFreshnessRows(fechaImportacion: string | null): SheetRows {
  return [
    ["FECHA_IMPORTACION"],
    [fechaImportacion ?? ""],
  ];
}
