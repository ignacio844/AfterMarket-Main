"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  GESTION_ESTADOS,
  filterGestion,
  summarizeGestion,
  type ComprasGestion,
  type GestionFilters,
  type GestionRegistro,
} from "@/lib/compras-gestion";

const PAGE_SIZE = 50;
const blankFilters: GestionFilters = { texto: "", riesgo: "", estado: "", marca: "", politica: "" };
type GestionDraft = { estadoGestion: string; cantidadDecidida: string; observacion: string };
const blankDraft: GestionDraft = { estadoGestion: "PENDIENTE", cantidadDecidida: "", observacion: "" };
const whole = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const subscribeActionHost = () => () => {};
const getActionHost = () => document.getElementById("compras-gestion-actions");
const getServerActionHost = () => null;

function number(value: number) {
  return whole.format(Math.round(value || 0));
}

function registroUnavailable(registro: GestionRegistro) {
  return registro.version < 1;
}

function csvCell(value: string | number | boolean) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadGestionCsv(registros: GestionRegistro[]) {
  const headers = [
    "SKU",
    "DESCRIPCION",
    "MARCA",
    "ORIGEN",
    "OBJETIVO",
    "COBERTURA_ACTUAL",
    "RIESGO",
    "POLITICA",
    "COMPRA_SUGERIDA",
    "ESTADO_GESTION",
    "CANTIDAD_DECIDIDA",
    "RESPONSABLE",
    "OBSERVACION",
    "FECHA_DECISION",
  ];

  const rows = registros.map((r) => [
    r.sku,
    r.descripcion,
    r.marca,
    r.origen,
    r.coberturaObjetivo,
    r.coberturaActual,
    r.riesgo,
    r.compraHabilitada ? "COMPRAR" : "NO COMPRAR",
    r.compraSugerida,
    r.estadoGestion,
    r.cantidadDecidida,
    r.responsable,
    r.observacion,
    r.fechaDecision,
  ]);

  const content = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gestion_compras_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Select({ label, value, options, placeholder, onChange }: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-[var(--muted)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-xs font-medium text-[var(--navy)] outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Risk({ value }: { value: string }) {
  const tone = value === "SIN STOCK" ? "bg-red-50 text-red-700" : value === "URGENTE"
    ? "bg-orange-50 text-orange-700" : value === "COMPRAR" ? "bg-amber-50 text-amber-800"
      : value === "REVISAR" ? "bg-emerald-50 text-emerald-700" : "bg-[var(--soft)] text-[var(--muted)]";
  return <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap ${tone}`}>{value || "—"}</span>;
}

export function ComprasGestionWorkspace({ gestion, initialBrand = "", canEdit = false }: { gestion: ComprasGestion; initialBrand?: string; canEdit?: boolean }) {
  const router = useRouter();
  const [filters, setFilters] = useState<GestionFilters>(() => ({ ...blankFilters, marca: initialBrand }));
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<GestionRegistro | null>(null);
  const [draft, setDraft] = useState<GestionDraft>(blankDraft);
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(() => new Set());
  const [bulkState, setBulkState] = useState("");
  const [bulkObservationEnabled, setBulkObservationEnabled] = useState(false);
  const [bulkObservation, setBulkObservation] = useState("");
  const [groupState, setGroupState] = useState("");
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const actionHost = useSyncExternalStore(subscribeActionHost, getActionHost, getServerActionHost);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selectVisibleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selected && !dialog.open) dialog.showModal();
    if (!selected && dialog.open) dialog.close();
  }, [selected]);

  const openGestion = (registro: GestionRegistro) => {
    setDraft({
      estadoGestion: registro.estadoGestion || "PENDIENTE",
      cantidadDecidida: registro.cantidadDecidida > 0 ? String(registro.cantidadDecidida) : "",
      observacion: registro.observacion,
    });
    setSelected(registro);
  };

  const closeGestion = () => {
    dialogRef.current?.close();
    setSelected(null);
  };

  const setFilter = (key: keyof GestionFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const filtered = useMemo(() => filterGestion(gestion.registros, filters), [gestion.registros, filters]);
  const summary = useMemo(() => summarizeGestion(filtered), [filtered]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pageCount);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const activeFilters = Object.values(filters).some(Boolean);
  const brandOptions = filters.marca && !gestion.marcas.includes(filters.marca)
    ? [filters.marca, ...gestion.marcas]
    : gestion.marcas;

  const selectedFilteredCount = useMemo(
    () => filtered.reduce((total, registro) => total + (selectedSkus.has(registro.sku) ? 1 : 0), 0),
    [filtered, selectedSkus],
  );
  const allFilteredSelected = filtered.length > 0 && selectedFilteredCount === filtered.length;

  useEffect(() => {
    if (!selectVisibleRef.current) return;
    selectVisibleRef.current.indeterminate = selectedFilteredCount > 0 && selectedFilteredCount < filtered.length;
  }, [filtered.length, selectedFilteredCount]);

  const toggleRegistro = (sku: string, checked: boolean) => {
    setSelectedSkus((current) => {
      const next = new Set(current);
      if (checked) next.add(sku);
      else next.delete(sku);
      return next;
    });
  };

  const toggleFiltered = (checked: boolean) => {
    setSelectedSkus((current) => {
      const next = new Set(current);
      filtered.forEach((registro) => {
        if (checked) next.add(registro.sku);
        else next.delete(registro.sku);
      });
      return next;
    });
  };

  const clearSelection = () => setSelectedSkus(new Set());

  const updateQuantityDraft = (registro: GestionRegistro, value: string) => {
    const original = registro.cantidadDecidida > 0 ? String(registro.cantidadDecidida) : "";
    setQuantityDrafts((current) => {
      const next = { ...current };
      if (value === original) delete next[registro.sku];
      else next[registro.sku] = value;
      return next;
    });
  };

  const changedQuantities = Object.keys(quantityDrafts).length;

  const saveChanges = async (changes: Array<{ sku: string; estadoGestion: string; cantidadDecidida: number; observacion: string; version: number }>, afterSave: () => void) => {
    if (!canEdit || saving) return;
    setSaveError("");
    setSaveMessage("");
    if (changes.some((change) => !GESTION_ESTADOS.includes(change.estadoGestion) || !Number.isSafeInteger(change.cantidadDecidida) || change.cantidadDecidida < 0 || change.version < 1)) {
      setSaveError("Revisá estado y cantidades. Un SKU sin resolver necesita una decisión explícita.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/compras/gestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar Gestión.");
      afterSave();
      setSaveMessage(`${number(result.saved)} SKU guardados en Supabase.`);
      router.refresh();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "No se pudo guardar Gestión.");
    } finally {
      setSaving(false);
    }
  };

  const quantityFromText = (value: string) => value.trim() === "" ? 0 : Number(value);

  const saveQuantities = () => {
    const records = gestion.registros.filter((registro) => Object.prototype.hasOwnProperty.call(quantityDrafts, registro.sku));
    void saveChanges(records.map((registro) => ({
      sku: registro.sku,
      estadoGestion: groupState || registro.estadoGestion,
      cantidadDecidida: quantityFromText(quantityDrafts[registro.sku]),
      observacion: registro.observacion,
      version: registro.version,
    })), () => { setQuantityDrafts({}); setGroupState(""); });
  };

  const applyBulk = () => {
    const records = gestion.registros.filter((registro) => selectedSkus.has(registro.sku));
    void saveChanges(records.map((registro) => ({
      sku: registro.sku,
      estadoGestion: bulkState,
      cantidadDecidida: registro.cantidadDecidida,
      observacion: bulkObservationEnabled ? bulkObservation.trim() : registro.observacion,
      version: registro.version,
    })), () => { clearSelection(); setBulkState(""); setBulkObservation(""); setBulkObservationEnabled(false); });
  };

  return (
    <div className="mt-3 space-y-3">
      {actionHost && createPortal(
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <select
            value={groupState}
            onChange={(event) => setGroupState(event.target.value)}
            aria-label="Estado del grupo"
            className="h-9 w-[130px] rounded-xl border border-[var(--line)] bg-white px-2 text-[11px] font-medium text-[var(--navy)] outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15"
          >
            <option value="">Estado</option>
            {GESTION_ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
          </select>

          <button
            type="button"
            onClick={saveQuantities}
            disabled={!canEdit || saving || changedQuantities === 0}
            title={!canEdit ? "Guardado disponible tras activar la migración a Supabase para editores." : undefined}
            className="h-9 rounded-xl bg-emerald-600 px-2.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
          >
            Guardar ({number(changedQuantities)})
          </button>

          <button
            type="button"
            onClick={() => downloadGestionCsv(filtered)}
            disabled={filtered.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--blue)] bg-white px-2.5 text-[11px] font-semibold text-[var(--blue)] transition hover:bg-[var(--navy-soft)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download aria-hidden="true" className="size-3.5" />
            Descargar
          </button>
        </div>,
        actionHost,
      )}

      {(saveError || saveMessage) && <p role={saveError ? "alert" : "status"} className={`rounded-xl px-3 py-2 text-xs ${saveError ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{saveError || saveMessage}</p>}

      <section className="rounded-[18px] border border-[var(--line)] bg-white p-3" aria-label="Filtros de gestión">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] xl:items-end">
          <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-[var(--muted)]">
            Buscar SKU, descripción o marca
            <span className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-2.5 size-4 text-[var(--muted)]" />
              <input
                type="search"
                value={filters.texto}
                onChange={(event) => setFilter("texto", event.target.value)}
                placeholder="Buscar registros…"
                className="h-9 w-full rounded-xl border border-[var(--line)] bg-white pl-9 pr-3 text-xs font-medium text-[var(--navy)] outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15"
              />
            </span>
          </label>
          <Select label="Riesgo" value={filters.riesgo} options={gestion.riesgos} placeholder="Todos" onChange={(v) => setFilter("riesgo", v)} />
          <Select label="Estado" value={filters.estado} options={gestion.estados} placeholder="Todos" onChange={(v) => setFilter("estado", v)} />
          <Select label="Marca" value={filters.marca} options={brandOptions} placeholder="Todas" onChange={(v) => setFilter("marca", v)} />
          <Select label="Política" value={filters.politica} options={["COMPRAR", "NO COMPRAR"]} placeholder="Todas" onChange={(v) => setFilter("politica", v)} />
          <button type="button" onClick={() => { setFilters(blankFilters); setPage(1); }} disabled={!activeFilters} className="h-9 justify-self-end whitespace-nowrap rounded-xl px-2 text-[11px] font-semibold text-[var(--blue)] hover:bg-[var(--navy-soft)] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent sm:col-span-2 xl:col-span-1">Limpiar filtros</button>
        </div>
      </section>

      <section className="rounded-[18px] border border-[#c9deea] bg-[#f2f8fc] px-3 py-2" aria-label="Gestión masiva">
        <div className="grid gap-2 lg:grid-cols-[auto_auto_minmax(220px,1fr)_minmax(260px,1fr)_auto] lg:items-end">
          <label className="flex h-9 items-center gap-2 text-xs font-medium text-[var(--navy)]">
            <input
              ref={selectVisibleRef}
              type="checkbox"
              checked={allFilteredSelected}
              onChange={(event) => toggleFiltered(event.target.checked)}
              className="size-4 rounded border-[var(--line)] accent-[var(--navy)]"
            />
            Seleccionar visibles
          </label>

          <div className="flex h-9 items-center text-sm font-semibold text-[var(--navy)]">
            {number(selectedSkus.size)} seleccionados
          </div>

          <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-[var(--muted)]">
            Estado para seleccionados
            <select
              value={bulkState}
              onChange={(event) => setBulkState(event.target.value)}
              className="h-9 rounded-xl border border-[var(--line)] bg-white px-3 text-xs font-medium text-[var(--navy)] outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15"
            >
              <option value="">Elegir estado…</option>
              {GESTION_ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-[var(--muted)]">
            Observación común
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={bulkObservationEnabled}
                onChange={(event) => {
                  setBulkObservationEnabled(event.target.checked);
                  if (!event.target.checked) setBulkObservation("");
                }}
                className="size-4 shrink-0 rounded border-[var(--line)] accent-[var(--navy)]"
                title="Marcar para reemplazar la observación de todos los SKU seleccionados"
              />
              <input
                type="text"
                maxLength={1000}
                value={bulkObservation}
                disabled={!bulkObservationEnabled}
                onChange={(event) => setBulkObservation(event.target.value)}
                placeholder="Opcional"
                className="h-9 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-3 text-xs font-medium text-[var(--navy)] outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </span>
          </label>

          <div className="flex h-9 items-center justify-end gap-2">
            <button
              type="button"
              onClick={clearSelection}
              disabled={selectedSkus.size === 0}
              className="h-9 rounded-xl border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[var(--navy)] transition hover:bg-[var(--soft)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Quitar selección
            </button>
            <button
              type="button"
              onClick={applyBulk}
              disabled={!canEdit || saving || selectedSkus.size === 0 || !bulkState}
              title={!canEdit ? "Guardado disponible tras activar la migración a Supabase para editores." : undefined}
              className="h-9 rounded-xl bg-purple-600 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
            >
              Aplicar
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen de registros filtrados">
        {[
          { label: "Registros", value: summary.total },
          { label: "Pendientes", value: summary.pendientes },
          { label: "Con decisión", value: summary.conDecision },
          { label: "Compra sugerida", value: summary.compraSugerida },
        ].map((item) => (
          <article key={item.label} className="rounded-[18px] border border-[var(--line)] bg-white px-4 py-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--muted)]">{item.label}</p>
            <p className="mt-0.5 text-2xl font-semibold tracking-[-0.04em] tabular-nums text-[var(--navy)]">{number(item.value)}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-white" aria-label="Registros de gestión">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] table-fixed border-collapse text-left text-[10px] leading-[1.25]">
            <colgroup>
              {[3, 9, 11, 7, 6, 4, 7, 6, 6, 7, 7, 6, 6, 6, 6, 6].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
            </colgroup>
            <thead className="bg-[var(--soft)] text-[9px] font-bold uppercase tracking-normal text-[var(--muted)]">
              <tr>
                <th scope="col" className="px-1.5 py-2 text-center">✓</th>
                <th scope="col" className="px-1.5 py-2">SKU</th>
                <th scope="col" className="px-1.5 py-2">Descripción</th>
                <th scope="col" className="px-1.5 py-2">Marca</th>
                <th scope="col" className="px-1.5 py-2">Origen</th>
                <th scope="col" className="px-1.5 py-2 text-right">Objetivo</th>
                <th scope="col" className="px-1.5 py-2 text-right">Cobertura actual</th>
                <th scope="col" className="px-1.5 py-2">Riesgo</th>
                <th scope="col" className="px-1.5 py-2">Política</th>
                <th scope="col" className="px-1.5 py-2 text-right">Compra sugerida</th>
                <th scope="col" className="px-1.5 py-2">Estado</th>
                <th scope="col" className="px-1.5 py-2 text-right">Cantidad decidida</th>
                <th scope="col" className="px-1.5 py-2">Responsable</th>
                <th scope="col" className="px-1.5 py-2">Observación</th>
                <th scope="col" className="px-1.5 py-2">Fecha decisión</th>
                <th scope="col" className="px-1.5 py-2 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {visible.length ? visible.map((r, index) => {
                const quantityValue = quantityDrafts[r.sku] ?? (r.cantidadDecidida > 0 ? String(r.cantidadDecidida) : "");
                const quantityChanged = Object.prototype.hasOwnProperty.call(quantityDrafts, r.sku);
                return (
                  <tr key={`${r.sku}-${start + index}`} className={selectedSkus.has(r.sku) ? "bg-sky-50/55 hover:bg-sky-50" : "hover:bg-[#f8fafb]"}>
                    <td className="px-1.5 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedSkus.has(r.sku)}
                        onChange={(event) => toggleRegistro(r.sku, event.target.checked)}
                        aria-label={`Seleccionar ${r.sku}`}
                        className="size-4 rounded border-[var(--line)] accent-[var(--navy)]"
                      />
                    </td>
                    <th scope="row" className="break-all px-1.5 py-2 font-medium text-[var(--ink)]">{r.sku}</th>
                    <td className="break-words px-1.5 py-2">{r.descripcion || "—"}</td>
                    <td className="break-words px-1.5 py-2">{r.marca}</td>
                    <td className="break-words px-1.5 py-2">{r.origen}</td>
                    <td className="px-1.5 py-2 text-right tabular-nums">{r.coberturaObjetivo > 0 ? r.coberturaObjetivo.toFixed(1) : "—"}</td>
                    <td className="px-1.5 py-2 text-right tabular-nums">{r.coberturaActual.toFixed(2)} meses</td>
                    <td className="px-1.5 py-2"><Risk value={r.riesgo} /></td>
                    <td className="px-1.5 py-2"><span className={`rounded-full px-1 py-0.5 text-[8px] font-bold whitespace-nowrap ${r.compraHabilitada ? "bg-sky-50 text-sky-800" : "bg-slate-100 text-slate-600"}`}>{r.compraHabilitada ? "COMPRAR" : "NO COMPRAR"}</span></td>
                    <td className="px-1.5 py-2 text-right tabular-nums">{number(r.compraSugerida)}</td>
                    <td className="break-words px-1.5 py-2">{r.estadoGestion}</td>
                    <td className="px-1.5 py-1.5 text-right">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={quantityValue}
                        onChange={(event) => updateQuantityDraft(r, event.target.value)}
                        aria-label={`Cantidad decidida para ${r.sku}`}
                        disabled={!canEdit || registroUnavailable(r)}
                        className={`h-8 w-full min-w-[72px] rounded-lg border px-2 text-right text-[10px] font-medium tabular-nums outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15 disabled:cursor-not-allowed disabled:opacity-60 ${quantityChanged ? "border-amber-400 bg-amber-50" : "border-[var(--line)] bg-white"}`}
                      />
                    </td>
                    <td className="break-words px-1.5 py-2">{r.responsable || "—"}</td>
                    <td className="break-words px-1.5 py-2">{r.observacion || "—"}</td>
                    <td className="break-words px-1.5 py-2">{r.fechaDecision || "—"}</td>
                    <td className="px-1.5 py-1.5">
                      <span className="flex flex-col gap-1">
                        <button type="button" onClick={() => openGestion(r)} aria-label={`Gestionar ${r.sku}`} className="w-full rounded bg-[var(--navy)] px-1 py-0.5 text-[9px] font-semibold text-white transition hover:bg-[var(--blue)]">Gestionar</button>
                        <Link href={{ pathname: "/areas/compras", query: { vista: "historial", sku: r.sku } }} prefetch={false} aria-label={`Ver historial de ${r.sku}`} className="w-full rounded border border-[var(--blue)] px-1 py-0.5 text-center text-[9px] font-semibold text-[var(--blue)] transition hover:bg-[var(--navy-soft)]">Historial</Link>
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={16} className="px-5 py-12 text-center text-sm text-[var(--muted)]">No existen registros para los filtros seleccionados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-4 text-xs text-[var(--muted)] sm:px-6">
            <span>Mostrando {number(start + 1)}–{number(Math.min(start + PAGE_SIZE, filtered.length))} de {number(filtered.length)}</span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Página anterior" disabled={visiblePage === 1} onClick={() => setPage(visiblePage - 1)} className="rounded-lg border border-[var(--line)] p-2 text-[var(--navy)] disabled:opacity-40"><ChevronLeft className="size-4" /></button>
              <span className="min-w-16 text-center">{visiblePage} / {pageCount}</span>
              <button type="button" aria-label="Página siguiente" disabled={visiblePage === pageCount} onClick={() => setPage(visiblePage + 1)} className="rounded-lg border border-[var(--line)] p-2 text-[var(--navy)] disabled:opacity-40"><ChevronRight className="size-4" /></button>
            </div>
          </div>
        )}
      </section>

      <dialog
        ref={dialogRef}
        onClose={() => setSelected(null)}
        aria-labelledby="gestion-panel-title"
        className="fixed inset-y-0 right-0 left-auto m-0 ml-auto h-dvh max-h-dvh w-full max-w-[520px] border-0 bg-white p-0 text-[var(--ink)] shadow-2xl backdrop:bg-slate-950/50"
      >
        {selected && (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--blue)]">{canEdit ? "Decisión en Supabase" : "Consulta de solo lectura"}</p>
                <h2 id="gestion-panel-title" className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--navy)]">Gestionar SKU</h2>
              </div>
              <button type="button" onClick={closeGestion} aria-label="Cerrar panel de gestión" className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--navy)]"><X aria-hidden="true" className="size-5" /></button>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
              <div>
                <p className="break-all text-lg font-semibold text-[var(--navy)]">{selected.sku}</p>
                <p className="mt-1 text-sm leading-5 text-[var(--muted)]">{selected.descripcion || "Sin descripción"}</p>
              </div>

              <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-[var(--soft)] p-4 text-xs sm:grid-cols-3">
                <div><dt className="font-semibold text-[var(--muted)]">Marca</dt><dd className="mt-1 font-medium text-[var(--navy)]">{selected.marca}</dd></div>
                <div><dt className="font-semibold text-[var(--muted)]">Riesgo</dt><dd className="mt-1 font-medium text-[var(--navy)]">{selected.riesgo || "—"}</dd></div>
                <div><dt className="font-semibold text-[var(--muted)]">Compra sugerida</dt><dd className="mt-1 font-medium tabular-nums text-[var(--navy)]">{number(selected.compraSugerida)}</dd></div>
              </dl>

              <div className="space-y-4">
                <label htmlFor="gestion-estado" className="block text-xs font-semibold text-[var(--navy)]">Estado de gestión</label>
                <select id="gestion-estado" value={draft.estadoGestion} onChange={(event) => setDraft((current) => ({ ...current, estadoGestion: event.target.value }))} className="-mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15">
                  {(gestion.estados.includes(draft.estadoGestion) ? gestion.estados : [...gestion.estados, draft.estadoGestion]).map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                </select>

                <label htmlFor="gestion-cantidad" className="block text-xs font-semibold text-[var(--navy)]">Cantidad decidida</label>
                <input id="gestion-cantidad" type="number" min="0" step="1" value={draft.cantidadDecidida} onChange={(event) => setDraft((current) => ({ ...current, cantidadDecidida: event.target.value }))} placeholder="Sin cantidad" className="-mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15" />

                <label htmlFor="gestion-observacion" className="block text-xs font-semibold text-[var(--navy)]">Observación</label>
                <textarea id="gestion-observacion" maxLength={1000} rows={5} value={draft.observacion} onChange={(event) => setDraft((current) => ({ ...current, observacion: event.target.value }))} placeholder="Agregá una observación" className="-mt-2 w-full resize-y rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15" />
                <p className="text-right text-[11px] text-[var(--muted)]">{draft.observacion.length} / 1000 caracteres</p>
              </div>

              {(selected.responsable || selected.fechaDecision) && (
                <p className="border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">Última decisión: {selected.responsable || "Sin responsable"}{selected.fechaDecision ? ` · ${selected.fechaDecision}` : ""}</p>
              )}
            </div>

            <div className="border-t border-[var(--line)] bg-white px-5 py-4 sm:px-6">
              {saveError && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{saveError}</p>}
              <p className="mb-3 text-xs text-[var(--muted)]">{selected.requiereRevision ? "Este SKU tiene una discrepancia histórica: elegí un estado explícito antes de guardar." : canEdit ? "La decisión se guardará en Supabase; Google Sheets no se modificará." : "La edición se habilitará cuando termine la migración de Gestión."}</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeGestion} className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-xs font-semibold text-[var(--navy)] transition hover:bg-[var(--soft)]">Cerrar sin guardar</button>
                <button type="button" onClick={() => void saveChanges([{
                  sku: selected.sku,
                  estadoGestion: draft.estadoGestion,
                  cantidadDecidida: quantityFromText(draft.cantidadDecidida),
                  observacion: draft.observacion.trim(),
                  version: selected.version,
                }], closeGestion)} disabled={!canEdit || saving || selected.version < 1 || !GESTION_ESTADOS.includes(draft.estadoGestion)} className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
