import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type ComprasVentasSyncStatus =
  | "PENDIENTE"
  | "PROCESANDO"
  | "COMPLETADO"
  | "ERROR";

export type ComprasVentasSyncRequest = {
  id: number;
  status: ComprasVentasSyncStatus;
  requestedBy: string;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  ventasImportId: number | null;
  errorMessage: string | null;
};

const SELECT_FIELDS =
  "id,status,requested_by,requested_at,started_at,finished_at,ventas_import_id,error_message";

function mapRequest(row: Record<string, unknown>): ComprasVentasSyncRequest {
  return {
    id: Number(row.id),
    status: String(row.status) as ComprasVentasSyncStatus,
    requestedBy: String(row.requested_by ?? ""),
    requestedAt: String(row.requested_at ?? ""),
    startedAt: row.started_at ? String(row.started_at) : null,
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    ventasImportId:
      row.ventas_import_id === null || row.ventas_import_id === undefined
        ? null
        : Number(row.ventas_import_id),
    errorMessage: row.error_message ? String(row.error_message) : null,
  };
}

export async function getActiveVentasSyncRequest() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("compras_sync_requests")
    .select(SELECT_FIELDS)
    .eq("sync_type", "VENTAS")
    .in("status", ["PENDIENTE", "PROCESANDO"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo consultar la sincronización de Ventas: ${error.message}`);
  }
  return data ? mapRequest(data) : null;
}

export async function createVentasSyncRequest(requestedBy: string) {
  const email = requestedBy.trim().toLowerCase();
  if (!email) throw new Error("No se pudo identificar al usuario solicitante.");

  const active = await getActiveVentasSyncRequest();
  if (active) return { request: active, created: false as const };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("compras_sync_requests")
    .insert({
      sync_type: "VENTAS",
      status: "PENDIENTE",
      requested_by: email,
      metadata: { source: "portal" },
    })
    .select(SELECT_FIELDS)
    .single();

  if (error || !data) {
    // El índice parcial resuelve también la carrera entre dos solicitudes.
    if (error?.code === "23505") {
      const concurrent = await getActiveVentasSyncRequest();
      if (concurrent) return { request: concurrent, created: false as const };
    }
    throw new Error(
      `No se pudo crear la solicitud de sincronización de Ventas: ${
        error?.message || "respuesta vacía"
      }`,
    );
  }

  return { request: mapRequest(data), created: true as const };
}

export async function getVentasSyncRequest(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error("request_id inválido.");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("compras_sync_requests")
    .select(SELECT_FIELDS)
    .eq("id", id)
    .eq("sync_type", "VENTAS")
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo consultar la solicitud de Ventas: ${error.message}`);
  }
  return data ? mapRequest(data) : null;
}
