import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type ComprasSyncStatus =
  | "PENDIENTE"
  | "PROCESANDO"
  | "COMPLETADO"
  | "ERROR";

export type ComprasSyncRequest = {
  id: number;
  syncType: "STOCK_WARNES";
  status: ComprasSyncStatus;
  requestedBy: string;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  githubRunId: number | null;
  importId: number | null;
  errorMessage: string | null;
};

function githubSettings() {
  const token = process.env.GITHUB_ACTIONS_TOKEN?.trim();
  const owner = process.env.GITHUB_ACTIONS_OWNER?.trim() || "ignacio844";
  const repo = process.env.GITHUB_ACTIONS_REPO?.trim() || "AfterMarket-Main";
  const ref = process.env.GITHUB_ACTIONS_REF?.trim() || "main";
  const workflow =
    process.env.GITHUB_ACTIONS_WARNES_WORKFLOW?.trim() ||
    "sync-warnes-stock.yml";

  if (!token) {
    throw new Error(
      "Falta configurar GITHUB_ACTIONS_TOKEN en el servidor del portal.",
    );
  }

  return { token, owner, repo, ref, workflow };
}

function mapRequest(row: Record<string, unknown>): ComprasSyncRequest {
  return {
    id: Number(row.id),
    syncType: "STOCK_WARNES",
    status: String(row.status) as ComprasSyncStatus,
    requestedBy: String(row.requested_by ?? ""),
    requestedAt: String(row.requested_at ?? ""),
    startedAt: row.started_at ? String(row.started_at) : null,
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    githubRunId:
      row.github_run_id === null || row.github_run_id === undefined
        ? null
        : Number(row.github_run_id),
    importId:
      row.import_id === null || row.import_id === undefined
        ? null
        : Number(row.import_id),
    errorMessage: row.error_message ? String(row.error_message) : null,
  };
}

export async function getActiveWarnesSyncRequest() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("compras_sync_requests")
    .select(
      "id,sync_type,status,requested_by,requested_at,started_at,finished_at,github_run_id,import_id,error_message",
    )
    .eq("sync_type", "STOCK_WARNES")
    .in("status", ["PENDIENTE", "PROCESANDO"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar el estado de sincronización WARNES: ${error.message}`,
    );
  }

  return data ? mapRequest(data) : null;
}

export async function createWarnesSyncRequest(requestedBy: string) {
  const email = requestedBy.trim().toLowerCase();
  if (!email) throw new Error("No se pudo identificar al usuario solicitante.");

  const active = await getActiveWarnesSyncRequest();
  if (active) return { request: active, created: false as const };

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("compras_sync_requests")
    .insert({
      sync_type: "STOCK_WARNES",
      status: "PENDIENTE",
      requested_by: email,
      metadata: {
        source: "portal",
      },
    })
    .select(
      "id,sync_type,status,requested_by,requested_at,started_at,finished_at,github_run_id,import_id,error_message",
    )
    .single();

  if (error || !data) {
    throw new Error(
      `No se pudo crear la solicitud de sincronización WARNES: ${
        error?.message || "respuesta vacía"
      }`,
    );
  }

  return { request: mapRequest(data), created: true as const };
}

export async function getWarnesSyncRequest(id: number) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("request_id inválido.");
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("compras_sync_requests")
    .select(
      "id,sync_type,status,requested_by,requested_at,started_at,finished_at,github_run_id,import_id,error_message",
    )
    .eq("id", id)
    .eq("sync_type", "STOCK_WARNES")
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar la solicitud de sincronización WARNES: ${error.message}`,
    );
  }

  return data ? mapRequest(data) : null;
}

export async function markWarnesSyncRequestError(
  id: number,
  message: string,
) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("compras_sync_requests")
    .update({
      status: "ERROR",
      finished_at: now,
      error_message: message.slice(0, 4000),
      updated_at: now,
    })
    .eq("id", id)
    .eq("sync_type", "STOCK_WARNES");

  if (error) {
    console.error(
      "No se pudo marcar la solicitud WARNES como ERROR:",
      error.message,
    );
  }
}

export async function dispatchWarnesSyncWorkflow(requestId: number) {
  const { token, owner, repo, ref, workflow } = githubSettings();

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo,
    )}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs: {
          request_id: String(requestId),
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    throw new Error(
      `GitHub Actions rechazó la sincronización (${response.status}): ${
        detail || response.statusText
      }`,
    );
  }
}
