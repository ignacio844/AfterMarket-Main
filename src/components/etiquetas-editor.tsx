"use client";

import { LoaderCircle, Save, Trash2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ETIQUETAS_MAX_FILE_SIZE, type EtiquetaFile, type EtiquetaFolder } from "@/lib/etiquetas-types";

export type EtiquetasEditTarget = { kind: "file"; file: EtiquetaFile } | { kind: "folder"; folder?: EtiquetaFolder };
type Props = {
  target: EtiquetasEditTarget;
  folders: EtiquetaFolder[];
  folderFileCount: number;
  connected: boolean;
  onClose: () => void;
  onFileSaved: (file: EtiquetaFile) => void;
  onFolderSaved: (folder: EtiquetaFolder) => void;
  onDeleted: (kind: "file" | "folder", id: string) => void;
};
const fieldClass = "w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/10 disabled:opacity-60";

export function EtiquetasEditor({ target, folders, folderFileCount, connected, onClose, onFileSaved, onFolderSaved, onDeleted }: Props) {
  const current = target.kind === "file" ? target.file : target.folder;
  const [name, setName] = useState(current?.name ?? "");
  const [description, setDescription] = useState(current?.description ?? "");
  const [folderId, setFolderId] = useState(target.kind === "file" ? target.file.folderId ?? "" : "");
  const [replacement, setReplacement] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const title = target.kind === "file" ? "Modificar acceso" : current ? "Modificar carpeta" : "Nueva carpeta";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !connected) return;
    setError(""); setSaving(true);
    try {
      let url: string;
      let options: RequestInit;
      if (target.kind === "file" && replacement) {
        if (!replacement.size || replacement.size > ETIQUETAS_MAX_FILE_SIZE) throw new Error("El archivo debe tener contenido y no superar los 4 MB.");
        if (replacement.name.toLowerCase().endsWith(".json")) {
          try { JSON.parse((await replacement.text()).replace(/^\uFEFF/, "")); }
          catch { throw new Error("El archivo JSON no es válido. Revisá su contenido antes de guardarlo."); }
        }
        const body = new FormData();
        body.set("name", name.trim()); body.set("description", description.trim()); body.set("folderId", folderId); body.set("file", replacement);
        url = `/api/etiquetas/${target.file.id}`;
        options = { method: "PUT", body };
      } else {
        url = target.kind === "file" ? `/api/etiquetas/${target.file.id}` : "/api/etiquetas/carpetas";
        options = { method: current ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: current?.id, name: name.trim(), description: description.trim(), folderId: folderId || null }) };
      }
      const response = await fetch(url, options);
      const data = await response.json() as { file?: EtiquetaFile; folder?: EtiquetaFolder; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudieron guardar los cambios.");
      if (target.kind === "file" && data.file) onFileSaved(data.file);
      else if (target.kind === "folder" && data.folder) onFolderSaved(data.folder);
      else throw new Error("No se pudo confirmar el guardado. Intentá nuevamente.");
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudieron guardar los cambios."); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!current || saving || !connected) return;
    setError(""); setSaving(true);
    try {
      const response = await fetch(target.kind === "file" ? `/api/etiquetas/${current.id}` : "/api/etiquetas/carpetas", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: current.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo eliminar el acceso.");
      onDeleted(target.kind, current.id);
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo eliminar el acceso."); }
    finally { setSaving(false); }
  }

  return <form onSubmit={save} className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6" aria-label={title}>
    <div className="mb-5 flex items-center justify-between gap-4"><h2 className="font-semibold text-[var(--navy)]">{title}</h2><button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar edición" className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--soft)]"><X className="size-4" aria-hidden="true" /></button></div>
    <fieldset disabled={saving} className="grid gap-4 lg:grid-cols-2">
      <div><label htmlFor="etiquetas-edit-name" className="mb-2 block text-sm font-medium">Nombre</label><input id="etiquetas-edit-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={180} className={fieldClass} /></div>
      <div><label htmlFor="etiquetas-edit-description" className="mb-2 block text-sm font-medium">Descripción <span className="font-normal text-[var(--muted)]">(opcional)</span></label><textarea id="etiquetas-edit-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} className={`${fieldClass} resize-y`} /></div>
      {target.kind === "file" && <>
        <div><label htmlFor="etiquetas-edit-folder" className="mb-2 block text-sm font-medium">Carpeta</label><select id="etiquetas-edit-folder" value={folderId} onChange={(event) => setFolderId(event.target.value)} className={fieldClass}><option value="">Sin carpeta</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></div>
        <div><label htmlFor="etiquetas-replacement" className="mb-2 block text-sm font-medium">Reemplazar archivo <span className="font-normal text-[var(--muted)]">(opcional)</span></label><input id="etiquetas-replacement" type="file" onChange={(event) => setReplacement(event.target.files?.[0] ?? null)} className={`${fieldClass} file:mr-3 file:border-0 file:bg-[var(--soft)] file:px-2 file:py-1 file:text-[var(--navy)]`} /><p className="mt-2 break-all text-xs text-[var(--muted)]">Actual: {target.file.fileName} · Máximo 4 MB.</p></div>
      </>}
    </fieldset>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {confirmDelete && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-sm text-red-900">¿Eliminar {target.kind === "file" ? "este acceso" : "esta carpeta"} de la biblioteca? Dejará de estar disponible para los usuarios. Los archivos almacenados se conservan.</p><div className="mt-3 flex gap-3"><button type="button" disabled={saving || !connected} onClick={remove} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Confirmar eliminación</button><button type="button" disabled={saving} onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-2 text-xs font-semibold text-red-900">Cancelar</button></div></div>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
      <div>{current && <button type="button" onClick={() => setConfirmDelete(true)} disabled={saving || !connected || (target.kind === "folder" && folderFileCount > 0)} className="flex items-center gap-2 text-sm font-medium text-red-700 disabled:opacity-40"><Trash2 className="size-4" aria-hidden="true" />{target.kind === "file" ? "Eliminar acceso" : "Eliminar carpeta"}</button>}{target.kind === "folder" && folderFileCount > 0 && <p className="mt-2 text-xs text-[var(--muted)]">Mové o eliminá los {folderFileCount} accesos de esta carpeta antes de retirarla.</p>}</div>
      <button type="submit" disabled={saving || !connected || !name.trim() || confirmDelete} className="flex items-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}{saving ? "Guardando…" : "Guardar cambios"}</button>
    </div>
  </form>;
}
