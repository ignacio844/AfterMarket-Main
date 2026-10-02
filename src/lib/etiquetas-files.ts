import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ETIQUETAS_BUCKET, ETIQUETAS_FILE_COLUMNS, toEtiquetaFile } from "@/lib/etiquetas-data";
import { ETIQUETAS_MAX_FILE_SIZE } from "@/lib/etiquetas-types";
import { EtiquetaValidationError, validateEtiquetaId, validateEtiquetaJson, validateEtiquetaMetadata } from "@/lib/etiquetas-validation";

export async function saveEtiquetaUpload(request: Request, email: string, existingId?: string) {
  if (Number(request.headers.get("content-length")) > ETIQUETAS_MAX_FILE_SIZE + 64 * 1024) {
    return NextResponse.json({ error: "El archivo supera el máximo de 4 MB." }, { status: 413 });
  }
  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "La carga de archivo no es válida." }, { status: 400 }); }
  try {
    const id = existingId ? validateEtiquetaId(existingId) : randomUUID();
    const { file, fileName, name, description, folderId } = validateEtiquetaMetadata(form);
    await validateEtiquetaJson(file, fileName);
    const supabase = getSupabaseAdmin();
    const bucket = await supabase.storage.getBucket(ETIQUETAS_BUCKET);
    if (bucket.error || bucket.data?.public !== false) {
      return NextResponse.json({ error: "La biblioteca de Etiquetas todavía no está disponible." }, { status: 503 });
    }
    if (existingId) {
      const current = await supabase.from("etiquetas_files").select("id").eq("id", id).eq("is_active", true).maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
    }
    if (folderId) {
      const folder = await supabase.from("etiquetas_folders").select("id").eq("id", folderId).eq("is_active", true).maybeSingle();
      if (folder.error) throw folder.error;
      if (!folder.data) throw new EtiquetaValidationError("La carpeta seleccionada ya no está disponible.");
    }
    const storagePath = `${id}/${randomUUID()}`;
    const { error: uploadError } = await supabase.storage.from(ETIQUETAS_BUCKET).upload(storagePath, await file.arrayBuffer(), {
      contentType: "application/octet-stream", upsert: false,
    });
    if (uploadError) throw uploadError;
    const values = { name, description, file_name: fileName, storage_path: storagePath, size_bytes: file.size, folder_id: folderId };
    const query = existingId
      ? supabase.from("etiquetas_files").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id).eq("is_active", true)
      : supabase.from("etiquetas_files").insert({ id, ...values, created_by: email.toLowerCase() });
    const { data, error } = await query.select(ETIQUETAS_FILE_COLUMNS).maybeSingle();
    if (error || !data) {
      // Se revierte sólo el objeto nuevo. El archivo anterior se conserva.
      await supabase.storage.from(ETIQUETAS_BUCKET).remove([storagePath]);
      if (!error) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
      throw error;
    }
    return NextResponse.json({ file: toEtiquetaFile(data) }, { status: existingId ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof EtiquetaValidationError ? error.message : "No se pudo publicar el archivo. Intentá nuevamente." }, { status: error instanceof EtiquetaValidationError ? 400 : 503 });
  }
}
