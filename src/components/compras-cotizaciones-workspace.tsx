"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";
import {
  rankingPrecio, type ComprasCotizaciones, type CotizacionLote, type CotizacionOferta,
} from "@/lib/compras-cotizaciones";

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const amount = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const totalAmount = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function number(value: number) { return integer.format(value || 0); }

function Risk({ value }: { value: string }) {
  const tone = value.toUpperCase() === "SIN STOCK" ? "bg-red-100 text-red-800" : value.toUpperCase() === "URGENTE" ? "bg-orange-100 text-orange-800" : "bg-[var(--soft)] text-[var(--ink)]";
  return <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${tone}`}>{value || "–"}</span>;
}

function Oferta({ lote, oferta, cerrada }: { lote: CotizacionLote; oferta: CotizacionOferta; cerrada: boolean }) {
  const elegida = lote.proveedorSeleccionado.toUpperCase() === oferta.proveedor.toUpperCase();
  return (
    <section className={`rounded-2xl border p-4 ${elegida ? "border-emerald-300 bg-emerald-50/40" : "border-[var(--line)] bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-[var(--navy)]">{oferta.proveedor || "Sin proveedor"}</h4>
          {elegida && <p className="mt-1 text-[10px] font-bold uppercase text-emerald-700">Oferta seleccionada</p>}
        </div>
        <div className="flex items-center gap-3 text-sm text-[var(--navy)]">
          <span>{oferta.moneda || "–"}</span>
          <strong className="tabular-nums">{oferta.moneda} {totalAmount.format(oferta.total)}</strong>
          {!cerrada && <button type="button" disabled title="Aprobar oferta requiere escritura en Google Sheets" className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white opacity-55 disabled:cursor-not-allowed">Aprobar oferta</button>}
        </div>
      </div>
      {oferta.observacion && <p className="mt-2 text-xs text-[var(--muted)]">Observación: {oferta.observacion}</p>}
      <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--line)]">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs">
          <thead className="bg-[var(--soft)] text-[10px] font-bold uppercase text-[var(--muted)]"><tr>
            <th className="px-3 py-2">SKU</th><th className="px-3 py-2">Código proveedor</th><th className="px-3 py-2 text-right">Precio unitario</th><th className="px-3 py-2">Estado</th>
          </tr></thead>
          <tbody className="divide-y divide-[var(--line)]">
            {oferta.items.map((item, index) => {
              const rank = rankingPrecio(lote, oferta, item.sku);
              const tone = rank === "MEJOR PRECIO" ? "bg-emerald-100 text-emerald-800" : rank === "2° PRECIO" ? "bg-amber-100 text-amber-800" : "bg-[var(--soft)] text-[var(--muted)]";
              return <tr key={`${item.sku}-${index}`}>
                <th scope="row" className="px-3 py-2 font-medium text-[var(--navy)]">{item.sku}</th>
                <td className="px-3 py-2">{item.codigoProveedor || item.sku}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${rank === "MEJOR PRECIO" ? "bg-emerald-50" : rank === "2° PRECIO" ? "bg-amber-50" : ""}`}>{oferta.moneda} {amount.format(item.precio)}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{rank}</span></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CotizacionCard({ lote }: { lote: CotizacionLote }) {
  const [showOtherOffers, setShowOtherOffers] = useState(false);
  const cerrada = lote.estado.toUpperCase() !== "ABIERTA";
  const ofertasVisibles = cerrada && lote.proveedorSeleccionado && !showOtherOffers
    ? lote.ofertas.filter((oferta) => oferta.proveedor.toUpperCase() === lote.proveedorSeleccionado.toUpperCase())
    : lote.ofertas;
  return (
    <article className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-white">
      <div className="grid gap-2 border-b border-[var(--line)] bg-[var(--canvas)] px-4 py-4 text-xs sm:grid-cols-2 lg:grid-cols-5 lg:items-center">
        <strong className="text-sm text-[var(--navy)]">{lote.nroCotizacion}</strong>
        <span className="tabular-nums text-[var(--muted)]">{lote.fecha || "Sin fecha"}</span>
        <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ${cerrada ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>{lote.estado || "–"}</span>
        <span className="font-medium text-[var(--navy)]">{number(lote.items.length)} SKU</span>
        <span className="text-[var(--muted)]">{lote.proveedorSeleccionado ? <>Proveedor: <strong className="text-[var(--navy)]">{lote.proveedorSeleccionado}</strong></> : "Proveedor pendiente"}</span>
      </div>
      <div className="space-y-4 p-4">
        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="w-full min-w-[840px] border-collapse text-left text-xs">
            <thead className="bg-[var(--soft)] text-[10px] font-bold uppercase text-[var(--muted)]"><tr>
              <th className="px-3 py-2.5">SKU</th><th className="px-3 py-2.5">Marca</th><th className="px-3 py-2.5">Código proveedor</th><th className="px-3 py-2.5">Descripción</th><th className="px-3 py-2.5 text-right">Cantidad</th><th className="px-3 py-2.5">Precio</th>
            </tr></thead>
            <tbody className="divide-y divide-[var(--line)]">
              {lote.items.map((item, index) => <tr key={`${item.sku}-${index}`}>
                <th scope="row" className="px-3 py-2.5 font-semibold text-[var(--navy)]">{item.sku}</th>
                <td className="px-3 py-2.5">{item.marca}</td>
                <td className="px-3 py-2.5">{!cerrada && <input type="text" defaultValue={item.sku} aria-label={`Código proveedor para ${item.sku}`} className="h-8 w-full min-w-32 rounded-lg border border-[var(--line)] px-2 text-xs" />}</td>
                <td className="px-3 py-2.5">{item.descripcion}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{number(item.cantidad)}</td>
                <td className="px-3 py-2.5">{!cerrada && <input type="number" min="0" step="0.0001" placeholder="0,00" aria-label={`Precio para ${item.sku}`} className="h-8 w-28 rounded-lg border border-[var(--line)] px-2 text-right text-xs" />}</td>
              </tr>)}
            </tbody>
          </table>
        </div>

        {!cerrada && <div className="grid gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
          <label className="text-[11px] font-semibold text-[var(--muted)]">Proveedor<input type="text" placeholder="Proveedor" className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-normal" /></label>
          <label className="text-[11px] font-semibold text-[var(--muted)]">Moneda<select defaultValue="USD" className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-normal"><option>USD</option><option>EUR</option><option>CNY</option><option>ARS</option></select></label>
          <label className="text-[11px] font-semibold text-[var(--muted)]">Observación<input type="text" placeholder="Opcional" className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-normal" /></label>
          <button type="button" disabled title="Guardar oferta requiere escritura en Google Sheets" className="h-9 rounded-lg bg-[var(--blue)] px-3 text-xs font-semibold text-white opacity-55 disabled:cursor-not-allowed">Guardar oferta</button>
        </div>}

        {ofertasVisibles.length > 0 && <div className="space-y-2">{ofertasVisibles.map((oferta, index) => <Oferta key={`${oferta.proveedor}-${index}`} lote={lote} oferta={oferta} cerrada={cerrada} />)}</div>}
        {cerrada && lote.ofertas.length > 1 && <button type="button" onClick={() => setShowOtherOffers((current) => !current)} className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--blue)]">{showOtherOffers ? "Ocultar otras ofertas" : `Ver otras ofertas (${lote.ofertas.length - 1})`}</button>}
      </div>
    </article>
  );
}

export function ComprasCotizacionesWorkspace({ data }: { data: ComprasCotizaciones }) {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(() => new Set());
  const todos = data.pendientes.length > 0 && data.pendientes.every((row) => seleccionados.has(row.sku));
  const toggle = (sku: string, checked: boolean) => setSeleccionados((current) => {
    const next = new Set(current);
    if (checked) next.add(sku);
    else next.delete(sku);
    return next;
  });
  return (
    <div className="mt-6 space-y-6">
      <section>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Abastecimiento · cotizaciones</p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">Bandeja de Cotización</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Sólo productos importados con estado COTIZAR.</p>
      </section>

      <section aria-label="Resumen de pendientes" className="grid gap-3 sm:grid-cols-3">
        {([["SKU pendientes", data.resumen.sku], ["Unidades", data.resumen.unidades], ["Marcas", data.resumen.marcas]] as const).map(([label, value]) => <div key={label} className="rounded-[20px] border border-[var(--line)] bg-white px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--navy)]">{number(value)}</p></div>)}
      </section>

      <section aria-label="Pendientes de cotización" className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-4 py-3 text-xs">
          <label className="flex items-center gap-2 text-[var(--navy)]"><input type="checkbox" checked={todos} onChange={(event) => setSeleccionados(event.target.checked ? new Set(data.pendientes.map((row) => row.sku)) : new Set())} />Seleccionar todos</label>
          <strong className="text-[var(--navy)]">{number(seleccionados.size)} {seleccionados.size === 1 ? "seleccionado" : "seleccionados"}</strong>
          <button type="button" onClick={() => window.location.reload()} className="flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-2 font-semibold text-[var(--navy)]"><RotateCw aria-hidden="true" className="size-3" />Actualizar</button>
          <button type="button" disabled title="Crear cotización requiere escritura en Google Sheets" className="rounded-lg bg-[var(--blue)] px-3 py-2 font-semibold text-white opacity-55 disabled:cursor-not-allowed">Crear cotización</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-xs">
            <thead className="bg-[var(--navy)] text-[10px] font-bold uppercase text-white"><tr><th className="px-3 py-2.5">✓</th><th className="px-3 py-2.5">SKU</th><th className="px-3 py-2.5">Descripción</th><th className="px-3 py-2.5">Marca</th><th className="px-3 py-2.5">Riesgo</th><th className="px-3 py-2.5 text-right">Compra sugerida</th><th className="px-3 py-2.5 text-right">Cantidad</th><th className="px-3 py-2.5">Responsable</th><th className="px-3 py-2.5">Observación</th></tr></thead>
            <tbody className="divide-y divide-[var(--line)]">
              {data.pendientes.length ? data.pendientes.map((row) => <tr key={row.sku} className={seleccionados.has(row.sku) ? "bg-blue-50/50" : ""}>
                <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Seleccionar ${row.sku}`} checked={seleccionados.has(row.sku)} onChange={(event) => toggle(row.sku, event.target.checked)} /></td>
                <th scope="row" className="px-3 py-2.5 font-semibold text-[var(--navy)]">{row.sku}</th><td className="px-3 py-2.5">{row.descripcion}</td><td className="px-3 py-2.5">{row.marca}</td><td className="px-3 py-2.5"><Risk value={row.riesgo} /></td><td className="px-3 py-2.5 text-right tabular-nums">{number(row.compraSugerida)}</td><td className="px-3 py-2.5 text-right tabular-nums">{number(row.cantidadDecidida)}</td><td className="px-3 py-2.5">{row.responsable || "–"}</td><td className="px-3 py-2.5">{row.observacion || "–"}</td>
              </tr>) : <tr><td colSpan={9} className="px-4 py-8 text-center text-[var(--muted)]">No hay productos importados pendientes de cotización.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="cot-import-title">
        <h3 id="cot-import-title" className="mb-3 text-base font-semibold text-[var(--navy)]">Importación masiva de ofertas</h3>
        <div className="rounded-[22px] border border-blue-200 bg-blue-50/60 p-4">
          <h4 className="text-sm font-semibold text-[var(--navy)]">Cargar cotizaciones de un proveedor desde Excel</h4>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_2fr_2fr_auto_auto] xl:items-end">
            <label className="text-[10px] font-bold uppercase text-[var(--muted)]">Proveedor<input type="text" placeholder="Ej. PROVE1" className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case" /></label>
            <label className="text-[10px] font-bold uppercase text-[var(--muted)]">Moneda<select defaultValue="USD" className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-normal"><option>USD</option><option>EUR</option><option>CNY</option><option>ARS</option></select></label>
            <label className="text-[10px] font-bold uppercase text-[var(--muted)]">Observación general<input type="text" placeholder="Opcional" className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case" /></label>
            <label className="text-[10px] font-bold uppercase text-[var(--muted)]">Archivo XLSX<input type="file" accept=".xlsx,.xls" className="mt-1 block h-9 w-full rounded-lg border border-[var(--line)] bg-white text-xs font-normal normal-case file:mr-2 file:h-full file:border-0 file:bg-[var(--soft)] file:px-2" /></label>
            <button type="button" disabled title="La plantilla XLSX se habilitará junto con la importación" className="h-9 rounded-lg bg-slate-600 px-3 text-xs font-semibold text-white opacity-55 disabled:cursor-not-allowed">↓ Plantilla</button>
            <button type="button" disabled title="Importar ofertas requiere escritura en Google Sheets" className="h-9 rounded-lg bg-[var(--blue)] px-3 text-xs font-semibold text-white opacity-55 disabled:cursor-not-allowed">Importar ofertas</button>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-[var(--muted)]">La plantilla del legacy incluye todas las cotizaciones ABIERTAS y sus SKU. La importación y el guardado todavía no están habilitados; seleccionar un archivo no modifica datos.</p>
        </div>
      </section>

      <section aria-labelledby="cot-creadas-title" className="space-y-3">
        <h3 id="cot-creadas-title" className="text-base font-semibold text-[var(--navy)]">Cotizaciones creadas</h3>
        {data.cotizaciones.length ? data.cotizaciones.map((lote) => <CotizacionCard key={lote.nroCotizacion} lote={lote} />) : <p className="rounded-[20px] border border-[var(--line)] bg-white px-5 py-8 text-sm text-[var(--muted)]">Todavía no hay cotizaciones creadas.</p>}
      </section>
    </div>
  );
}
