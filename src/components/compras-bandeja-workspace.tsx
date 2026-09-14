"use client";

import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import type { ComprasBandeja } from "@/lib/compras-bandeja";

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

function number(value: number) { return integer.format(value || 0); }

function Risk({ value }: { value: string }) {
  const tone = value.toUpperCase() === "SIN STOCK" ? "bg-red-100 text-red-800" : value.toUpperCase() === "URGENTE" ? "bg-orange-100 text-orange-800" : "bg-[var(--soft)] text-[var(--ink)]";
  return <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${tone}`}>{value || "–"}</span>;
}

function exportCsv(data: ComprasBandeja) {
  const headers = ["SKU", "DESCRIPCION", "MARCA", "RIESGO", "COMPRA SUGERIDA", "CANTIDAD DECIDIDA", "RESPONSABLE", "OBSERVACION", "FECHA DECISION", "NRO COTIZACION", "PROVEEDOR", "CODIGO PROVEEDOR"];
  const rows = data.registros.map((row) => [row.sku, row.descripcion, row.marca, row.riesgo, row.compraSugerida, row.cantidadDecidida, row.responsable, row.observacion, row.fechaDecision, row.nroCotizacion, row.proveedor, row.codigoProveedor]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => {
    const content = typeof cell === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(cell) ? `'${cell}` : String(cell ?? "");
    return `"${content.replace(/"/g, '""')}"`;
  }).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "Bandeja_de_Compra.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ComprasBandejaWorkspace({ data }: { data: ComprasBandeja }) {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(() => new Set());
  const todos = data.registros.length > 0 && data.registros.every((row) => seleccionados.has(row.sku));
  const toggle = (sku: string, checked: boolean) => setSeleccionados((current) => {
    const next = new Set(current);
    if (checked) next.add(sku);
    else next.delete(sku);
    return next;
  });

  return <div className="mt-6 space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Abastecimiento · aprobados</p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">Bandeja de Compra</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">SKU aprobados pendientes de enviar a compra.</p>
      </div>
      <button type="button" onClick={() => exportCsv(data)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-xs font-semibold text-[var(--navy)] hover:bg-[var(--soft)]"><Download aria-hidden="true" className="size-4" />Descargar registros</button>
    </div>

    <section aria-label="Resumen de la bandeja" className="grid gap-3 sm:grid-cols-3">
      {([ ["SKU aprobados", data.resumen.sku], ["Unidades aprobadas", data.resumen.unidades], ["Marcas", data.resumen.marcas] ] as const).map(([label, value]) =>
        <div key={label} className="rounded-[20px] border border-[var(--line)] bg-white px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--navy)]">{number(value)}</p></div>
      )}
    </section>

    <section aria-label="SKU aprobados pendientes" className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-emerald-50/50 px-4 py-3 text-xs">
        <label className="flex items-center gap-2 text-[var(--navy)]"><input type="checkbox" checked={todos} onChange={(event) => setSeleccionados(event.target.checked ? new Set(data.registros.map((row) => row.sku)) : new Set())} />Seleccionar todos</label>
        <strong className="text-[var(--navy)]">{number(seleccionados.size)} {seleccionados.size === 1 ? "seleccionado" : "seleccionados"}</strong>
        <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-semibold text-[var(--navy)]"><RefreshCw aria-hidden="true" className="size-3" />Actualizar</button>
        <button type="button" disabled title="Enviar a Compra requiere escritura en Google Sheets" className="rounded-lg bg-emerald-700 px-3 py-2 font-semibold text-white opacity-55 disabled:cursor-not-allowed">Enviar a Compra</button>
        <span className="text-[11px] text-[var(--muted)]">Solo consulta; la selección no modifica datos.</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left text-[11px]">
          <thead className="bg-[var(--navy)] text-[10px] font-bold uppercase text-white"><tr>
            <th scope="col" className="px-2 py-2.5">✓</th><th scope="col" className="px-2 py-2.5">SKU</th><th scope="col" className="px-2 py-2.5">Descripción</th><th scope="col" className="px-2 py-2.5">Marca</th><th scope="col" className="px-2 py-2.5">Riesgo</th><th scope="col" className="px-2 py-2.5 text-right">Compra sugerida</th><th scope="col" className="px-2 py-2.5 text-right">Cantidad decidida</th><th scope="col" className="px-2 py-2.5">Responsable</th><th scope="col" className="px-2 py-2.5">Observación</th><th scope="col" className="px-2 py-2.5">Fecha decisión</th>
          </tr></thead>
          <tbody className="divide-y divide-[var(--line)]">
            {data.registros.length ? data.registros.map((row) => <tr key={row.sku} className={seleccionados.has(row.sku) ? "bg-blue-50/60" : "hover:bg-[var(--soft)]"}>
              <td className="px-2 py-2"><input type="checkbox" aria-label={`Seleccionar ${row.sku}`} checked={seleccionados.has(row.sku)} onChange={(event) => toggle(row.sku, event.target.checked)} /></td>
              <th scope="row" className="px-2 py-2 font-semibold text-[var(--navy)]">{row.sku}</th>
              <td className="px-2 py-2">{row.descripcion}</td><td className="px-2 py-2">{row.marca}</td><td className="px-2 py-2"><Risk value={row.riesgo} /></td>
              <td className="px-2 py-2 text-right tabular-nums">{number(row.compraSugerida)}</td><td className="px-2 py-2 text-right tabular-nums">{number(row.cantidadDecidida)}</td>
              <td className="px-2 py-2">{row.responsable}</td><td className="px-2 py-2" title={row.nroCotizacion ? `Cotización ${row.nroCotizacion} · Proveedor: ${row.proveedor} · Código: ${row.codigoProveedor || "–"}` : undefined}>{row.observacion}</td><td className="whitespace-nowrap px-2 py-2 tabular-nums">{row.fechaDecision}</td>
            </tr>) : <tr><td colSpan={10} className="px-4 py-8 text-center text-[var(--muted)]">No hay SKU aprobados pendientes de enviar a compra.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
