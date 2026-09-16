import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SheetRows } from "@/lib/compras-dashboard";

export async function getOrdenesFreshnessRows(): Promise<SheetRows> {
  const { data, error } = await getSupabaseAdmin().from("compras_ordenes_actual_import")
    .select("fecha_importacion").limit(1).maybeSingle();
  if (error) throw new Error(`No se pudo leer la frescura de Órdenes: ${error.message}`);
  return [["FECHA", "USUARIO", "TIPO", "DETALLE", "ESTADO"], [data?.fecha_importacion ?? "", "", "ORDENES", "", "COMPLETADA"]];
}
