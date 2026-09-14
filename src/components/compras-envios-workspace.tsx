"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCw, X } from "lucide-react";
import { filterEnvios, summarizeEnvios, type ComprasEnvios, type EnvioCompra, type EnviosFilters } from "@/lib/compras-envios";

const whole = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const emptyFilters: EnviosFilters = { texto: "", desde: "", hasta: "", marca: "" };

function number(value: number) {
  return whole.format(value || 0);
}

export function ComprasEnviosWorkspace({ data }: { data: ComprasEnvios }) {
  const [filters, setFilters] = useState<EnviosFilters>(emptyFilters);
  const [selectedEnvio, setSelectedEnvio] = useState<string | null>(null);
  const marcas = useMemo(() => Array.from(new Set(data.envios.flatMap((envio) => envio.detalle.map((row) => row.marca).filter(Boolean))))
    .sort((a, b) => a.localeCompare(b, "es")), [data.envios]);
  const visibles = useMemo(() => filterEnvios(data.envios, filters), [data.envios, filters]);
  const resumenVisible = useMemo(() => summarizeEnvios(visibles), [visibles]);
  const field = (name: keyof EnviosFilters, value: string) => setFilters((current) => ({ ...current, [name]: value }));
  const envioAbierto = data.envios.find((envio) => envio.nroEnvio === selectedEnvio) ?? null;

  return (
    <div className="mt-6 space-y-5">
      <section>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Trazabilidad de lotes</p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[var(--navy)]">Enviados a Compra</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Lotes enviados desde la Bandeja de Compra, en modo consulta.</p>
      </section>

      <section aria-label="Resumen de envíos" className="grid gap-3 sm:grid-cols-3">
        {([
          ["Envíos", data.resumen.envios],
          ["SKU enviados", data.resumen.sku],
          ["Unidades enviadas", data.resumen.unidades],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-[20px] border border-[var(--line)] bg-white px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--navy)]">{number(value)}</p>
          </div>
        ))}
      </section>

      <section aria-label="Filtros de envíos" className="grid gap-3 rounded-[22px] border border-[var(--line)] bg-white p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] xl:items-end">
        <label className="min-w-0 text-xs font-semibold text-[var(--navy)]">N° envío / SKU / descripción
          <input type="search" value={filters.texto} onChange={(event) => field("texto", event.target.value)} placeholder="Buscar envío o producto" className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] px-3 text-sm font-normal outline-none focus:border-[var(--blue)]" />
        </label>
        <label className="min-w-0 text-xs font-semibold text-[var(--navy)]">Desde
          <input type="date" value={filters.desde} onChange={(event) => field("desde", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] px-3 text-sm font-normal outline-none focus:border-[var(--blue)]" />
        </label>
        <label className="min-w-0 text-xs font-semibold text-[var(--navy)]">Hasta
          <input type="date" value={filters.hasta} onChange={(event) => field("hasta", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] px-3 text-sm font-normal outline-none focus:border-[var(--blue)]" />
        </label>
        <label className="min-w-0 text-xs font-semibold text-[var(--navy)]">Marca
          <select value={filters.marca} onChange={(event) => field("marca", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal outline-none focus:border-[var(--blue)]">
            <option value="">Todas</option>
            {marcas.map((marca) => <option key={marca} value={marca}>{marca}</option>)}
          </select>
        </label>
        <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
          <button type="button" onClick={() => setFilters(emptyFilters)} className="h-10 rounded-xl border border-[var(--line)] px-3 text-xs font-semibold text-[var(--navy)]">Limpiar</button>
          <button type="button" onClick={() => window.location.reload()} aria-label="Actualizar envíos" title="Actualizar" className="grid size-10 place-items-center rounded-xl border border-[var(--line)] text-[var(--navy)]"><RotateCw aria-hidden="true" className="size-4" /></button>
        </div>
      </section>

      <p role="status" className="text-xs font-medium text-[var(--muted)]">{number(resumenVisible.envios)} {resumenVisible.envios === 1 ? "envío visible" : "envíos visibles"} · {number(resumenVisible.sku)} SKU · {number(resumenVisible.unidades)} unidades</p>

      {visibles.length === 0 ? (
        <p className="rounded-[20px] border border-[var(--line)] bg-white px-5 py-8 text-center text-sm text-[var(--muted)]">No hay envíos que coincidan con los filtros seleccionados.</p>
      ) : (
        <section aria-label="Lotes enviados" className="space-y-3">
          {visibles.map((envio) => (
            <article key={envio.nroEnvio} className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[var(--line)] bg-white px-5 py-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--navy)]">{envio.nroEnvio}</h3>
                  <p className="mt-1 text-xs text-[var(--muted)]">{envio.fechaEnvio || "Sin fecha"} · {envio.usuarioEnvio || "Sin usuario"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                  <span className="rounded-full bg-[var(--soft)] px-2.5 py-1">{number(envio.sku)} SKU</span>
                  <span className="rounded-full bg-[var(--soft)] px-2.5 py-1">{number(envio.unidades)} un.</span>
                  <span className="rounded-full bg-[var(--soft)] px-2.5 py-1">{number(envio.marcas)} marcas</span>
                  {envio.ocs.length ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">{envio.ocs.length} OC</span> : <span className="text-[var(--muted)]">Sin OC</span>}
                  <button type="button" onClick={() => setSelectedEnvio(envio.nroEnvio)} className="ml-1 rounded-xl border border-[var(--blue)] px-3 py-2 font-semibold text-[var(--blue)] hover:bg-[var(--navy-soft)]">Ver detalle</button>
                </div>
            </article>
          ))}
        </section>
      )}
      {envioAbierto && <EnvioDetalleModal envio={envioAbierto} proveedores={data.proveedores} onClose={() => setSelectedEnvio(null)} />}
    </div>
  );
}

function EnvioDetalleModal({ envio, proveedores, onClose }: {
  envio: EnvioCompra;
  proveedores: string[];
  onClose: () => void;
}) {
  const [seleccionados, setSeleccionados] = useState<Set<number>>(() => new Set());
  const [proveedor, setProveedor] = useState("");
  const [nuevoProveedor, setNuevoProveedor] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const nuevoProveedorRef = useRef<HTMLInputElement>(null);
  const elegibles = envio.detalle.map((row, index) => row.oc ? -1 : index).filter((index) => index >= 0);
  const todosSeleccionados = elegibles.length > 0 && elegibles.every((index) => seleccionados.has(index));

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  const seleccionar = (index: number, checked: boolean) => {
    setSeleccionados((current) => {
      const next = new Set(current);
      if (checked) next.add(index);
      else next.delete(index);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-2 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="envio-modal-title" className="flex max-h-[calc(100vh-1rem)] w-full max-w-[1500px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl outline-none sm:max-h-[calc(100vh-2rem)]">
        <header className="flex items-center justify-between gap-3 bg-[var(--navy)] px-5 py-4 text-white sm:px-6">
          <h2 id="envio-modal-title" className="text-lg font-semibold">Detalle del envío {envio.nroEnvio}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar detalle" className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-white/15"><X aria-hidden="true" className="size-4" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {([
              ["N° envío", envio.nroEnvio],
              ["Fecha / hora", envio.fechaEnvio || "–"],
              ["Usuario envío", envio.usuarioEnvio || "–"],
              ["SKU", number(envio.sku)],
              ["Unidades", number(envio.unidades)],
              ["Marcas", number(envio.marcas)],
            ] as const).map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-3">
              <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</dt>
              <dd className="mt-1 break-words text-sm font-medium text-[var(--navy)]">{value}</dd>
            </div>)}
          </dl>
          <p className="mt-3 rounded-xl border-l-4 border-emerald-700 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            {number(envio.sku)} SKU · {number(envio.unidades)} unidades · {number(envio.marcas)} {envio.marcas === 1 ? "marca" : "marcas"}
          </p>

          <section aria-label="Preparación de orden de compra" className="mt-4 grid gap-2 rounded-xl border border-blue-200 bg-blue-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="min-w-0 text-[11px] font-semibold text-[var(--muted)]">Proveedor
              <select value={proveedor} onChange={(event) => { setProveedor(event.target.value); if (event.target.value === "__NUEVO__") requestAnimationFrame(() => nuevoProveedorRef.current?.focus()); }} className="mt-1 h-10 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)]">
                <option value="">Seleccionar proveedor...</option>
                {proveedores.map((name) => <option key={name} value={name}>{name}</option>)}
                <option value="__NUEVO__">+ Nuevo proveedor</option>
              </select>
            </label>
            <label className="min-w-0 text-[11px] font-semibold text-[var(--muted)]">Nuevo proveedor
              <input ref={nuevoProveedorRef} type="text" value={nuevoProveedor} onChange={(event) => setNuevoProveedor(event.target.value)} disabled={proveedor !== "__NUEVO__"} placeholder="Nombre del proveedor" className="mt-1 h-10 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)] disabled:bg-[var(--soft)]" />
            </label>
            <button type="button" disabled title="La generación de OC requiere habilitar escrituras en una etapa posterior" className="h-10 rounded-lg bg-[var(--blue)] px-4 text-xs font-semibold text-white opacity-55 disabled:cursor-not-allowed">Generar OC</button>
          </section>
          <p className="mt-2 text-xs text-[var(--muted)]">La selección y el proveedor son un borrador local. Generar OC aún no está habilitado; no se modifican las hojas.</p>

          {envio.ocs.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><strong className="text-[var(--navy)]">OC generadas:</strong>
            {[...envio.ocs].sort((a, b) => b.nroOc.localeCompare(a.nroOc)).map((oc) => <span key={oc.nroOc} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">{oc.nroOc}{oc.proveedor ? ` · ${oc.proveedor}` : ""}</span>)}
          </div>}

          <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full min-w-[1160px] border-collapse text-left text-[11px]">
              <thead className="bg-[var(--navy)] font-bold uppercase text-white"><tr>
                <th className="px-2 py-2.5"><input type="checkbox" aria-label="Seleccionar todos los SKU sin OC" disabled={elegibles.length === 0} checked={todosSeleccionados} onChange={(event) => setSeleccionados(event.target.checked ? new Set(elegibles) : new Set())} /></th>
                <th className="px-2 py-2.5">SKU</th><th className="px-2 py-2.5">Descripción</th><th className="px-2 py-2.5">Marca</th><th className="px-2 py-2.5">Riesgo</th><th className="px-2 py-2.5 text-right">Compra sugerida</th><th className="px-2 py-2.5 text-right">Cantidad</th><th className="px-2 py-2.5">Responsable</th><th className="px-2 py-2.5">Observación</th><th className="px-2 py-2.5">Fecha decisión</th><th className="px-2 py-2.5">OC</th>
              </tr></thead>
              <tbody className="divide-y divide-[var(--line)]">
                {envio.detalle.map((row, index) => <tr key={`${row.sku}-${index}`} className={row.oc ? "bg-emerald-50/50" : ""}>
                  <td className="px-2 py-2"><input type="checkbox" aria-label={`Seleccionar ${row.sku}`} disabled={Boolean(row.oc)} checked={seleccionados.has(index)} onChange={(event) => seleccionar(index, event.target.checked)} /></td>
                  <th scope="row" className="px-2 py-2 font-semibold text-[var(--navy)]">{row.sku}</th>
                  <td className="px-2 py-2">{row.descripcion}</td><td className="px-2 py-2">{row.marca}</td>
                  <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 font-semibold ${row.riesgo.toUpperCase() === "SIN STOCK" ? "bg-red-100 text-red-800" : row.riesgo.toUpperCase() === "URGENTE" ? "bg-orange-100 text-orange-800" : "bg-[var(--soft)] text-[var(--ink)]"}`}>{row.riesgo || "–"}</span></td>
                  <td className="px-2 py-2 text-right tabular-nums">{number(row.compraSugerida)}</td><td className="px-2 py-2 text-right font-semibold tabular-nums">{number(row.cantidadDecidida)}</td>
                  <td className="px-2 py-2">{row.responsableDecision || "–"}</td><td className="max-w-40 px-2 py-2 whitespace-pre-wrap">{row.observacion || ""}</td><td className="px-2 py-2 tabular-nums">{row.fechaDecision || "–"}</td>
                  <td className="px-2 py-2">{row.oc || ""}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="flex justify-end border-t border-[var(--line)] bg-white px-5 py-3 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-lg bg-[var(--navy)] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[var(--blue)]">Cerrar</button>
        </footer>
      </div>
    </div>
  );
}
