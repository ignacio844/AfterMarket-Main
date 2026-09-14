"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import {
  filterSeguimiento,
  SEGUIMIENTO_ESTADOS,
  type ComprasSeguimiento,
  type SeguimientoFilters,
  type SeguimientoRegistro,
} from "@/lib/compras-seguimiento";

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const EMPTY_FILTERS: SeguimientoFilters = { texto: "", proveedor: "", estado: "" };

function number(value: number) {
  return integer.format(value || 0);
}

function Kpi({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={`rounded-[20px] border bg-white px-5 py-4 ${danger && value > 0 ? "border-red-200" : "border-[var(--line)]"}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${danger && value > 0 ? "text-red-700" : "text-[var(--navy)]"}`}>{number(value)}</p>
    </div>
  );
}

function Card({ item, onOpen }: { item: SeguimientoRegistro; onOpen: (item: SeguimientoRegistro) => void }) {
  const hasDays = item.diasEstado !== null && item.diasEstado !== undefined;
  const title = item.numero
    ? item.numero
    : item.idPl
      ? `PL ${item.idPl.split(",")[0]?.trim()}`
      : `ORDEN ${item.pi.split(",")[0]?.trim() || "-"}`;
  const orderPreview = item.pi.split(",").map((value) => value.trim()).filter(Boolean);
  const providerPreview = item.proveedor.split(" / ").map((value) => value.trim()).filter(Boolean);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`w-full rounded-xl border border-[var(--line)] border-l-4 bg-white p-3 text-left shadow-[0_2px_8px_-6px_rgba(14,40,65,0.5)] transition hover:-translate-y-0.5 hover:shadow-md ${item.demora ? "border-l-red-600" : "border-l-emerald-600"}`}
      title="Abrir detalle"
    >
      <span className="inline-flex rounded-full bg-[#e8eef5] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#36536f]">
        {item.numero ? "CONTENEDOR" : "ORDEN / PL"}
      </span>
      <p className="mt-1.5 text-sm font-bold text-[var(--navy)]">{title}</p>

      {item.numero ? (
        <>
          <p className="mt-1 text-[11px] leading-4 text-[var(--ink)]"><strong>Órdenes:</strong> {number(item.cantidadOrdenes)} · <strong>PL:</strong> {number(item.cantidadPackingLists)}</p>
          {item.cantidadProveedores > 0 && <p className="text-[11px] leading-4 text-[var(--ink)]"><strong>Proveedores:</strong> {number(item.cantidadProveedores)}</p>}
        </>
      ) : (
        <>
          {item.pi && <p className="mt-1 text-[11px] leading-4 text-[var(--ink)]"><strong>Orden/PI:</strong> {orderPreview.slice(0, 2).join(", ")}{orderPreview.length > 2 ? ` +${orderPreview.length - 2}` : ""}</p>}
          {item.proveedor && <p className="text-[11px] leading-4 text-[var(--ink)]"><strong>Proveedor:</strong> {providerPreview[0] || "-"}{providerPreview.length > 1 ? ` +${providerPreview.length - 1}` : ""}</p>}
        </>
      )}

      {item.eta && <p className="mt-1 text-[11px] leading-4 text-[var(--ink)]"><strong>ETA:</strong> {item.eta}</p>}
      {item.unidades > 0 && <span className="mt-2 inline-flex rounded-full bg-[var(--soft)] px-2 py-0.5 text-[10px] text-[var(--muted)]">{number(item.unidades)} un.</span>}
      <p className={`mt-1.5 text-[11px] font-bold ${item.demora ? "text-red-700" : "text-[var(--ink)]"}`}>
        {hasDays ? `${item.diasEstado} día${item.diasEstado === 1 ? "" : "s"} en estado` : "Días en estado: —"}{item.demora ? " · DEMORADO" : ""}
      </p>
    </button>
  );
}

