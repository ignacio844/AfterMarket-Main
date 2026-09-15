import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SheetRows } from "@/lib/compras-dashboard";

export type ComprasVentasActual = {
  importId: number | null;
  fechaImportacion: string | null;
  sourceMaxDate: string | null;
};

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
    return { importId: null, fechaImportacion: null, sourceMaxDate: null };
  }

  return {
    importId: Number(data.import_id),
    fechaImportacion: data.fecha_importacion ? String(data.fecha_importacion) : null,
    sourceMaxDate: data.source_max_date ? String(data.source_max_date) : null,
  };
}

export function ventasFreshnessRows(fechaImportacion: string | null): SheetRows {
  return [
    ["FECHA_IMPORTACION"],
    [fechaImportacion ?? ""],
  ];
}
