import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isPortalEditor, isPortalUserAllowed } from "@/lib/portal-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ETIQUETAS_FOLDER_COLUMNS, toEtiquetaFolder } from "@/lib/etiquetas-data";
import { EtiquetaValidationError, validateEtiquetaDetails, validateEtiquetaId } from "@/lib/etiquetas-validation";

async function saveFolder(request: Request, editing: boolean) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });
  if (!isPortalUserAllowed(session.user.email) || !isPortalEditor(session.user.email)) {
    return NextResponse.json({ error: "Sólo los administradores pueden gestionar carpetas." }, { status: 403 });
  }
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 }); }
  try {
    if (!body || typeof body !== "object") throw new EtiquetaValidationError("La solicitud no es válida.");
    const details = validateEtiquetaDetails(body.name, body.description ?? "");
    const supabase = getSupabaseAdmin();
    const query = editing
      ? supabase.from("etiquetas_folders").update({ ...details, updated_at: new Date().toISOString() }).eq("id", validateEtiquetaId(body.id)).eq("is_active", true)
      : supabase.from("etiquetas_folders").insert({ id: randomUUID(), ...details, created_by: session.user.email.toLowerCase() });
    const { data, error } = await query.select(ETIQUETAS_FOLDER_COLUMNS).maybeSingle();
    if (error?.code === "23505") return NextResponse.json({ error: "Ya existe una carpeta con ese nombre." }, { status: 409 });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Carpeta no encontrada." }, { status: 404 });
    return NextResponse.json({ folder: toEtiquetaFolder(data) }, { status: editing ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof EtiquetaValidationError ? error.message : "No se pudo guardar la carpeta. Intentá nuevamente." }, { status: error instanceof EtiquetaValidationError ? 400 : 503 });
  }
}

export async function POST(request: Request) { return saveFolder(request, false); }
export async function PATCH(request: Request) { return saveFolder(request, true); }

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });
  if (!isPortalUserAllowed(session.user.email) || !isPortalEditor(session.user.email)) {
    return NextResponse.json({ error: "Sólo los administradores pueden eliminar carpetas." }, { status: 403 });
  }
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 }); }
  try {
    const id = validateEtiquetaId(body?.id);
    const { data, error } = await getSupabaseAdmin().rpc("etiquetas_archive_folder", { folder_id: id });
    if (error?.code === "P0001") return NextResponse.json({ error: "La carpeta contiene archivos. Movelos o eliminá sus accesos antes de eliminarla." }, { status: 409 });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Carpeta no encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof EtiquetaValidationError ? error.message : "No se pudo eliminar la carpeta." }, { status: error instanceof EtiquetaValidationError ? 400 : 503 });
  }
}
