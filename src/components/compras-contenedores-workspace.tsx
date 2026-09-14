"use client";

import { useMemo, useState } from "react";
import { Download, Link2, LockKeyhole, RefreshCw } from "lucide-react";
import {
  filterContenedores,
  type ComprasContenedores,
  type ContenedoresFilters,
  type ContenedorRegistro,
} from "@/lib/compras-contenedores";

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const EMPTY_FILTERS: ContenedoresFilters = { texto: "", proveedor: "", estado: "" };

function number(value: number) { return integer.format(value || 0); }
function decimal(value: number, digits: number) { return Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits: digits, maximumFractionDigits: digits }); }

function Estado({ value }: { value: string }) {
  const estado = value.toUpperCase();
  const tone = estado === "INGRESADO"
    ? "bg-emerald-100 text-emerald-800"
    : estado === "A INGRESAR"
      ? "bg-sky-100 text-sky-800"
      : estado === "EMBARCADO"
        ? "bg-blue-100 text-blue-800"
        : "bg-slate-100 text-slate-700";
  return <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${tone}`}>{value || "SIN ESTADO"}</span>;
}

function exportCsv(registros: ContenedorRegistro[]) {
  const headers = ["CONTENEDOR", "ESTADO", "FECHA EMBARQUE", "ETA", "PACKING LIST", "PI", "PROVEEDOR", "UNIDADES", "CAJAS", "CBM", "OBSERVACIONES"];
  const rows = registros.map((row) => [
    row.numero, row.estado, row.fechaEmbarque, row.eta, row.idPl, row.pi, row.proveedor,
    row.unidades, row.cajas, row.cbm, row.observacion,
  ]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => {
    const content = typeof cell === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(cell) ? `'${cell}` : String(cell ?? "");
    return `"${content.replace(/"/g, '""')}"`;
  }).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "Contenedores.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ComprasContenedoresWorkspace({ data }: { data: ComprasContenedores }) {
  const [filters, setFilters] = useState<ContenedoresFilters>(EMPTY_FILTERS);
  const visibles = useMemo(() => filterContenedores(data.registros, filters), [data.registros, filters]);
  const update = (key: keyof ContenedoresFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  return <div className="mt-6 space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Abastecimiento · logística</p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">Contenedores</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Trazabilidad Packing List → Contenedor, en modo consulta.</p>
        <p className="mt-1 text-xs text-[var(--muted)]">Actualizado: <strong className="text-[var(--navy)]">{data.actualizado}</strong></p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled title="Guardar contenedores escribe en Google Sheets y se habilitará en una etapa posterior" className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--soft)] px-3.5 py-2.5 text-xs font-semibold text-[var(--muted)] opacity-70 disabled:cursor-not-allowed">
          <LockKeyhole aria-hidden="true" className="size-4" />Nuevo / editar contenedor
        </button>
        <button type="button" disabled title="Asociar Packing List escribe en Google Sheets y se habilitará en una etapa posterior" className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--soft)] px-3.5 py-2.5 text-xs font-semibold text-[var(--muted)] opacity-70 disabled:cursor-not-allowed">
          <Link2 aria-hidden="true" className="size-4" />Asociar Packing List
        </button>
        <button type="button" onClick={() => exportCsv(visibles)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-xs font-semibold text-[var(--navy)] hover:bg-[var(--soft)]">
          <Download aria-hidden="true" className="size-4" />Descargar visibles
        </button>
      </div>
    </div>

    <div className="rounded-[18px] border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
      Cada contenedor puede agrupar uno o varios Packing List. La asociación conserva la trazabilidad <strong>PI → Packing List → Contenedor</strong>. Crear o editar contenedores y asociar PL permanece deshabilitado porque esas acciones escriben en Google Sheets.
    </div>

    <section aria-label="Resumen de Contenedores" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {([
        ["Contenedores", data.resumen.contenedores, false],
        ["Packing List asociados", data.resumen.packingLists, false],
        ["Cajas", data.resumen.cajas, false],
        ["CBM", data.resumen.cbm, true],
        ["PL sin asociar", data.resumen.packingDisponibles, false],
      ] as const).map(([label, value, isDecimal]) => <div key={label} className="rounded-[20px] border border-[var(--line)] bg-white px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--navy)]">{isDecimal ? decimal(value, 3) : number(value)}</p>
      </div>)}
    </section>

    <section aria-label="Filtros de Contenedores" className="grid gap-3 rounded-[20px] border border-[var(--line)] bg-white p-4 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_auto] xl:items-end">
      <label className="text-[11px] font-semibold text-[var(--muted)]">Contenedor / PL / PI / observación
        <input type="search" value={filters.texto} onChange={(event) => update("texto", event.target.value)} placeholder="Ej. MSKU1234567 o PL-..." className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--blue)]" />
      </label>
      <label className="text-[11px] font-semibold text-[var(--muted)]">Proveedor
        <select value={filters.proveedor} onChange={(event) => update("proveedor", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)]">
          <option value="">Todos</option>{data.proveedores.map((proveedor) => <option key={proveedor} value={proveedor}>{proveedor}</option>)}
        </select>
      </label>
      <label className="text-[11px] font-semibold text-[var(--muted)]">Estado
        <select value={filters.estado} onChange={(event) => update("estado", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)]">
          <option value="">Todos</option>{data.estados.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="h-10 rounded-xl border border-[var(--line)] bg-[var(--soft)] px-4 text-xs font-semibold text-[var(--navy)] hover:bg-white">Limpiar</button>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[var(--muted)]">
      <span><strong className="text-[var(--navy)]">{number(visibles.length)}</strong> de {number(data.registros.length)} filas visibles</span>
      <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-semibold text-[var(--navy)] hover:bg-[var(--soft)]"><RefreshCw aria-hidden="true" className="size-3.5" />Actualizar</button>
    </div>

    <section aria-label="Tabla de Contenedores" className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1450px] border-collapse text-left text-[11px]">
          <thead className="bg-[var(--navy)] text-[10px] font-bold uppercase text-white"><tr>
            <th className="px-3 py-2.5">Contenedor</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5">Fecha embarque</th><th className="px-3 py-2.5">ETA</th>
            <th className="px-3 py-2.5">Packing List</th><th className="px-3 py-2.5">PI</th><th className="px-3 py-2.5">Proveedor</th>
            <th className="px-3 py-2.5 text-right">Unidades</th><th className="px-3 py-2.5 text-right">Cajas</th><th className="px-3 py-2.5 text-right">CBM</th><th className="px-3 py-2.5">Observaciones</th>
          </tr></thead>
          <tbody className="divide-y divide-[var(--line)]">
            {visibles.length ? visibles.map((row, index) => <tr key={`${row.numero}-${row.idPl}-${index}`} className="hover:bg-[var(--soft)]">
              <th scope="row" className="whitespace-nowrap px-3 py-2.5 font-semibold text-[var(--navy)]">{row.numero}</th>
              <td className="px-3 py-2.5"><Estado value={row.estado} /></td>
              <td className="whitespace-nowrap px-3 py-2.5">{row.fechaEmbarque || "–"}</td><td className="whitespace-nowrap px-3 py-2.5">{row.eta || "–"}</td>
              <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-[var(--navy)]">{row.idPl || "–"}</td><td className="whitespace-nowrap px-3 py-2.5">{row.pi || "–"}</td><td className="px-3 py-2.5">{row.proveedor || "–"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{row.unidades ? number(row.unidades) : "0"}</td><td className="px-3 py-2.5 text-right tabular-nums">{row.cajas ? number(row.cajas) : "0"}</td><td className="px-3 py-2.5 text-right tabular-nums">{decimal(row.cbm, 3)}</td><td className="max-w-80 px-3 py-2.5">{row.observacion || "–"}</td>
            </tr>) : <tr><td colSpan={11} className="px-4 py-10 text-center text-[var(--muted)]">Todavía no hay contenedores que coincidan con los filtros seleccionados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
