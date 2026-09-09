"use client";

import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, LoaderCircle, Pencil, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  WMS_TRACKER_PROCESSES,
  WMS_TRACKER_RESPONSIBLES,
  WMS_TRACKER_STATUSES,
  WMS_TRACKER_TASK_TYPES,
  getWmsTrackerStatus,
  getWmsTrackerSummary,
  type WmsTrackerProcess,
  type WmsTrackerResponsible,
  type WmsTrackerStatus,
  type WmsTrackerTask,
  type WmsTrackerTaskType,
} from "@/lib/wms-tracker-types";

type TrackerResponse = { ok?: boolean; error?: string; tasks?: WmsTrackerTask[]; connected?: boolean };
type TrackerMutation = Record<string, unknown> & { action: string };
type Feedback = { kind: "success" | "error"; message: string };

const statusStyles: Record<WmsTrackerStatus, string> = {
  "No Realizado": "bg-[#ea9999] text-[#612626]",
  Realizando: "bg-[#fff2cc] text-[#6d5715]",
  Realizado: "bg-[#d9ead3] text-[#315c2b]",
  Hecho: "bg-[#efefef] text-[var(--navy)]",
  Verificado: "bg-[#38761d] text-white",
};

const statusDotStyles: Record<WmsTrackerStatus, string> = {
  "No Realizado": "bg-[#c96363]",
  Realizando: "bg-[#d5ad35]",
  Realizado: "bg-[#70a365]",
  Hecho: "bg-[#8b98a3]",
  Verificado: "bg-[#38761d]",
};

const typeLabels: Record<WmsTrackerTaskType, string> = {
  "Funcion SGL": "Función SGL",
  LayOut: "Layout",
  Herramientas: "Herramientas",
  Pruebas: "Pruebas",
  Entrenamiento: "Entrenamiento",
};

const responsibleLabels: Record<WmsTrackerResponsible, string> = {
  "Equipo SGL": "Equipo SGL",
  Logistica: "Logística",
};

