import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isPortalUserAllowed } from "@/lib/portal-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorized() {
  const email = (await auth())?.user?.email?.trim().toLowerCase();
  return email && isPortalUserAllowed(email) ? email : null;
}

async function readRequest(id?: number) {
  let query = getSupabaseAdmin().from("compras_sync_requests")
    .select("id,status,error_message,ordenes_import_id")
    .eq("sync_type", "ORDENES");
  query = id ? query.eq("id", id) : query.in("status", ["PENDIENTE", "PROCESANDO"])
    .order("requested_at", { ascending: false }).limit(1);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`No se pudo consultar Órdenes: ${error.message}`);
  return data ? { id: Number(data.id), status: data.status, errorMessage: data.error_message, importId: data.ordenes_import_id } : null;
}

export async function GET(request: Request) {
  if (!await authorized()) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  try {
    const raw = new URL(request.url).searchParams.get("id");
    const id = raw ? Number(raw) : undefined;
    if (raw && (!Number.isInteger(id) || !id || id <= 0)) return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });
    return NextResponse.json({ ok: true, request: await readRequest(id) });
  } catch (cause) {
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : "Error al consultar Órdenes." }, { status: 500 });
  }
}

export async function POST() {
  const email = await authorized();
  if (!email) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  try {
    const active = await readRequest();
    if (active) return NextResponse.json({ ok: true, alreadyRunning: true, request: active });
    const { data, error } = await getSupabaseAdmin().from("compras_sync_requests")
      .insert({ sync_type: "ORDENES", status: "PENDIENTE", requested_by: email, metadata: { source: "portal" } })
      .select("id,status,error_message,ordenes_import_id").single();
    if (error?.code === "23505") return NextResponse.json({ ok: true, alreadyRunning: true, request: await readRequest() });
    if (error || !data) throw new Error(`No se pudo solicitar Órdenes: ${error?.message ?? "sin respuesta"}`);
    return NextResponse.json({ ok: true, request: { id: Number(data.id), status: data.status, errorMessage: data.error_message, importId: data.ordenes_import_id } }, { status: 202 });
  } catch (cause) {
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : "Error al solicitar Órdenes." }, { status: 500 });
  }
}
