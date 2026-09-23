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

export type GestionStoredEvent = {
  tipo: "MIGRACION" | "DECISION";
  estado_gestion: string | null;
  cantidad_decidida: number;
  observacion: string;
  actor: string;
  fecha_evento: string;
  version: number;
};

export async function getGestionDecision(sku: string): Promise<GestionDecision | null> {
  const { data, error } = await getSupabaseAdmin().from("compras_gestion_decisiones")
    .select("sku,estado_gestion,cantidad_decidida,responsable,observacion,fecha_decision,requiere_revision,version")
    .eq("sku", sku.trim().toUpperCase()).maybeSingle();
  if (error) throw new Error(`No se pudo leer la decisión de Gestión: ${error.message}`);
  return data ? { ...data, cantidad_decidida: Number(data.cantidad_decidida), version: Number(data.version) } : null;
}

export async function getGestionEvents(sku: string): Promise<GestionStoredEvent[]> {
  const db = getSupabaseAdmin();
  const events: GestionStoredEvent[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db.from("compras_gestion_eventos")
      .select("tipo,estado_gestion,cantidad_decidida,observacion,actor,fecha_evento,version")
      .eq("sku", sku.trim().toUpperCase()).order("version").range(start, start + 999);
    if (error) throw new Error(`No se pudo leer el historial de Gestión: ${error.message}`);
    events.push(...(data ?? []).map((row) => ({
      ...row, cantidad_decidida: Number(row.cantidad_decidida), version: Number(row.version),
    })));
    if ((data ?? []).length < 1000) break;
  }
  return events;
}

export async function getGestionDecisions(): Promise<GestionDecision[]> {
  const db = getSupabaseAdmin();
  const { count, error: countError } = await db.from("compras_gestion_decisiones")
    .select("sku", { count: "exact", head: true });
  if (countError) throw new Error(`No se pudo contar las decisiones de Gestión: ${countError.message}`);
  if (!count) throw new Error("Las decisiones de Gestión aún no fueron importadas a Supabase.");
  const rows: GestionDecision[] = [];
  const starts = Array.from({ length: Math.ceil(count / 1000) }, (_, index) => index * 1000);
  for (let first = 0; first < starts.length; first += 4) {
    const pages = await Promise.all(starts.slice(first, first + 4).map(async (start) => {
      const { data, error } = await db.from("compras_gestion_decisiones")
        .select("sku,estado_gestion,cantidad_decidida,responsable,observacion,fecha_decision,requiere_revision,version")
        .order("sku").range(start, start + 999);
      if (error) throw new Error(`No se pudo leer las decisiones de Gestión: ${error.message}`);
      return data ?? [];
    }));
    for (const page of pages) rows.push(...page.map((row) => ({
      ...row, cantidad_decidida: Number(row.cantidad_decidida), version: Number(row.version),
    })));
  }
  if (rows.length !== count) throw new Error("Las decisiones de Gestión cambiaron durante la lectura. Reintentá.");
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
