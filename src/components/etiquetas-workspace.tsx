"use client";

import { Download, FileCode2, FileText, Folder, FolderPlus, LoaderCircle, Pencil, Plus, Search, Tags, Upload, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ETIQUETAS_MAX_FILE_SIZE, formatEtiquetaSize, getEtiquetaPreviewType, type EtiquetaFile, type EtiquetaFolder } from "@/lib/etiquetas-types";
import { EtiquetasEditor, type EtiquetasEditTarget } from "@/components/etiquetas-editor";

type Props = { initialFiles: EtiquetaFile[]; initialFolders: EtiquetaFolder[]; initialConnected: boolean; canUpload: boolean };
type Preview = { id: string; version?: string; text: string; error?: string };
const fieldClass = "w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/10 disabled:opacity-60";
const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });

export function EtiquetasWorkspace({ initialFiles, initialFolders, initialConnected, canUpload }: Props) {
  const [files, setFiles] = useState(initialFiles);
  const [folders, setFolders] = useState(initialFolders);
  const [activeFolder, setActiveFolder] = useState("all");
  const [uploadFolder, setUploadFolder] = useState("");
  const [editTarget, setEditTarget] = useState<EtiquetasEditTarget | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [connected, setConnected] = useState(initialConnected);
  const [selectedId, setSelectedId] = useState<string | null>(initialFiles[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderFiles = files.filter((item) => activeFolder === "all" || (activeFolder === "none" ? !item.folderId : item.folderId === activeFolder));
  const visibleFiles = folderFiles.filter((item) => `${item.name} ${item.description} ${item.fileName}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
  const selected = visibleFiles.find((item) => item.id === selectedId) ?? visibleFiles[0];
  const selectedFileId = selected?.id;
  const selectedVersion = selected?.updatedAt ?? selected?.createdAt;
  const previewType = selected ? getEtiquetaPreviewType(selected.fileName) : "download";
  const currentFolder = folders.find((folder) => folder.id === activeFolder);

  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;
    async function refresh() {
      if (refreshing || document.visibilityState === "hidden") return;
      refreshing = true;
      try {
        const response = await fetch("/api/etiquetas", { cache: "no-store", signal: controller.signal });
        if (!response.ok) { if (!controller.signal.aborted) setConnected(false); return; }
        const data = await response.json() as { files: EtiquetaFile[]; folders: EtiquetaFolder[]; connected: boolean };
        if (!controller.signal.aborted) { setFiles(data.files); setFolders(data.folders); setConnected(data.connected); setActiveFolder((current) => current === "all" || current === "none" || data.folders.some((folder) => folder.id === current) ? current : "all"); }
      } catch {
        if (!controller.signal.aborted) setConnected(false);
      } finally { refreshing = false; }
    }
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);

  useEffect(() => {
    if (!selectedFileId || (previewType !== "json" && previewType !== "text")) return;
    const controller = new AbortController();
    async function loadPreview() {
      try {
        const response = await fetch(`/api/etiquetas/${selectedFileId}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("No se pudo cargar la vista previa.");
        const raw = await response.text();
        const text = previewType === "json" ? JSON.stringify(JSON.parse(raw.replace(/^\uFEFF/, "")), null, 2) : raw;
        if (!controller.signal.aborted) setPreview({ id: selectedFileId!, version: selectedVersion, text });
      } catch {
        if (!controller.signal.aborted) setPreview({ id: selectedFileId!, version: selectedVersion, text: "", error: "No se pudo cargar la vista previa. Podés intentar descargar el archivo." });
      }
    }
    void loadPreview();
    return () => controller.abort();
  }, [selectedFileId, selectedVersion, previewType, previewRevision]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || uploading || !connected) return;
    setUploadError("");
    setNotice("");
    if (file.size === 0 || file.size > ETIQUETAS_MAX_FILE_SIZE) {
      setUploadError(file.size === 0 ? "El archivo está vacío." : "El archivo supera el máximo de 4 MB.");
      return;
    }
    setUploading(true);
    try {
      if (file.name.toLowerCase().endsWith(".json")) {
        try { JSON.parse((await file.text()).replace(/^\uFEFF/, "")); }
        catch { throw new Error("El archivo JSON no es válido. Revisá su contenido antes de publicarlo."); }
      }
      const body = new FormData();
      body.set("file", file);
      body.set("name", name.trim());
      body.set("description", description.trim());
      body.set("folderId", uploadFolder);
      const response = await fetch("/api/etiquetas", { method: "POST", body });
      const data = await response.json() as { file?: EtiquetaFile; error?: string };
      if (!response.ok || !data.file) throw new Error(data.error ?? "No se pudo publicar el archivo.");
      const published = data.file;
      setFiles((current) => [published, ...current.filter((item) => item.id !== published.id)]);
      setSelectedId(published.id);
      setActiveFolder(published.folderId ?? "none");
      setQuery("");
      setShowUpload(false);
      setFile(null);
      setName("");
      setDescription("");
      if (fileInput.current) fileInput.current.value = "";
      setNotice("Archivo publicado. Ya está disponible para todos los usuarios del portal.");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "No se pudo publicar el archivo. Intentá nuevamente.");
    } finally { setUploading(false); }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--blue)]">Biblioteca de estándares</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--navy)] sm:text-4xl">Etiquetas</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Plantillas base y archivos de referencia, disponibles para todo el equipo.</p>
        </div>
        {canUpload && <div className="flex flex-wrap gap-2"><button type="button" disabled={uploading || !!editTarget} onClick={() => { setShowUpload(false); setEditTarget({ kind: "folder" }); setNotice(""); }} className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] disabled:opacity-50"><FolderPlus className="size-4" aria-hidden="true" />Nueva carpeta</button><button type="button" onClick={() => { setShowUpload((value) => !value); setEditTarget(null); setUploadFolder(currentFolder?.id ?? ""); setNotice(""); }} disabled={uploading || !!editTarget} aria-expanded={showUpload} aria-controls="etiquetas-upload" className="flex items-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173d60] disabled:opacity-50">
          {showUpload ? <X className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}{showUpload ? "Cerrar carga" : "Cargar archivo"}
        </button></div>}
      </div>

      {!connected && <p role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">La biblioteca no está disponible en este momento. La carga se habilitará cuando se restablezca la conexión.</p>}
      {notice && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      {canUpload && showUpload && <form id="etiquetas-upload" onSubmit={publish} className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3"><Upload className="size-5 text-[var(--blue)]" aria-hidden="true" /><div><h2 className="font-semibold text-[var(--navy)]">Publicar un archivo</h2><p className="mt-1 text-xs text-[var(--muted)]">JSON o cualquier otro formato · Máximo 4 MB por archivo.</p></div></div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <label htmlFor="etiquetas-file" className="mb-2 block text-sm font-medium">Archivo</label>
            <input ref={fileInput} id="etiquetas-file" type="file" required disabled={uploading} onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              setFile(next); setUploadError("");
              if (next) setName(next.name.replace(/\.[^.]+$/, "").slice(0, 180));
            }} className={`${fieldClass} file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--soft)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[var(--navy)]`} />
            {file && <p className="mt-2 break-all text-xs text-[var(--muted)]">{file.name} · {formatEtiquetaSize(file.size)}</p>}
            <p className="mt-4 text-xs leading-5 text-[var(--muted)]">El archivo se conserva en su formato original. Al publicarlo, todos los usuarios podrán consultarlo y descargarlo.</p>
            <label htmlFor="etiquetas-upload-folder" className="mb-2 mt-4 block text-sm font-medium">Carpeta</label><select id="etiquetas-upload-folder" value={uploadFolder} onChange={(event) => setUploadFolder(event.target.value)} disabled={uploading} className={fieldClass}><option value="">Sin carpeta</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
          </div>
          <div className="space-y-4">
            <div><label htmlFor="etiquetas-name" className="mb-2 block text-sm font-medium">Nombre</label><input id="etiquetas-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={180} disabled={uploading} placeholder="Ej. Etiqueta de producto" className={fieldClass} /></div>
            <div><label htmlFor="etiquetas-description" className="mb-2 block text-sm font-medium">Descripción <span className="font-normal text-[var(--muted)]">(opcional)</span></label><textarea id="etiquetas-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} disabled={uploading} placeholder="Indicá para qué se utiliza esta plantilla." className={`${fieldClass} resize-y`} /></div>
          </div>
        </div>
        {uploadError && <p role="alert" className="mt-4 text-sm text-red-700">{uploadError}</p>}
        <div className="mt-5 flex justify-end"><button type="submit" disabled={uploading || !connected || !file || !name.trim()} className="flex items-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{uploading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}{uploading ? "Publicando…" : "Publicar archivo"}</button></div>
      </form>}

      {canUpload && editTarget && <EtiquetasEditor key={`${editTarget.kind}-${editTarget.kind === "file" ? editTarget.file.id : editTarget.folder?.id ?? "new"}`} target={editTarget} folders={folders} connected={connected} folderFileCount={files.filter((file) => editTarget.kind === "folder" && file.folderId === editTarget.folder?.id).length} onClose={() => setEditTarget(null)} onFileSaved={(saved) => {
        setFiles((current) => current.map((file) => file.id === saved.id ? saved : file)); setSelectedId(saved.id); setActiveFolder(saved.folderId ?? "none"); setQuery(""); setPreview(null); setPreviewRevision((value) => value + 1); setEditTarget(null); setNotice("Acceso actualizado para todos los usuarios del portal.");
      }} onFolderSaved={(saved) => {
        setFolders((current) => [...current.filter((folder) => folder.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, "es"))); setActiveFolder(saved.id); setQuery(""); setEditTarget(null); setNotice("Carpeta guardada para todos los usuarios del portal.");
      }} onDeleted={(kind, id) => {
        if (kind === "file") { setFiles((current) => current.filter((file) => file.id !== id)); setSelectedId(null); }
        else { setFolders((current) => current.filter((folder) => folder.id !== id)); setActiveFolder("all"); }
        setEditTarget(null); setNotice(kind === "file" ? "Acceso eliminado de la biblioteca." : "Carpeta eliminada de la biblioteca.");
      }} />}

      <section className="mt-7 overflow-hidden rounded-2xl border border-[var(--line)] bg-white" aria-label="Archivos de etiquetas">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3"><Tags className="size-5 text-[var(--blue)]" aria-hidden="true" /><h2 className="text-sm font-semibold text-[var(--navy)]">Archivos compartidos</h2><span className="rounded-full bg-[var(--soft)] px-2.5 py-1 text-xs text-[var(--muted)]">{files.length}</span></div>
          <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 size-4 text-[var(--muted)]" aria-hidden="true" /><input type="search" aria-label="Buscar archivos" placeholder="Buscar por nombre o formato" value={query} onChange={(event) => setQuery(event.target.value)} className={`${fieldClass} pl-9`} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-5 py-3 sm:px-6" aria-label="Carpetas">
          {[{ id: "all", name: "Todos los archivos" }, { id: "none", name: "Sin carpeta" }, ...folders].map((folder) => <button key={folder.id} type="button" onClick={() => { setActiveFolder(folder.id); setSelectedId(null); setQuery(""); }} aria-pressed={activeFolder === folder.id} className={`flex max-w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${activeFolder === folder.id ? "bg-[var(--navy-soft)] text-[var(--navy)]" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}><Folder className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{folder.name}</span><span className="text-[10px] opacity-70">{files.filter((file) => folder.id === "all" || (folder.id === "none" ? !file.folderId : file.folderId === folder.id)).length}</span></button>)}
        </div>
        {currentFolder && <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-3 sm:px-6"><div><h3 className="text-sm font-semibold text-[var(--navy)]">{currentFolder.name}</h3>{currentFolder.description && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[var(--muted)]">{currentFolder.description}</p>}</div>{canUpload && <button type="button" disabled={uploading || !!editTarget} onClick={() => { setShowUpload(false); setEditTarget({ kind: "folder", folder: currentFolder }); setNotice(""); }} className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--navy)] disabled:opacity-40"><Pencil className="size-3.5" aria-hidden="true" />Modificar carpeta</button>}</div>}
        {visibleFiles.length === 0 ? <div className="flex min-h-80 flex-col items-center justify-center px-6 py-14 text-center"><div className="grid size-14 place-items-center rounded-2xl bg-[var(--soft)]"><Tags className="size-6 text-[var(--blue)]" aria-hidden="true" /></div><h3 className="mt-5 text-lg font-semibold text-[var(--navy)]">{!connected ? "Biblioteca pendiente de conexión" : query ? "No hay coincidencias" : activeFolder !== "all" ? "Esta carpeta todavía no tiene archivos" : "Todavía no hay archivos publicados"}</h3><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{connected ? "Las plantillas y archivos que publiquen los administradores aparecerán acá para todo el equipo." : "Los archivos compartidos aparecerán acá cuando la biblioteca esté disponible."}</p></div> : <div className="grid lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="max-h-[680px] overflow-y-auto border-b border-[var(--line)] p-3 lg:border-b-0 lg:border-r">
            {visibleFiles.length === 0 ? <p className="px-3 py-8 text-sm text-[var(--muted)]">No hay archivos que coincidan con tu búsqueda.</p> : visibleFiles.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} aria-pressed={selected?.id === item.id} className={`mb-1 flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${selected?.id === item.id ? "bg-[var(--navy-soft)]" : "hover:bg-[var(--soft)]"}`}>
              <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[var(--blue)]">{getEtiquetaPreviewType(item.fileName) === "json" ? <FileCode2 className="size-5" aria-hidden="true" /> : <FileText className="size-5" aria-hidden="true" />}</div>
              <div className="min-w-0"><p className="break-words text-sm font-semibold text-[var(--navy)]">{item.name}</p><p className="mt-1 truncate text-xs text-[var(--muted)]">{item.fileName}</p><p className="mt-2 text-[11px] text-[var(--muted)]">{formatEtiquetaSize(item.size)} · {dateFormatter.format(new Date(item.createdAt))}</p></div>
            </button>)}
          </div>
          {selected && <div className="min-w-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h3 className="break-words text-xl font-semibold tracking-[-0.02em] text-[var(--navy)]">{selected.name}</h3><p className="mt-1 break-all text-xs text-[var(--muted)]">{selected.fileName} · {formatEtiquetaSize(selected.size)}</p></div><div className="flex gap-2">{canUpload && <button type="button" disabled={uploading || !!editTarget} onClick={() => { setShowUpload(false); setEditTarget({ kind: "file", file: selected }); setNotice(""); }} className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--navy)] hover:bg-[var(--soft)] disabled:opacity-40"><Pencil className="size-4" aria-hidden="true" />Modificar</button>}<a href={`/api/etiquetas/${selected.id}?download=1`} className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--navy)] transition hover:bg-[var(--soft)]"><Download className="size-4" aria-hidden="true" />Descargar</a></div></div>
            {selected.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{selected.description}</p>}
            <div className="mt-5 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--soft)]">
              <div className="border-b border-[var(--line)] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Vista previa{previewType === "json" ? " · JSON" : ""}</div>
              {(previewType === "json" || previewType === "text") && (preview?.id !== selected.id || preview.version !== selectedVersion ? <p role="status" className="p-6 text-sm text-[var(--muted)]">Cargando vista previa…</p> : preview.error ? <p role="alert" className="p-6 text-sm text-red-700">{preview.error}</p> : <pre className="max-h-[500px] overflow-auto p-4 text-xs leading-6 text-[var(--navy)]"><code>{preview.text}</code></pre>)}
              {previewType === "image" && <div className="grid min-h-64 place-items-center p-5">
                {/* Se usa el archivo autenticado directamente, sin un servicio de optimización público. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img key={`${selected.id}-${selectedVersion}-${previewRevision}`} src={`/api/etiquetas/${selected.id}?v=${encodeURIComponent(selectedVersion ?? "")}`} alt={selected.name} className="max-h-[500px] max-w-full object-contain" />
              </div>}
              {previewType === "download" && <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center"><FileText className="size-8 text-[var(--blue)]" aria-hidden="true" /><p className="text-sm font-medium text-[var(--navy)]">Archivo disponible para descargar</p><p className="max-w-sm text-xs leading-5 text-[var(--muted)]">Este formato se consulta en su aplicación correspondiente. Descargalo para abrirlo.</p></div>}
            </div>
          </div>}
        </div>}
      </section>
    </>
  );
}
