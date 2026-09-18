import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { GestionDecision } from "@/lib/compras-gestion";

export type GestionChange = {
  sku: string;
  estadoGestion: string;
  cantidadDecidida: number;
  observacion: string;
  version: number;
};

export async function getGestionDecisions(): Promise<GestionDecision[]> {
  const db = getSupabaseAdmin();
  const rows: GestionDecision[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db.from("compras_gestion_decisiones")
      .select("sku,estado_gestion,cantidad_decidida,responsable,observacion,fecha_decision,requiere_revision,version")
      .order("sku").range(start, start + 999);
    if (error) throw new Error(`No se pudo leer las decisiones de Gestión: ${error.message}`);
    rows.push(...(data ?? []).map((row) => ({
      ...row,
      cantidad_decidida: Number(row.cantidad_decidida),
      version: Number(row.version),
    })));
    if ((data ?? []).length < 1000) break;
  }
  if (rows.length === 0) throw new Error("Las decisiones de Gestión aún no fueron importadas a Supabase.");
  return rows;
}

export async function saveGestionChanges(changes: GestionChange[], actor: string) {
  const { data, error } = await getSupabaseAdmin().rpc("compras_gestion_guardar", {
    p_cambios: changes,
    p_actor: actor,
  });
  if (error) throw new Error(error.message);
  return Number(data);
}