function DetailModal({ item, onClose }: { item: SeguimientoRegistro | null; onClose: () => void }) {
  if (!item) return null;
  const currentIndex = SEGUIMIENTO_ESTADOS.indexOf(item.estado);
  const title = item.numero ? `Contenedor ${item.numero}` : item.idPl ? `Packing List ${item.idPl}` : `Orden ${item.pi}`;
  const details = [
    ["Estado (ORDENES.STATUS)", item.estado || "-"],
    ["Situación (ORDENES.SITUACION)", item.situacion || "-"],
    ["Proveedor", item.proveedor || "-"],
    ["Orden/PI", item.pi || "-"],
    ["Packing List", item.idPl || "-"],
    ["Contenedor", item.numero || "Todavía sin asignar"],
    ["Fecha de estado", item.fechaEstado || "—"],
    ["Origen fecha estado", item.fechaEstadoFuente || "Sin historial confiable"],
    ["Fecha embarque", item.fechaEmbarque || "-"],
    ["ETA", item.eta || "-"],
    ["Fecha arribo", item.fechaArribo || "-"],
    ["Fecha ingreso", item.fechaIngreso || "-"],
    ["Unidades", number(item.unidades)],
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[24px] border border-[var(--line)] bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 bg-[var(--navy)] px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55">Detalle de seguimiento</p>
            <h3 className="mt-1 text-lg font-semibold">{title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-9 place-items-center rounded-xl border border-white/15 text-white/75 hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
        </header>

        <div className="max-h-[calc(90vh-72px)] overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-2">
            {SEGUIMIENTO_ESTADOS.map((estado, index) => (
              <div key={estado} className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${index <= currentIndex ? "bg-[var(--navy)] text-white" : "bg-[var(--soft)] text-[var(--muted)]"}`}>{estado}</span>
                {index < SEGUIMIENTO_ESTADOS.length - 1 && <span className="text-[var(--muted)]">→</span>}
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {details.map(([label, value]) => (
              <div key={label} className="min-h-16 rounded-xl border border-[var(--line)] bg-[var(--soft)] px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
                <p className="mt-1 break-words text-xs font-medium text-[var(--navy)]">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
            <strong>Fuente de verdad:</strong> hoja ORDENES (STATUS + SITUACION). Los días en estado sólo se muestran cuando existe una fecha confiable en HISTORIAL_ESTADOS_LOGISTICA; si no, se muestra —.
          </div>

          <h4 className="mt-5 text-sm font-semibold text-[var(--navy)]">Mercadería</h4>
          {item.items.length ? (
            <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--line)]">
              <table className="w-full min-w-[760px] border-collapse text-left text-[11px]">
                <thead className="bg-[var(--navy)] text-[10px] font-bold uppercase text-white">
                  <tr><th className="px-3 py-2.5">OC proveedor</th><th className="px-3 py-2.5">SKU</th><th className="px-3 py-2.5">Descripción</th><th className="px-3 py-2.5 text-right">Cant. PL</th><th className="px-3 py-2.5 text-right">Cajas</th><th className="px-3 py-2.5">Estado</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {item.items.map((detail, index) => <tr key={`${detail.sku}-${detail.ocProveedor}-${index}`}>
                    <td className="px-3 py-2.5">{detail.ocProveedor || "–"}</td><td className="px-3 py-2.5 font-semibold text-[var(--navy)]">{detail.sku || "–"}</td><td className="px-3 py-2.5">{detail.descripcion || "–"}</td><td className="px-3 py-2.5 text-right tabular-nums">{number(detail.cantidadPl)}</td><td className="px-3 py-2.5 text-right tabular-nums">{number(detail.cajas)}</td><td className="px-3 py-2.5">{detail.estado}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          ) : <div className="mt-2 rounded-xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-xs text-[var(--muted)]">Sin detalle de mercadería asociado.</div>}
        </div>
      </section>
    </div>
  );
}

export function ComprasSeguimientoWorkspace({ data }: { data: ComprasSeguimiento }) {
  const [filters, setFilters] = useState<SeguimientoFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<SeguimientoRegistro | null>(null);
  const visibles = useMemo(() => filterSeguimiento(data.registros, filters), [data.registros, filters]);
  const porEstado = useMemo(() => {
    const map = new Map<string, SeguimientoRegistro[]>();
    for (const estado of SEGUIMIENTO_ESTADOS) map.set(estado, []);
    for (const registro of visibles) map.get(registro.estado)?.push(registro);
    return map;
  }, [visibles]);
  const update = (key: keyof SeguimientoFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Abastecimiento · logística</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">Seguimiento de Contenedores</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Vista gráfica del circuito logístico desde ORDENES, respetando STATUS + SITUACION.</p>
        </div>
        <p className="text-xs text-[var(--muted)]">Actualizado: <strong className="text-[var(--navy)]">{data.actualizado}</strong></p>
      </div>

      <section aria-label="Resumen del seguimiento" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="En seguimiento" value={data.resumen.enSeguimiento} />
        <Kpi label="En fábrica" value={data.resumen.enFabrica} />
        <Kpi label="A embarcar" value={data.resumen.aEmbarcar} />
        <Kpi label="Embarcado" value={data.resumen.embarcado} />
        <Kpi label="A ingresar" value={data.resumen.aIngresar} />
        <Kpi label="Demorados" value={data.resumen.demorados} danger />
      </section>

      <section aria-label="Filtros de seguimiento" className="grid gap-3 rounded-[20px] border border-[var(--line)] bg-white p-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_auto] xl:items-end">
        <label className="text-[11px] font-semibold text-[var(--muted)]">Buscar
          <input type="search" value={filters.texto} onChange={(event) => update("texto", event.target.value)} placeholder="Contenedor, PI, Packing List, OC o proveedor" className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--blue)]" />
        </label>
        <label className="text-[11px] font-semibold text-[var(--muted)]">Proveedor
          <select value={filters.proveedor} onChange={(event) => update("proveedor", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)]">
            <option value="">Todos</option>{data.proveedores.map((proveedor) => <option key={proveedor} value={proveedor}>{proveedor}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-[var(--muted)]">Estado
          <select value={filters.estado} onChange={(event) => update("estado", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)]">
            <option value="">Todos</option>{SEGUIMIENTO_ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="h-10 rounded-xl border border-[var(--line)] bg-[var(--soft)] px-4 text-xs font-semibold text-[var(--navy)] hover:bg-white">Limpiar</button>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[var(--muted)]">
        <span><strong className="text-[var(--navy)]">{number(visibles.length)}</strong> registros visibles</span>
        <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-semibold text-[var(--navy)] hover:bg-[var(--soft)]"><RefreshCw aria-hidden="true" className="size-3.5" />Actualizar</button>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1400px] grid-cols-5 gap-3 items-start">
          {SEGUIMIENTO_ESTADOS.map((estado) => {
            const registros = porEstado.get(estado) ?? [];
            return (
              <section key={estado} className="min-h-[420px] overflow-hidden rounded-[18px] border border-[var(--line)] bg-[#eef2f5]">
                <header className="flex items-center justify-between bg-[var(--navy)] px-4 py-3 text-xs font-bold text-white">
                  <span>{estado}</span><span>{number(registros.length)}</span>
                </header>
                <div className="space-y-2.5 p-2.5">
                  {registros.length ? registros.map((item, index) => <Card key={`${item.tipo}-${item.numero || item.idPl || item.pi}-${index}`} item={item} onOpen={setSelected} />) : <p className="px-2 py-8 text-center text-xs text-[var(--muted)]">Sin registros</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {data.errores.length > 0 && (
        <section className="rounded-[18px] border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-800"><AlertTriangle className="size-4" /><h3 className="text-xs font-bold uppercase tracking-[0.08em]">Errores de consistencia en ORDENES ({number(data.errores.length)})</h3></div>
          <div className="mt-3 divide-y divide-red-200/70">
            {data.errores.map((error, index) => <div key={`${error.fila}-${index}`} className="py-2 text-xs leading-5 text-red-900"><strong>{error.orden || "Sin orden"}</strong> · STATUS: {error.status || "-"} · SITUACION: {error.situacion || "-"}<br /><span>{error.motivo}</span></div>)}
          </div>
        </section>
      )}

      <DetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
    