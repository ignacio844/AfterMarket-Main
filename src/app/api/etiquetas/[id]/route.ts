import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isPortalEditor, isPortalUserAllowed } from "@/lib/portal-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ETIQUETAS_BUCKET, ETIQUETAS_FILE_COLUMNS, toEtiquetaFile } from "@/lib/etiquetas-data";
import { getEtiquetaPreviewType } from "@/lib/etiquetas-types";
import { saveEtiquetaUpload } from "@/lib/etiquetas-files";
import { EtiquetaValidationError, etiquetaContentDisposition, etiquetaContentType, validateEtiquetaDetails, validateEtiquetaFolderId, validateEtiquetaId } from "@/lib/etiquetas-validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });
  if (!isPortalUserAllowed(session.user.email) || !isPortalEditor(session.user.email)) {
    return NextResponse.json({ error: "Sólo los administradores pueden modificar archivos." }, { status: 403 });
  }
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 }); }
  try {
    const id = validateEtiquetaId((await params).id);
    if (!body || typeof body !== "object") throw new EtiquetaValidationError("La solicitud no es válida.");
    const details = validateEtiquetaDetails(body.name, body.description ?? "");
    const folderId = validateEtiquetaFolderId(body.folderId);
    const supabase = getSupabaseAdmin();
    if (folderId) {
      const folder = await supabase.from("etiquetas_folders").select("id").eq("id", folderId).eq("is_active", true).maybeSingle();
      if (folder.error) throw folder.error;
      if (!folder.data) throw new EtiquetaValidationError("La carpeta seleccionada ya no está disponible.");
    }
    const { data, error } = await supabase.from("etiquetas_files")
      .update({ ...details, folder_id: folderId, updated_at: new Date().toISOString() })
      .eq("id", id).eq("is_active", true).select(ETIQUETAS_FILE_COLUMNS).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
    return NextResponse.json({ file: toEtiquetaFile(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof EtiquetaValidationError ? error.message : "No se pudo modificar el archivo. Intentá nuevamente." }, { status: error instanceof EtiquetaValidationError ? 400 : 503 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });
  if (!isPortalUserAllowed(session.user.email) || !isPortalEditor(session.user.email)) {
    return NextResponse.json({ error: "Sólo los administradores pueden reemplazar archivos." }, { status: 403 });
  }
  return saveEtiquetaUpload(request, session.user.email, (await params).id);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });
  if (!isPortalUserAllowed(session.user.email) || !isPortalEditor(session.user.email)) {
    return NextResponse.json({ error: "Sólo los administradores pueden eliminar accesos." }, { status: 403 });
  }
  try {
    const id = validateEtiquetaId((await params).id);
    const { data, error } = await getSupabaseAdmin().from("etiquetas_files").update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id).eq("is_active", true).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof EtiquetaValidationError ? error.message : "No se pudo eliminar el acceso." }, { status: error instanceof EtiquetaValidationError ? 400 : 503 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });
  if (!isPortalUserAllowed(session.user.email)) return NextResponse.json({ error: "No tenés acceso al portal." }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data: file, error } = await supabase.from("etiquetas_files").select("file_name, storage_path").eq("id", id).eq("is_active", true).maybeSingle();
    if (error) throw error;
    if (!file) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
    const { data, error: downloadError } = await supabase.storage.from(ETIQUETAS_BUCKET).download(file.storage_path);
    if (downloadError || !data) throw downloadError;
    const download = new URL(request.url).searchParams.get("download") === "1" || getEtiquetaPreviewType(file.file_name) === "download";
    return new Response(await data.arrayBuffer(), {
      headers: {
        "Content-Type": etiquetaContentType(file.file_name),
        "Content-Disposition": etiquetaContentDisposition(file.file_name, download),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox allow-same-origin; default-src 'none'",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo abrir el archivo. Intentá nuevamente." }, { status: 503 });
  }
}
