"use client";

import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import {
  AlertCircle, BookOpen, Boxes, CheckCircle2, ExternalLink, FileText, Files, Folder,
  FolderKanban, FolderOpen, GraduationCap, LoaderCircle, Plus, Presentation, Rocket,
  Save, Settings2, Sheet, Trash2, Warehouse, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WMS_RESOURCE_TYPES, type WmsModule, type WmsResource, type WmsResourceType } from "@/lib/wms-types";

const iconMap: Record<string, LucideIcon> = {
  "graduation-cap": GraduationCap, boxes: Boxes, rocket: Rocket, warehouse: Warehouse,
  "folder-kanban": FolderKanban, "book-open": BookOpen, files: Files, folder: Folder,
};

const iconOptions = [
  ["graduation-cap", "Capacitación"], ["boxes", "Módulos"], ["rocket", "Lanzamiento"],
  ["warehouse", "Depósito"], ["folder-kanban", "Proyecto"], ["book-open", "Manual"],
  ["files", "Documentos"], ["folder", "Carpeta"],
] as const;

const typeIcons: Record<WmsResourceType, LucideIcon> = {
  Carpeta: FolderOpen, Documento: FileText, Presentación: Presentation, Planilla: Sheet,
};

type Ripple = { id: number; size: number; x: number; y: number };
type RippleButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

function RippleButton({ children, onClick, className = "", ...props }: RippleButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  function addRipple(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const id = Date.now() + Math.random();
    setRipples((current) => [...current, { id, size, x: event.clientX - rect.left - size / 2, y: event.clientY - rect.top - size / 2 }]);
    window.setTimeout(() => setRipples((current) => current.filter((item) => item.id !== id)), 650);
    onClick?.(event);
  }

  return (
    <button {...props} onClick={addRipple} className={`relative overflow-hidden ${className}`}>
      <span className="relative z-10 flex w-full items-center gap-3">{children}</span>
      {ripples.map((ripple) => <span key={ripple.id} aria-hidden="true" className="ripple" style={{ width: ripple.size, height: ripple.size, left: ripple.x, top: ripple.y }} />)}
    </button>
  );
}

