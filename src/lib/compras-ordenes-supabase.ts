import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SheetRows } from "@/lib/compras-dashboard";
import type { ComprasOrdenesPendienteItem } from "@/lib/compras-dashboard-model";

export async function getComprasOrdenesActual(): Promise<{
  importId: number;
  fechaImportacion: string;
  items: ComprasOrdenesPendienteItem[];
}> {
  const supabase = getSupabaseAdmin();
  const { data: current, error } = await supabase.from("compras_ordenes_actual_import")
    .select("id,fecha_importacion,filas_validas").limit(1).maybeSingle();
  if (error) throw new Error(`No se pudo leer el snapshot de Órdenes: ${error.message}`);
  if (!current) throw new Error("Supabase no contiene un snapshot de Órdenes validado.");
  if (!Number.isSafeInteger(current.filas_validas) || current.filas_validas <= 0) {
    throw new Error("El snapshot de Órdenes no contiene líneas validadas.");
  }

  const items: ComprasOrdenesPendienteItem[] = [];
  const pageSize = 1000;
  for (let from = 0; from < current.filas_validas; from += pageSize) {
    const { data, error: itemsError } = await supabase.from("compras_ordenes_import_items")
      .select("item,cantidad,status")
      .eq("import_id", current.id)
      .order("fila_origen")
      .range(from, from + pageSize - 1);
    if (itemsError) throw new Error(`No se pudieron leer los ítems de Órdenes: ${itemsError.message}`);
    items.push(...(data ?? []));
  }
  if (items.length !== Number(current.filas_validas)) {
    throw new Error("El snapshot de Órdenes está incompleto. Reintentá la carga del Dashboard.");
  }
  const { data: check, error: checkError } = await supabase.from("compras_ordenes_actual_import")
    .select("id").limit(1).maybeSingle();
  if (checkError) throw new Error(`No se pudo confirmar el snapshot de Órdenes: ${checkError.message}`);
  if (Number(check?.id) !== Number(current.id)) {
    throw new Error("El snapshot de Órdenes cambió durante la lectura. Reintentá la carga del Dashboard.");
  }
  return { importId: Number(current.id), fechaImportacion: String(current.fecha_importacion), items };
}

export function ordenesFreshnessRows(fechaImportacion: string): SheetRows {
  return [["FECHA", "USUARIO", "TIPO", "DETALLE", "ESTADO"], [fechaImportacion, "", "ORDENES", "", "COMPLETADA"]];
}
