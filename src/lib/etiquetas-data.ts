import "server-only";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/lib/supabase-admin";
import type { EtiquetaFile, EtiquetaFolder } from "@/lib/etiquetas-types";

export const ETIQUETAS_BUCKET = "portal-etiquetas";
const FILE_COLUMNS = "id, name, description, file_name, size_bytes, created_at, updated_at, folder_id";
export const ETIQUETAS_FOLDER_COLUMNS = "id, name, description, created_at";

type FileRow = {
  id: string;
  name: string;
  description: string;
  file_name: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  folder_id: string | null;
};

export function toEtiquetaFile(row: FileRow): EtiquetaFile {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fileName: row.file_name,
    size: row.size_bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    folderId: row.folder_id ?? null,
  };
}

export function toEtiquetaFolder(row: { id: string; name: string; description: string; created_at: string }): EtiquetaFolder {
  return { id: row.id, name: row.name, description: row.description, createdAt: row.created_at };
}

export async function getEtiquetasData(): Promise<{ files: EtiquetaFile[]; folders: EtiquetaFolder[]; connected: boolean }> {
  if (!hasSupabaseAdminConfig()) return { files: [], folders: [], connected: false };
  try {
    const supabase = getSupabaseAdmin();
    const [rows, folders, bucket] = await Promise.all([
      supabase.from("etiquetas_files").select(FILE_COLUMNS).eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("etiquetas_folders").select(ETIQUETAS_FOLDER_COLUMNS).eq("is_active", true).order("name"),
      supabase.storage.getBucket(ETIQUETAS_BUCKET),
    ]);
    if (rows.error || folders.error || bucket.error || bucket.data?.public !== false) return { files: [], folders: [], connected: false };
    return { files: (rows.data ?? []).map(toEtiquetaFile), folders: (folders.data ?? []).map(toEtiquetaFolder), connected: true };
  } catch {
    return { files: [], folders: [], connected: false };
  }
}

export { FILE_COLUMNS as ETIQUETAS_FILE_COLUMNS };