function formatDate(value: string) {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}` : value;
}

function taskPayload(task: WmsTrackerTask) {
  return {
    process: task.process,
    taskDate: task.taskDate,
    title: task.title,
    taskType: task.taskType,
    description: task.description,
    priority: task.priority,
    responsible: task.responsible,
    isDoing: task.isDoing,
    isCompleted: task.isCompleted,
    isDone: task.isDone,
    isVerified: task.isVerified,
    responseDate: task.responseDate,
    response: task.response,
  };
}

function emptyTask(): WmsTrackerTask {
  return {
    id: "new",
    sourceKey: "new",
    process: "GENERALES",
    taskDate: new Date().toISOString().slice(0, 10),
    title: "",
    taskType: "Funcion SGL",
    description: "",
    priority: 2,
    responsible: "Logistica",
    status: "No Realizado",
    isDoing: false,
    isCompleted: false,
    isDone: false,
    isVerified: false,
    responseDate: "",
    response: "",
    position: 0,
  };
}

function ProgressCheckbox({ label, shortLabel, checked, disabled, compact = false, onChange }: { label: string; shortLabel?: string; checked: boolean; disabled?: boolean; compact?: boolean; onChange?: (checked: boolean) => void }) {
  return (
    <label className={`flex items-center justify-center gap-1.5 text-[10px] font-semibold text-[var(--muted)] ${compact ? "min-w-0" : "min-w-20"}`} title={label}>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="size-4 accent-[var(--blue)] disabled:opacity-80"
      />
      <span aria-hidden="true">{shortLabel ?? label}</span>
    </label>
  );
}

function TaskRow({ task, editing, onSave, onArchive }: { task: WmsTrackerTask; editing: boolean; onSave: (task: WmsTrackerTask) => Promise<boolean>; onArchive: (task: WmsTrackerTask) => Promise<boolean> }) {
  const [draft, setDraft] = useState(task);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  function patch(values: Partial<WmsTrackerTask>) {
    setDraft((current) => ({ ...current, ...values }));
  }

  async function save() {
    setBusy(true);
    const saved = await onSave({ ...draft, status: getWmsTrackerStatus(draft) });
    setBusy(false);
    if (saved) setExpanded(false);
  }

  async function archive() {
    if (!window.confirm(`¿Eliminar “${task.title}” del tracker?`)) return;
    setBusy(true);
    await onArchive(task);
    setBusy(false);
  }

  const displayed = editing ? draft : task;
  const status = getWmsTrackerStatus(displayed);
  const inputClass = "w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-2 text-xs text-[var(--ink)] outline-none focus:border-[var(--blue)]";

  return (
    <>
      <tr className="border-b border-[var(--line)] align-middle transition hover:bg-[#f8fafb]">
        <td className="px-2.5 py-2.5">
          {editing ? <input type="date" value={draft.taskDate} onChange={(event) => patch({ taskDate: event.target.value })} className={inputClass} /> : <span className="whitespace-nowrap text-[11px] font-semibold text-[var(--muted)]">{formatDate(task.taskDate)}</span>}
        </td>
        <td className="px-2.5 py-2.5">
          {editing ? <div className="space-y-1.5"><textarea rows={2} value={draft.title} onChange={(event) => patch({ title: event.target.value })} className={`${inputClass} resize-y font-semibold`} /><select value={draft.taskType} onChange={(event) => patch({ taskType: event.target.value as WmsTrackerTaskType })} className={inputClass}>{WMS_TRACKER_TASK_TYPES.map((value) => <option key={value} value={value}>{typeLabels[value]}</option>)}</select></div> : <div><p className="line-clamp-2 text-xs font-semibold leading-4 text-[var(--navy)]">{task.title}</p><p className="mt-1 text-[10px] font-semibold text-[var(--muted)]">{typeLabels[task.taskType]}</p></div>}
        </td>
        <td className="px-2 py-2.5 text-center">
          {editing ? <select aria-label={`Prioridad de ${task.title}`} value={draft.priority} onChange={(event) => patch({ priority: Number(event.target.value) as 1 | 2 | 3 | 4 })} className={inputClass}>{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{String(value).padStart(2, "0")}</option>)}</select> : <span className="inline-grid size-7 place-items-center rounded-md bg-[var(--soft)] text-[11px] font-bold text-[var(--navy)]">{String(task.priority).padStart(2, "0")}</span>}
        </td>
        <td className="px-2.5 py-2.5">
          {editing ? <select aria-label={`Responsable de ${task.title}`} value={draft.responsible} onChange={(event) => patch({ responsible: event.target.value as WmsTrackerResponsible })} className={inputClass}>{WMS_TRACKER_RESPONSIBLES.map((value) => <option key={value} value={value}>{responsibleLabels[value]}</option>)}</select> : <span className="text-[11px] font-semibold text-[var(--navy)]">{responsibleLabels[task.responsible]}</span>}
        </td>
        <td className="px-2.5 py-2.5"><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ${statusStyles[status]}`}>{status}</span></td>
        <td className="px-2 py-2.5">
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-[var(--soft)] px-2 py-2">
            <ProgressCheckbox compact shortLabel="EC" label={`Realizando: ${task.title}`} checked={displayed.isDoing} disabled={!editing} onChange={(checked) => patch({ isDoing: checked })} />
            <ProgressCheckbox compact shortLabel="R" label={`Realizado: ${task.title}`} checked={displayed.isCompleted} disabled={!editing} onChange={(checked) => patch({ isCompleted: checked })} />
            <ProgressCheckbox compact shortLabel="H" label={`Hecho: ${task.title}`} checked={displayed.isDone} disabled={!editing} onChange={(checked) => patch({ isDone: checked })} />
            <ProgressCheckbox compact shortLabel="V" label={`Verificado: ${task.title}`} checked={displayed.isVerified} disabled={!editing} onChange={(checked) => patch({ isVerified: checked })} />
          </div>
        </td>
        <td className="px-2.5 py-2.5">
          <button type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded} className={`flex w-full items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold transition ${editing ? "bg-[#edf5fb] text-[var(--blue)] hover:bg-[#e2f0fa]" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}>
            <span className="min-w-0"><span className="flex items-center gap-1 text-[9px] uppercase tracking-[0.08em]">{editing && <Pencil className="size-2.5" />}{editing ? "Editar textos" : "Respuesta"}</span><span className="block truncate text-[11px] text-[var(--navy)]">{editing ? "Descripción y respuesta" : formatDate(displayed.responseDate)}</span></span>
            {expanded ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
          </button>
        </td>
        {editing && (
          <td className="px-2 py-2.5">
            <div className="flex items-center justify-end gap-1">
              <button type="button" onClick={archive} disabled={busy} aria-label={`Eliminar ${task.title}`} className="grid size-8 place-items-center rounded-lg text-[#a74141] transition hover:bg-[#fff1f1] disabled:opacity-50"><Trash2 className="size-3.5" /></button>
              <button type="button" onClick={save} disabled={busy || !draft.title.trim()} aria-label={`Guardar ${task.title}`} className="grid size-8 place-items-center rounded-lg bg-[var(--navy)] text-white disabled:opacity-50">{busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}</button>
            </div>
          </td>
        )}
      </tr>
      {expanded && (
        <tr className="border-b border-[var(--line)] bg-[#f8fafb]">
          <td colSpan={editing ? 8 : 7} className="px-4 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div><p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Descripción</p>{editing ? <textarea aria-label={`Descripción de ${task.title}`} rows={4} value={draft.description} onChange={(event) => patch({ description: event.target.value })} className={`${inputClass} resize-y`} /> : <p className="text-xs leading-5 text-[var(--muted)]">{task.description || "—"}</p>}</div>
              <div><p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Respuesta</p>{editing ? <div className="space-y-2"><input aria-label={`Fecha de respuesta de ${task.title}`} type="date" value={draft.responseDate} onChange={(event) => patch({ responseDate: event.target.value })} className={inputClass} /><textarea aria-label={`Respuesta de ${task.title}`} rows={4} value={draft.response} onChange={(event) => patch({ response: event.target.value })} className={`${inputClass} resize-y`} /></div> : <p className="text-xs leading-5 text-[var(--muted)]">{task.response || "—"}</p>}</div>
            </div>
            {editing && <div className="mt-3 flex items-center justify-end gap-3 border-t border-[var(--line)] pt-3"><p className="mr-auto text-[10px] text-[var(--muted)]">También podés cambiar prioridad y responsable en la fila superior.</p><button type="button" onClick={save} disabled={busy || !draft.title.trim()} className="flex items-center gap-2 rounded-lg bg-[var(--navy)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}Guardar cambios</button></div>}
          </td>
        </tr>
      )}
    </>
  );
}

function NewTaskForm({ onCreate, onCancel }: { onCreate: (task: WmsTrackerTask) => Promise<boolean>; onCancel: () => void }) {
  const [task, setTask] = useState(emptyTask);
  const [busy, setBusy] = useState(false);
  const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--blue)]";
  const patch = (values: Partial<WmsTrackerTask>) => setTask((current) => ({ ...current, ...values }));

  async function create() {
    setBusy(true);
    const created = await onCreate(task);
    setBusy(false);
    if (created) onCancel();
  }

  return (
    <div className="mb-5 rounded-[22px] border border-[var(--blue)]/25 bg-[#f5f9fc] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Nueva tarea</p><h3 className="mt-1 text-xl font-semibold text-[var(--navy)]">Agregar al Tracker WMS</h3></div><button type="button" onClick={onCancel} className="grid size-9 place-items-center rounded-full bg-white text-[var(--muted)] ring-1 ring-[var(--line)]"><X className="size-4" /></button></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-semibold text-[var(--muted)]">Proceso<select value={task.process} onChange={(event) => patch({ process: event.target.value as WmsTrackerProcess })} className={inputClass}>{WMS_TRACKER_PROCESSES.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs font-semibold text-[var(--muted)]">Fecha<input type="date" value={task.taskDate} onChange={(event) => patch({ taskDate: event.target.value })} className={inputClass} /></label>
        <label className="text-xs font-semibold text-[var(--muted)] md:col-span-2">Título<input autoFocus value={task.title} onChange={(event) => patch({ title: event.target.value })} className={inputClass} /></label>
        <label className="text-xs font-semibold text-[var(--muted)]">Tipo<select value={task.taskType} onChange={(event) => patch({ taskType: event.target.value as WmsTrackerTaskType })} className={inputClass}>{WMS_TRACKER_TASK_TYPES.map((value) => <option key={value} value={value}>{typeLabels[value]}</option>)}</select></label>
        <label className="text-xs font-semibold text-[var(--muted)]">Prioridad<select value={task.priority} onChange={(event) => patch({ priority: Number(event.target.value) as 1 | 2 | 3 | 4 })} className={inputClass}>{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{String(value).padStart(2, "0")}</option>)}</select></label>
        <label className="text-xs font-semibold text-[var(--muted)]">Responsable<select value={task.responsible} onChange={(event) => patch({ responsible: event.target.value as WmsTrackerResponsible })} className={inputClass}>{WMS_TRACKER_RESPONSIBLES.map((value) => <option key={value} value={value}>{responsibleLabels[value]}</option>)}</select></label>
        <label className="text-xs font-semibold text-[var(--muted)]">Fecha de respuesta<input type="date" value={task.responseDate} onChange={(event) => patch({ responseDate: event.target.value })} className={inputClass} /></label>
        <label className="text-xs font-semibold text-[var(--muted)] md:col-span-2">Descripción<textarea rows={3} value={task.description} onChange={(event) => patch({ description: event.target.value })} className={`${inputClass} resize-y`} /></label>
        <label className="text-xs font-semibold text-[var(--muted)] md:col-span-2">Respuesta<textarea rows={3} value={task.response} onChange={(event) => patch({ response: event.target.value })} className={`${inputClass} resize-y`} /></label>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-[var(--line)]">
          <ProgressCheckbox label="Realizando" checked={task.isDoing} onChange={(checked) => patch({ isDoing: checked })} />
          <ProgressCheckbox label="Realizado" checked={task.isCompleted} onChange={(checked) => patch({ isCompleted: checked })} />
          <ProgressCheckbox label="Hecho" checked={task.isDone} onChange={(checked) => patch({ isDone: checked })} />
          <ProgressCheckbox label="Verificado" checked={task.isVerified} onChange={(checked) => patch({ isVerified: checked })} />
        </div>
        <button type="button" onClick={create} disabled={busy || !task.title.trim()} className="flex items-center gap-2 rounded-xl bg-[var(--blue)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}Publicar tarea</button>
      </div>
    </div>
  );
}

export function WmsTracker({ initialTasks, initialConnected, canManage, editorEmail }: { initialTasks: WmsTrackerTask[]; initialConnected: boolean; canManage: boolean; editorEmail?: string }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [connected, setConnected] = useState(initialConnected);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [query, setQuery] = useState("");
  const [processFilter, setProcessFilter] = useState<WmsTrackerProcess | "">("");
  const [statusFilter, setStatusFilter] = useState<WmsTrackerStatus | "">("");
  const [responsibleFilter, setResponsibleFilter] = useState<WmsTrackerResponsible | "">("");
  const [priorityFilter, setPriorityFilter] = useState<"" | "1" | "2" | "3" | "4">("");

  const refreshTasks = useCallback(async (visible = false) => {
    if (visible) setRefreshing(true);
    try {
      const response = await fetch("/api/wms/tracker", { cache: "no-store" });
      const result = (await response.json()) as TrackerResponse;
      if (!response.ok) throw new Error(result.error || "No se pudo actualizar el tracker.");
      if (result.tasks) setTasks(result.tasks);
      setConnected(Boolean(result.connected));
    } catch (error) {
      if (visible) setFeedback({ kind: "error", message: error instanceof Error ? error.message : "No se pudo actualizar el tracker." });
    } finally {
      if (visible) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshTasks(false);
    }, 20_000);
    const onFocus = () => void refreshTasks(false);
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [refreshTasks]);

  async function mutate(body: TrackerMutation) {
    setFeedback(null);
    try {
      const response = await fetch("/api/wms/tracker", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = (await response.json()) as TrackerResponse;
      if (!response.ok) throw new Error(result.error || "No se pudo publicar el cambio.");
      await refreshTasks(false);
      setFeedback({ kind: "success", message: "Cambio publicado y compartido correctamente." });
      return true;
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "No se pudo publicar el cambio." });
      return false;
    }
  }

  const summary = useMemo(() => getWmsTrackerSummary(tasks), [tasks]);
  const completed = summary.byStatus.Realizado + summary.byStatus.Hecho + summary.byStatus.Verificado;
  const completion = summary.total ? Math.round((completed / summary.total) * 100) : 0;

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return tasks.filter((task) => {
      if (processFilter && task.process !== processFilter) return false;
      if (statusFilter && task.status !== statusFilter) return false;
      if (responsibleFilter && task.responsible !== responsibleFilter) return false;
      if (priorityFilter && task.priority !== Number(priorityFilter)) return false;
      if (!normalizedQuery) return true;
      return [task.title, task.description, task.response, task.process].join(" ").toLocaleLowerCase("es").includes(normalizedQuery);
    });
  }, [priorityFilter, processFilter, query, responsibleFilter, statusFilter, tasks]);

  const groupedTasks = useMemo(() => WMS_TRACKER_PROCESSES.map((process) => ({ process, tasks: filteredTasks.filter((task) => task.process === process) })).filter((group) => group.tasks.length > 0), [filteredTasks]);

  return (
    <section className="mt-8" aria-labelledby="wms-tracker-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--blue)]">Seguimiento compartido</p><h2 id="wms-tracker-title" className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Tracker WMS</h2></div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => refreshTasks(true)} disabled={refreshing} className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-[var(--navy)] ring-1 ring-[var(--line)] disabled:opacity-50"><RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />Actualizar</button>
          {canManage && <button type="button" onClick={() => { setEditing((current) => !current); setCreating(false); setFeedback(null); }} disabled={!connected} title={!connected ? "Aplicá la migración de Supabase para habilitar la edición" : undefined} className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${editing ? "bg-[var(--blue)] text-white" : "bg-white text-[var(--navy)] ring-1 ring-[var(--line)]"}`}>{editing ? <X className="size-4" /> : <Pencil className="size-4" />}{editing ? "Finalizar edición" : "Editar tracker"}</button>}
          {canManage && editing && <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-3 text-xs font-semibold text-white"><Plus className="size-4" />Nueva tarea</button>}
        </div>
      </div>

      {feedback && <div className={`mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${feedback.kind === "success" ? "bg-[#edf9f2] text-[#20734a]" : "bg-[#fff1f1] text-[#9c3737]"}`}>{feedback.kind === "success" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}{feedback.message}</div>}
      {creating && <NewTaskForm onCancel={() => setCreating(false)} onCreate={(task) => mutate({ action: "task.create", ...taskPayload(task) })} />}

      <div className="grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-2 sm:grid-cols-2 xl:grid-cols-[1.15fr_repeat(5,minmax(0,.7fr))]">
        <div className="rounded-xl bg-[var(--navy)] px-3 py-2.5 text-white sm:col-span-2 xl:col-span-1"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/55">Avance general</p><div className="mt-1 flex items-baseline gap-2"><p className="text-2xl font-semibold leading-none">{completion}%</p><p className="text-[10px] font-semibold text-white/60">{completed} de {summary.total}</p></div></div><div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#2f9df4] transition-[width]" style={{ width: `${completion}%` }} /></div></div></div>
        {WMS_TRACKER_STATUSES.map((status) => <div key={status} className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-[var(--soft)] px-3 py-2"><div className="flex min-w-0 items-center gap-2"><span className={`size-2.5 shrink-0 rounded-full ${statusDotStyles[status]}`} /><p className="truncate text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{status}</p></div><p className="text-xl font-semibold leading-none text-[var(--navy)]">{summary.byStatus[status]}</p></div>)}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] bg-white p-2.5">
        <label className="relative min-w-60 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tarea, descripción o respuesta" className="w-full rounded-xl border border-[var(--line)] py-2 pl-10 pr-3 text-sm outline-none focus:border-[var(--blue)]" /></label>
        <select aria-label="Filtrar por proceso" value={processFilter} onChange={(event) => setProcessFilter(event.target.value as WmsTrackerProcess | "")} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)] outline-none"><option value="">Todos los procesos</option>{WMS_TRACKER_PROCESSES.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as WmsTrackerStatus | "")} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)] outline-none"><option value="">Todos los estados</option>{WMS_TRACKER_STATUSES.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filtrar por responsable" value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value as WmsTrackerResponsible | "")} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)] outline-none"><option value="">Todos los responsables</option>{WMS_TRACKER_RESPONSIBLES.map((value) => <option key={value} value={value}>{responsibleLabels[value]}</option>)}</select>
        <select aria-label="Filtrar por prioridad" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as "" | "1" | "2" | "3" | "4")} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)] outline-none"><option value="">Todas las prioridades</option>{[1, 2, 3, 4].map((value) => <option key={value} value={value}>Prioridad {String(value).padStart(2, "0")}</option>)}</select>
        <span className="px-2 text-xs font-semibold text-[var(--muted)]">{filteredTasks.length} tareas</span>
      </div>

      <div className="mt-3 overflow-hidden rounded-[24px] border border-[var(--line)] bg-white shadow-[0_24px_60px_-45px_rgba(14,40,65,0.45)]">
        <div className="max-h-[720px] overflow-y-auto overflow-x-hidden">
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup><col className="w-[8%]" /><col className="w-[28%]" /><col className="w-[7%]" /><col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[19%]" /><col className="w-[14%]" />{editing && <col className="w-[7%]" />}</colgroup>
            <thead className="sticky top-0 z-30 bg-[#efefef] text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--navy)] shadow-[0_1px_0_var(--line)]">
              <tr><th className="px-2.5 py-3">Fecha</th><th className="px-2.5 py-3">Tarea</th><th className="px-2 py-3 text-center">Prior.</th><th className="px-2.5 py-3">Responsable</th><th className="px-2.5 py-3">Estado</th><th className="px-2 py-3 text-center">Avance <span className="ml-1 normal-case tracking-normal text-[9px] text-[var(--muted)]">EC · R · H · V</span></th><th className="px-2.5 py-3">Detalle</th>{editing && <th className="px-2 py-3 text-right">Acciones</th>}</tr>
            </thead>
            <tbody>
              {groupedTasks.map((group) => <FragmentGroup key={group.process} process={group.process} colSpan={editing ? 8 : 7}>{group.tasks.map((task) => <TaskRow key={`${task.id}-${task.updatedAt ?? task.status}`} task={task} editing={editing} onSave={(updated) => mutate({ action: "task.update", id: updated.id, ...taskPayload(updated) })} onArchive={(archived) => mutate({ action: "task.archive", id: archived.id })} />)}</FragmentGroup>)}
            </tbody>
          </table>
          {filteredTasks.length === 0 && <p className="px-6 py-12 text-center text-sm text-[var(--muted)]">No hay tareas que coincidan con los filtros.</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-[var(--muted)]"><p>El progreso se actualiza automáticamente cada 20 segundos.</p>{editorEmail && canManage && <p>Editor: {editorEmail}</p>}</div>
    </section>
  );
}

function FragmentGroup({ process, colSpan, children }: { process: WmsTrackerProcess; colSpan: number; children: React.ReactNode }) {
  return <><tr><th colSpan={colSpan} className="bg-[#e7eef4] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--navy)]">{process}</th></tr>{children}</>;
}