function ResourceRow({ resource, primary = false }: { resource: WmsResource; primary?: boolean }) {
  const TypeIcon = typeIcons[resource.type];
  return (
    <a href={resource.href} target="_blank" rel="noopener noreferrer" className={`group flex items-center gap-4 px-4 py-4 transition hover:bg-[var(--soft)] sm:px-5 ${primary ? "rounded-2xl bg-[var(--navy-soft)]" : "border-b border-[var(--line)] last:border-b-0"}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--blue)] ring-1 ring-[var(--line)]"><TypeIcon aria-hidden="true" className="size-5" strokeWidth={1.8} /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[var(--navy)]">{resource.name}</span><span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{resource.type}</span></span>
      <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-[var(--muted)] transition group-hover:text-[var(--navy)]" strokeWidth={1.8} />
    </a>
  );
}

type Mutation = Record<string, unknown> & { action: string };
type MutationResult = { ok?: boolean; error?: string; module?: { id: string } };

function ResourceEditor({ resource, moduleId, mutate }: { resource: WmsResource; moduleId: string; mutate: (body: Mutation) => Promise<MutationResult> }) {
  const [name, setName] = useState(resource.name);
  const [href, setHref] = useState(resource.href);
  const [type, setType] = useState<WmsResourceType>(resource.type);
  const [isPrimary, setIsPrimary] = useState(resource.isPrimary);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setName(resource.name); setHref(resource.href); setType(resource.type); setIsPrimary(resource.isPrimary); }, [resource]);

  async function save() {
    setBusy(true);
    await mutate({ action: "resource.update", id: resource.id, moduleId, name, href, type, isPrimary });
    setBusy(false);
  }

  async function archive() {
    if (!window.confirm(`¿Quitar “${resource.name}” de los accesos publicados?`)) return;
    setBusy(true); await mutate({ action: "resource.archive", id: resource.id }); setBusy(false);
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(150px,.8fr)_minmax(260px,1.4fr)_150px]">
        <label className="text-xs font-semibold text-[var(--muted)]">Nombre<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--blue)]" /></label>
        <label className="text-xs font-semibold text-[var(--muted)]">Enlace<input type="url" value={href} onChange={(event) => setHref(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--blue)]" /></label>
        <label className="text-xs font-semibold text-[var(--muted)]">Tipo<select value={type} onChange={(event) => setType(event.target.value as WmsResourceType)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--blue)]">{WMS_RESOURCE_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]"><input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} className="size-4 accent-[var(--blue)]" />Mostrar como acceso principal</label>
        <div className="flex gap-2">
          <button type="button" onClick={archive} disabled={busy} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#a74141] transition hover:bg-[#fff1f1] disabled:opacity-50"><Trash2 className="size-3.5" />Quitar</button>
          <button type="button" onClick={save} disabled={busy} className="flex items-center gap-2 rounded-xl bg-[var(--navy)] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#173d60] disabled:opacity-50">{busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}Guardar acceso</button>
        </div>
      </div>
    </div>
  );
}

function NewResourceForm({ moduleId, firstResource, mutate }: { moduleId: string; firstResource: boolean; mutate: (body: Mutation) => Promise<MutationResult> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [href, setHref] = useState("");
  const [type, setType] = useState<WmsResourceType>("Carpeta");
  const [isPrimary, setIsPrimary] = useState(firstResource);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const result = await mutate({ action: "resource.create", moduleId, name, href, type, isPrimary });
    setBusy(false);
    if (result.ok) { setName(""); setHref(""); setType("Carpeta"); setIsPrimary(false); setOpen(false); }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--blue)]/35 bg-[#f7fbff] px-4 py-4 text-sm font-semibold text-[var(--blue)] transition hover:border-[var(--blue)] hover:bg-[#eef7ff]"><Plus className="size-4" />Agregar acceso</button>;

  return (
    <div className="mt-4 rounded-2xl border border-[var(--blue)]/30 bg-[#f7fbff] p-4">
      <div className="mb-4 flex items-center justify-between"><p className="text-sm font-semibold text-[var(--navy)]">Nuevo acceso</p><button type="button" onClick={() => setOpen(false)} className="text-[var(--muted)]"><X className="size-4" /></button></div>
      <div className="grid gap-3 lg:grid-cols-2">
        <input aria-label="Nombre del nuevo acceso" placeholder="Nombre del acceso" value={name} onChange={(event) => setName(event.target.value)} className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--blue)]" />
        <input aria-label="URL del nuevo acceso" type="url" placeholder="https://..." value={href} onChange={(event) => setHref(event.target.value)} className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--blue)]" />
        <select aria-label="Tipo del nuevo acceso" value={type} onChange={(event) => setType(event.target.value as WmsResourceType)} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--blue)]">{WMS_RESOURCE_TYPES.map((item) => <option key={item}>{item}</option>)}</select>
        <label className="flex items-center gap-2 px-1 text-xs font-semibold text-[var(--muted)]"><input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} className="size-4 accent-[var(--blue)]" />Mostrar como acceso principal</label>
      </div>
      <div className="mt-4 flex justify-end"><button type="button" onClick={create} disabled={busy || !name.trim() || !href.trim()} className="flex items-center gap-2 rounded-xl bg-[var(--blue)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-45">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}Publicar acceso</button></div>
    </div>
  );
}

type ExplorerProps = { initialModules: WmsModule[]; canManage?: boolean; editorEmail?: string };

export function WmsResourceExplorer({ initialModules, canManage = false, editorEmail }: ExplorerProps) {
  const router = useRouter();
  const [modules, setModules] = useState(initialModules);
  const [selectedId, setSelectedId] = useState(initialModules[0]?.id ?? "");
  const [editing, setEditing] = useState(false);
  const [creatingModule, setCreatingModule] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const selectedModule = modules.find((module) => module.id === selectedId) ?? modules[0];

  useEffect(() => {
    setModules(initialModules);
    if (!initialModules.some((module) => module.id === selectedId)) setSelectedId(initialModules[0]?.id ?? "");
  }, [initialModules, selectedId]);

  async function mutate(body: Mutation): Promise<MutationResult> {
    setFeedback(null);
    try {
      const response = await fetch("/api/wms/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = (await response.json()) as MutationResult;
      if (!response.ok) throw new Error(result.error || "No se pudo publicar el cambio.");
      setFeedback({ kind: "success", message: "Cambio publicado correctamente." });
      router.refresh();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo publicar el cambio.";
      setFeedback({ kind: "error", message });
      return { error: message };
    }
  }

  if (!selectedModule) return null;
  const SelectedIcon = iconMap[selectedModule.iconKey] ?? Folder;
  const primary = selectedModule.resources.find((resource) => resource.isPrimary);
  const secondary = selectedModule.resources.filter((resource) => !resource.isPrimary);

  return (
    <section className="mt-8" aria-labelledby="wms-resources-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--blue)]">Documentación del proyecto</p><h2 id="wms-resources-title" className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Recursos WMS</h2></div>
        {canManage && <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          {editing && <p className="rounded-full bg-[#e8f4ff] px-3 py-1.5 text-xs font-semibold text-[var(--blue)]">Publicación inmediata al guardar</p>}
          <button type="button" onClick={() => { setEditing((current) => !current); setCreatingModule(false); setFeedback(null); }} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold transition ${editing ? "bg-[var(--blue)] text-white" : "bg-white text-[var(--navy)] ring-1 ring-[var(--line)] hover:ring-[var(--blue)]/40"}`}>{editing ? <X className="size-4" /> : <Settings2 className="size-4" />}{editing ? "Finalizar edición" : "Administrar recursos"}</button>
        </div>}
      </div>

      <div className="grid overflow-hidden rounded-[28px] border border-[var(--line)] bg-white shadow-[0_24px_60px_-45px_rgba(14,40,65,0.45)] lg:grid-cols-[270px_minmax(0,1fr)]">
        <nav className="flex flex-col border-b border-[var(--line)] bg-[var(--soft)] p-3 lg:min-h-[560px] lg:border-b-0 lg:border-r" aria-label="Categorías de recursos WMS">
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {modules.map((module) => {
              const Icon = iconMap[module.iconKey] ?? Folder;
              const isSelected = module.id === selectedModule.id;
              return <RippleButton key={module.id} type="button" onClick={() => { setSelectedId(module.id); setCreatingModule(false); }} aria-pressed={isSelected} className={`flex min-w-56 items-center gap-3 rounded-2xl px-4 py-3 text-left transition lg:min-w-0 ${isSelected ? "bg-[var(--navy)] text-white shadow-sm" : "text-[var(--muted)] hover:bg-white hover:text-[var(--navy)]"}`}><Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.8} /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{module.name}</span><span className={`text-xs font-bold ${isSelected ? "text-white/55" : "text-[var(--muted)]"}`}>{module.resources.length}</span></RippleButton>;
            })}
          </div>

          {canManage && editing && <div className="mt-3 border-t border-[var(--line)] pt-3 lg:mt-auto">
            <button type="button" onClick={() => setCreatingModule(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-xs font-semibold text-[var(--navy)] transition hover:border-[var(--blue)]"><Plus className="size-4" />Nuevo módulo</button>
            {editorEmail && <p className="mt-2 truncate px-2 text-center text-[10px] text-[var(--muted)]">{editorEmail}</p>}
          </div>}
        </nav>

        <div className="min-h-[470px] p-5 sm:p-7">
          {feedback && <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${feedback.kind === "success" ? "bg-[#edf9f2] text-[#20734a]" : "bg-[#fff1f1] text-[#9c3737]"}`}>{feedback.kind === "success" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}{feedback.message}</div>}

          {editing ? (
            creatingModule ? <NewModuleEditor mutate={mutate} onCreated={(id) => { setSelectedId(id); setCreatingModule(false); }} onCancel={() => setCreatingModule(false)} /> : <ModuleEditor module={selectedModule} mutate={mutate} onArchived={() => setSelectedId(modules.find((item) => item.id !== selectedModule.id)?.id ?? "")} />
          ) : <>
            <div key={selectedModule.id} className="module-header-enter relative min-h-40 overflow-hidden rounded-[22px] border border-[#cddce9] bg-gradient-to-br from-[#deebf5] via-[#eaf2f8] to-[#f7fafc] p-6 sm:p-7">
              <span className="absolute -right-8 -top-20 size-52 rounded-full border border-[var(--blue)]/10" /><span className="absolute right-20 -bottom-24 size-44 rounded-full border border-[var(--blue)]/10" /><SelectedIcon aria-hidden="true" className="absolute -bottom-9 -right-5 size-44 text-[var(--blue)] opacity-[0.09]" strokeWidth={1.15} />
              <div className="relative flex max-w-3xl items-start gap-4 pr-12 sm:pr-28"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/75 text-[var(--blue)] shadow-sm ring-1 ring-white"><SelectedIcon aria-hidden="true" className="size-6" strokeWidth={1.8} /></span><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Categoría seleccionada</p><h3 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[var(--navy)]">{selectedModule.name}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{selectedModule.description}</p></div></div>
            </div>
            {primary && <div className="mt-5"><ResourceRow resource={primary} primary /></div>}
            {secondary.length > 0 ? <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)]">{secondary.map((resource) => <ResourceRow key={resource.id} resource={resource} />)}</div> : !primary && <p className="mt-6 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--canvas)] px-5 py-8 text-center text-sm text-[var(--muted)]">Todavía no hay accesos publicados en este módulo.</p>}
          </>}
        </div>
      </div>
    </section>
  );
}

function ModuleEditor({ module, mutate, onArchived }: { module: WmsModule; mutate: (body: Mutation) => Promise<MutationResult>; onArchived: () => void }) {
  const [name, setName] = useState(module.name);
  const [description, setDescription] = useState(module.description);
  const [iconKey, setIconKey] = useState(module.iconKey);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(module.name); setDescription(module.description); setIconKey(module.iconKey); }, [module]);

  async function save() { setBusy(true); await mutate({ action: "module.update", id: module.id, name, description, iconKey }); setBusy(false); }
  async function archive() { if (!window.confirm(`¿Ocultar el módulo “${module.name}” y sus accesos de la navegación?`)) return; setBusy(true); const result = await mutate({ action: "module.archive", id: module.id }); setBusy(false); if (result.ok) onArchived(); }

  return <div>
    <div className="rounded-[22px] border border-[#cddce9] bg-[#f5f9fc] p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Editar módulo</p><h3 className="mt-1 text-xl font-semibold text-[var(--navy)]">Información general</h3></div><button type="button" onClick={archive} disabled={busy} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#a74141] hover:bg-[#fff1f1]"><Trash2 className="size-4" />Ocultar módulo</button></div>
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <label className="text-xs font-semibold text-[var(--muted)]">Nombre<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--blue)]" /></label>
        <label className="text-xs font-semibold text-[var(--muted)]">Ícono<select value={iconKey} onChange={(event) => setIconKey(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--blue)]">{iconOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-xs font-semibold text-[var(--muted)] sm:col-span-2">Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1.5 w-full resize-none rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm leading-6 text-[var(--ink)] outline-none focus:border-[var(--blue)]" /></label>
      </div>
      <div className="mt-4 flex justify-end"><button type="button" onClick={save} disabled={busy || !name.trim()} className="flex items-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Guardar módulo</button></div>
    </div>
    <div className="mt-6"><div className="mb-3"><p className="text-sm font-semibold text-[var(--navy)]">Accesos del módulo</p><p className="mt-1 text-xs text-[var(--muted)]">Cada acceso se publica en el momento de guardarlo.</p></div><div className="space-y-3">{module.resources.map((resource) => <ResourceEditor key={resource.id} resource={resource} moduleId={module.id} mutate={mutate} />)}</div><NewResourceForm moduleId={module.id} firstResource={module.resources.length === 0} mutate={mutate} /></div>
  </div>;
}

function NewModuleEditor({ mutate, onCreated, onCancel }: { mutate: (body: Mutation) => Promise<MutationResult>; onCreated: (id: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [iconKey, setIconKey] = useState("folder"); const [busy, setBusy] = useState(false);
  async function create() { setBusy(true); const result = await mutate({ action: "module.create", name, description, iconKey }); setBusy(false); if (result.ok && result.module) onCreated(result.module.id); }
  return <div className="rounded-[22px] border border-[var(--blue)]/25 bg-[#f5f9fc] p-5 sm:p-7">
    <div className="flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Nuevo módulo</p><h3 className="mt-2 text-2xl font-semibold text-[var(--navy)]">Crear categoría de recursos</h3></div><button type="button" onClick={onCancel} className="grid size-9 place-items-center rounded-full bg-white text-[var(--muted)] ring-1 ring-[var(--line)]"><X className="size-4" /></button></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_180px]"><label className="text-xs font-semibold text-[var(--muted)]">Nombre<input autoFocus value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--blue)]" /></label><label className="text-xs font-semibold text-[var(--muted)]">Ícono<select value={iconKey} onChange={(event) => setIconKey(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--blue)]">{iconOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-semibold text-[var(--muted)] sm:col-span-2">Descripción<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 w-full resize-none rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-[var(--blue)]" /></label></div>
    <div className="mt-5 flex justify-end"><button type="button" onClick={create} disabled={busy || !name.trim()} className="flex items-center gap-2 rounded-xl bg-[var(--blue)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}Crear módulo</button></div>
  </div>;
}
