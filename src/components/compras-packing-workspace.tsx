"use client";

import { useMemo, useState } from "react";
import { Download, LockKeyhole, RefreshCw } from "lucide-react";
import { filterPacking, type ComprasPacking, type PackingFilters, type PackingRegistro } from "@/lib/compras-packing";

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const EMPTY_FILTERS: PackingFilters = { texto: "", proveedor: "", estado: "" };

function number(value: number) { return integer.format(value || 0); }
function decimal(value: number, digits: number) { return Number(value || 0).toFixed(digits); }

function Estado({ value }: { value: string }) {
  const estado = value.toUpperCase();
  const tone = estado === "INGRESADO"
    ? "bg-emerald-100 text-emerald-800"
    : estado === "A INGRESAR"
      ? "bg-sky-100 text-sky-800"
      : estado === "EMBARCADO"
        ? "bg-blue-100 text-blue-800"
        : estado === "A EMBARCAR"
          ? "bg-amber-100 text-amber-800"
          : "bg-slate-100 text-slate-700";
  return <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${tone}`}>{value || "EN FÁBRICA"}</span>;
}

function exportCsv(registros: PackingRegistro[]) {
  const headers = [
    "ID PL", "PI", "NRO ENVIO", "OC PROVEEDOR", "OC INTERNA", "PROVEEDOR", "ESTADO PL", "ESTADO ITEM",
    "SKU", "DESCRIPCION", "CANTIDAD COMPRADA", "CANTIDAD PL", "DIFERENCIA", "UNIDAD", "QTY CAJA", "CAJAS",
    "RANGO CAJAS", "PESO BRUTO", "PESO NETO", "CBM CAJA", "CBM TOTAL", "OBSERVACION", "FECHA ESTADO",
    "RESPONSABLE ESTADO", "OBSERVACION ESTADO",
  ];
  const rows = registros.map((row) => [
    row.idPl, row.pi, row.nroEnvio, row.ocProveedor, row.ocInterna, row.proveedor, row.estadoPl, row.estadoItem,
    row.sku, row.descripcion, row.cantidadComprada, row.cantidadPl, row.diferencia, row.unidad, row.qtyCaja, row.cajas,
    row.rangoCajas, row.pesoBruto, row.pesoNeto, row.cbmCaja, row.cbmTotal, row.observacion, row.fechaEstado,
    row.responsableEstado, row.observacionEstado,
  ]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => {
    const content = typeof cell === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(cell) ? `'${cell}` : String(cell ?? "");
    return `"${content.replace(/"/g, '""')}"`;
  }).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "Packing_List.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ComprasPackingWorkspace({ data }: { data: ComprasPacking }) {
  const [filters, setFilters] = useState<PackingFilters>(EMPTY_FILTERS);
  const visibles = useMemo(() => filterPacking(data.registros, filters), [data.registros, filters]);
  const update = (key: keyof PackingFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  return <div className="mt-6 space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Abastecimiento · logística</p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">Packing List</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Seguimiento logístico posterior a la compra, en modo consulta.</p>
        <p className="mt-1 text-xs text-[var(--muted)]">Actualizado: <strong className="text-[var(--navy)]">{data.actualizado}</strong></p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled title="La importación escribe en Google Sheets y se habilitará en una etapa posterior" className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--soft)] px-3.5 py-2.5 text-xs font-semibold text-[var(--muted)] opacity-70 disabled:cursor-not-allowed">
          <LockKeyhole aria-hidden="true" className="size-4" />Importar Packing List
        </button>
        <button type="button" onClick={() => exportCsv(visibles)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-xs font-semibold text-[var(--navy)] hover:bg-[var(--soft)]">
          <Download aria-hidden="true" className="size-4" />Descargar visibles
        </button>
      </div>
    </div>

    <div className="rounded-[18px] border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
      Circuito: <strong>EN FÁBRICA → A EMBARCAR → EMBARCADO → A INGRESAR → INGRESADO</strong>. La importación XLSX y los cambios de estado permanecen deshabilitados porque el legacy escribe en PACKING_LIST y PACKING_LIST_DETALLE.
    </div>

    <section aria-label="Resumen de Packing List" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {([
        ["Packing List", data.resumen.packingLists],
        ["Líneas SKU", data.resumen.lineasSku],
        ["Unidades en PL", data.resumen.unidadesPl],
        ["Diferencia vs compra", data.resumen.diferencias],
      ] as const).map(([label, value]) => <div key={label} className="rounded-[20px] border border-[var(--line)] bg-white px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--navy)]">{number(value)}</p>
      </div>)}
    </section>

    <section aria-label="Filtros de Packing List" className="grid gap-3 rounded-[20px] border border-[var(--line)] bg-white p-4 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_auto] xl:items-end">
      <label className="text-[11px] font-semibold text-[var(--muted)]">PI / SKU / descripción / OC
        <input type="search" value={filters.texto} onChange={(event) => update("texto", event.target.value)} placeholder="Ej. MS260810A o KB-TOM015" className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--blue)]" />
      </label>
      <label className="text-[11px] font-semibold text-[var(--muted)]">Proveedor
        <select value={filters.proveedor} onChange={(event) => update("proveedor", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)]">
          <option value="">Todos</option>{data.proveedores.map((proveedor) => <option key={proveedor} value={proveedor}>{proveedor}</option>)}
        </select>
      </label>
      <label className="text-[11px] font-semibold text-[var(--muted)]">Estado logístico
        <select value={filters.estado} onChange={(event) => update("estado", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)]">
          <option value="">Todos</option>{data.estados.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="h-10 rounded-xl border border-[var(--line)] bg-[var(--soft)] px-4 text-xs font-semibold text-[var(--navy)] hover:bg-white">Limpiar</button>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[var(--muted)]">
      <span><strong className="text-[var(--navy)]">{number(visibles.length)}</strong> de {number(data.registros.length)} líneas visibles</span>
      <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-semibold text-[var(--navy)] hover:bg-[var(--soft)]"><RefreshCw aria-hidden="true" className="size-3.5" />Actualizar</button>
    </div>

    <section aria-label="Tabla de Packing List" className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[2200px] border-collapse text-left text-[11px]">
          <thead className="bg-[var(--navy)] text-[10px] font-bold uppercase text-white"><tr>
            <th className="px-2 py-2.5">ID PL</th><th className="px-2 py-2.5">PI</th><th className="px-2 py-2.5">OC proveedor</th><th className="px-2 py-2.5">OC interna</th><th className="px-2 py-2.5">Proveedor</th>
            <th className="px-2 py-2.5">Estado PL</th><th className="px-2 py-2.5">Estado ítem</th><th className="px-2 py-2.5">SKU</th><th className="px-2 py-2.5">Descripción</th>
            <th className="px-2 py-2.5 text-right">Cant. comprada</th><th className="px-2 py-2.5 text-right">Cant. PL</th><th className="px-2 py-2.5 text-right">Diferencia</th><th className="px-2 py-2.5">Unidad</th>
            <th className="px-2 py-2.5 text-right">Qty/caja</th><th className="px-2 py-2.5 text-right">Cajas</th><th className="px-2 py-2.5">Rango cajas</th><th className="px-2 py-2.5 text-right">Peso bruto</th><th className="px-2 py-2.5 text-right">Peso neto</th><th className="px-2 py-2.5 text-right">CBM total</th>
          </tr></thead>
          <tbody className="divide-y divide-[var(--line)]">
            {visibles.length ? visibles.map((row, index) => <tr key={`${row.idPl}-${row.sku}-${index}`} className="hover:bg-[var(--soft)]">
              <th scope="row" className="whitespace-nowrap px-2 py-2 font-semibold text-[var(--navy)]">{row.idPl}</th><td className="whitespace-nowrap px-2 py-2">{row.pi || "–"}</td><td className="whitespace-nowrap px-2 py-2">{row.ocProveedor || "–"}</td><td className="whitespace-nowrap px-2 py-2">{row.ocInterna || "–"}</td><td className="px-2 py-2">{row.proveedor || "–"}</td>
              <td className="px-2 py-2"><Estado value={row.estadoPl} /></td><td className="px-2 py-2"><Estado value={row.estadoItem} /></td><td className="px-2 py-2 font-semibold text-[var(--navy)]">{row.sku}</td><td className="max-w-80 px-2 py-2">{row.descripcion}</td>
              <td className="px-2 py-2 text-right tabular-nums">{row.cantidadComprada ? number(row.cantidadComprada) : ""}</td><td className="px-2 py-2 text-right font-semibold tabular-nums">{number(row.cantidadPl)}</td><td className={`px-2 py-2 text-right font-semibold tabular-nums ${row.diferencia < 0 ? "text-red-700" : row.diferencia > 0 ? "text-emerald-700" : ""}`}>{row.diferencia ? number(row.diferencia) : "0"}</td>
              <td className="px-2 py-2">{row.unidad || "–"}</td><td className="px-2 py-2 text-right tabular-nums">{number(row.qtyCaja)}</td><td className="px-2 py-2 text-right tabular-nums">{number(row.cajas)}</td><td className="px-2 py-2">{row.rangoCajas || "–"}</td><td className="px-2 py-2 text-right tabular-nums">{decimal(row.pesoBruto, 2)}</td><td className="px-2 py-2 text-right tabular-nums">{decimal(row.pesoNeto, 2)}</td><td className="px-2 py-2 text-right tabular-nums">{decimal(row.cbmTotal, 3)}</td>
            </tr>) : <tr><td colSpan={19} className="px-4 py-10 text-center text-[var(--muted)]">Todavía no hay líneas de Packing List que coincidan con los filtros seleccionados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
