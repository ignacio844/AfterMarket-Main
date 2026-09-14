"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterGestion, summarizeGestion, type ComprasGestion, type GestionFilters, type GestionRegistro } from "@/lib/compras-gestion";

const PAGE_SIZE = 50;
const blankFilters: GestionFilters = { texto: "", riesgo: "", estado: "", marca: "", politica: "" };
type GestionDraft = { estadoGestion: string; cantidadDecidida: string; observacion: string };
const blankDraft: GestionDraft = { estadoGestion: "PENDIENTE", cantidadDecidida: "", observacion: "" };
const whole = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

function number(value: number) {
  return whole.format(Math.round(value || 0));
}

function Select({ label, value, options, placeholder, onChange }: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[11px] font-semibold text-[var(--muted)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-xs font-medium text-[var(--navy)] outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15"
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

export function ComprasGestionWorkspace({ gestion }: { gestion: ComprasGestion }) {
  const [filters, setFilters] = useState<GestionFilters>(blankFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<GestionRegistro | null>(null);
  const [draft, setDraft] = useState<GestionDraft>(blankDraft);
  const dialogRef = useRef<HTMLDialogElement>(null);
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

  return (
    <div className="mt-3 space-y-3">
      <section className="rounded-[18px] border border-[var(--line)] bg-white p-4" aria-labelledby="gestion-filtros-title">
        <div className="mb-3 flex items-center gap-2 text-[var(--navy)]">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          <h2 id="gestion-filtros-title" className="text-base font-semibold">Explorar registros</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <label className="flex min-w-0 flex-col gap-1.5 text-[11px] font-semibold text-[var(--muted)] lg:col-span-2">
            Buscar SKU, descripción o marca
            <span className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-[var(--muted)]" />
              <input
                type="search"
                value={filters.texto}
                onChange={(event) => setFilter("texto", event.target.value)}
                placeholder="Buscar registros…"
                className="h-10 w-full rounded-xl border border-[var(--line)] bg-white pl-9 pr-3 text-xs font-medium text-[var(--navy)] outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15"
              />
            </span>
          </label>
          <Select label="Riesgo" value={filters.riesgo} options={gestion.riesgos} placeholder="Todos" onChange={(v) => setFilter("riesgo", v)} />
          <Select label="Estado" value={filters.estado} options={gestion.estados} placeholder="Todos" onChange={(v) => setFilter("estado", v)} />
          <Select label="Marca" value={filters.marca} options={gestion.marcas} placeholder="Todas" onChange={(v) => setFilter("marca", v)} />
          <Select label="Política" value={filters.politica} options={["COMPRAR", "NO COMPRAR"]} placeholder="Todas" onChange={(v) => setFilter("politica", v)} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
          <p className="text-xs text-[var(--muted)]">{number(filtered.length)} de {number(gestion.total)} registros</p>
          <button type="button" onClick={() => { setFilters(blankFilters); setPage(1); }} disabled={!activeFilters} className="text-xs font-semibold text-[var(--blue)] hover:underline disabled:cursor-default disabled:opacity-40 disabled:no-underline">Limpiar filtros</button>
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen de registros filtrados">
        {[
          { label: "Registros", value: summary.total },
          { label: "Pendientes", value: summary.pendientes },
          { label: "Con decisión", value: summary.conDecision },
          { label: "Compra sugerida", value: summary.compraSugerida },
        ].map((item) => (
          <article key={item.label} className="rounded-[18px] border border-[var(--line)] bg-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--muted)]">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] tabular-nums text-[var(--navy)]">{number(item.value)}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-white" aria-labelledby="gestion-tabla-title">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Solo lectura</p>
            <h2 id="gestion-tabla-title" className="mt-0.5 text-base font-semibold tracking-[-0.025em] text-[var(--navy)]">Gestión de Compras</h2>
          </div>
          <span className="rounded-full bg-[var(--soft)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]">{number(filtered.length)} resultados</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] table-fixed border-collapse text-left text-[10px] leading-[1.25]">
            <colgroup>
              {[9, 11, 7, 6, 4, 7, 6, 6, 7, 7, 6, 6, 6, 6, 6].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
            </colgroup>
            <thead className="bg-[var(--soft)] text-[9px] font-bold uppercase tracking-normal text-[var(--muted)]">
              <tr>
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
              {visible.length ? visible.map((r, index) => (
                <tr key={`${r.sku}-${start + index}`} className="hover:bg-[#f8fafb]">
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
                  <td className="px-1.5 py-2 text-right tabular-nums">{r.cantidadDecidida > 0 ? number(r.cantidadDecidida) : "—"}</td>
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
              )) : (
                <tr><td colSpan={15} className="px-5 py-12 text-center text-sm text-[var(--muted)]">No existen registros para los filtros seleccionados.</td></tr>
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
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--blue)]">Borrador local · sin guardar</p>
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
                <textarea id="gestion-observacion" maxLength={1000} rows={5} value={draft.observacion} onChange={(event) => setDraft((current) => ({ ...current, observacion: event.target.value }))} placeholder="Agregá una nota para probar el formulario" className="-mt-2 w-full resize-y rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15" />
                <p className="text-right text-[11px] text-[var(--muted)]">{draft.observacion.length} / 1000 caracteres</p>
              </div>

              {(selected.responsable || selected.fechaDecision) && (
                <p className="border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">Última decisión: {selected.responsable || "Sin responsable"}{selected.fechaDecision ? ` · ${selected.fechaDecision}` : ""}</p>
              )}
            </div>

            <div className="border-t border-[var(--line)] bg-white px-5 py-4 sm:px-6">
              <p className="mb-3 text-xs text-[var(--muted)]">Este es un prototipo. Los cambios se descartan al cerrar y no llegan a Google Sheets.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeGestion} className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-xs font-semibold text-[var(--navy)] transition hover:bg-[var(--soft)]">Cerrar sin guardar</button>
                <button type="button" disabled title="La persistencia se implementará en una etapa posterior." className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-semibold text-white opacity-50 disabled:cursor-not-allowed">Guardar</button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
