"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowLeftRight, ArrowUp, Download, RefreshCw } from "lucide-react";
import {
  filterTransferencias,
  TRANSFER_DIRECTIONS,
  type ComprasTransferencias,
  type TransferenciaRegistro,
  type TransferenciasFilters,
  type TransferenciasSortKey,
} from "@/lib/compras-transferencias";

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const EMPTY_FILTERS: TransferenciasFilters = { texto: "", direccion: "", marca: "" };

type SortDirection = "asc" | "desc";
type SortState = { key: TransferenciasSortKey; direction: SortDirection };

function number(value: number) {
  return integer.format(Math.round(value || 0));
}

function percent(value: number) {
  return `${((value || 0) * 100).toFixed(1)}%`;
}

function exportCsv(registros: TransferenciaRegistro[]) {
  const headers = [
    "SKU",
    "DESCRIPCION",
    "MARCA",
    "STOCK_WARNES",
    "STOCK_ESCOBAR",
    "STOCK_TOTAL",
    "PORC_WARNES",
    "PORC_ESCOBAR",
    "DIRECCION",
    "CANTIDAD_TRANSFERIR",
    "WARNES_FINAL",
    "ESCOBAR_FINAL",
    "PORC_WARNES_FINAL",
    "PORC_ESCOBAR_FINAL",
    "APROXIMADO",
  ];

  const rows = registros.map((row) => [
    row.sku,
    row.descripcion,
    row.marca,
    row.stockWarnes,
    row.stockEscobar,
    row.stockTotal,
    row.porcentajeWarnes * 100,
    row.porcentajeEscobar * 100,
    row.direccion,
    row.cantidadTransferir,
    row.warnesFinal,
    row.escobarFinal,
    row.porcentajeWarnesFinal * 100,
    row.porcentajeEscobarFinal * 100,
    row.aproximado ? "SI" : "NO",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => {
      const content = typeof cell === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(cell)
        ? `'${cell}`
        : String(cell ?? "");
      return `"${content.replace(/"/g, '""')}"`;
    }).join(";"))
    .join("\r\n");

  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "Transferencias_entre_depositos.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DirectionBadge({ value }: { value: TransferenciaRegistro["direccion"] }) {
  const toWarnes = value === "ESCOBAR → WARNES";
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${toWarnes ? "bg-blue-100 text-blue-800" : "bg-violet-100 text-violet-800"}`}>
      {value}
    </span>
  );
}

function SortButton({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: TransferenciasSortKey;
  sort: SortState;
  onSort: (key: TransferenciasSortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-left font-bold uppercase tracking-[0.04em] text-white"
    >
      {label}
      {active ? (
        sort.direction === "desc" ? <ArrowDown aria-hidden="true" className="size-3" /> : <ArrowUp aria-hidden="true" className="size-3" />
      ) : null}
    </button>
  );
}

export function ComprasTransferenciasWorkspace({ data }: { data: ComprasTransferencias }) {
  const [filters, setFilters] = useState<TransferenciasFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>({ key: "cantidadTransferir", direction: "desc" });

  const visibles = useMemo(() => {
    const filtered = filterTransferencias(data.registros, filters);
    return [...filtered].sort((a, b) => {
      const av = Number(a[sort.key] || 0);
      const bv = Number(b[sort.key] || 0);
      return sort.direction === "asc" ? av - bv : bv - av;
    });
  }, [data.registros, filters, sort]);

  const update = (key: keyof TransferenciasFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value } as TransferenciasFilters));
  };

  const changeSort = (key: TransferenciasSortKey) => {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
      : { key, direction: "desc" });
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Abastecimiento · redistribución</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">Transferencias entre depósitos</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Distribución objetivo del stock entre Warnes y Escobar.</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Actualizado: <strong className="text-[var(--navy)]">{data.actualizado}</strong></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportCsv(visibles)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-xs font-semibold text-[var(--navy)] hover:bg-[var(--soft)]"
          >
            <Download aria-hidden="true" className="size-4" />Descargar visibles
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-xs font-semibold text-[var(--navy)] hover:bg-[var(--soft)]"
          >
            <RefreshCw aria-hidden="true" className="size-4" />Actualizar
          </button>
        </div>
      </div>

      <div className="rounded-[18px] border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
        Objetivo: <strong>Warnes 10% / Escobar 90%</strong> · tolerancia aceptada: <strong>±3 puntos porcentuales</strong>. Sólo se muestran SKU cuyo stock en Warnes queda fuera de la banda <strong>7%-13%</strong>.
      </div>

      <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
        Los SKU que no pueden quedar exactamente dentro de la banda por trabajar con unidades enteras se resaltan en amarillo y se identifican como <strong>APROX.</strong>
      </div>

      <section aria-label="Resumen de transferencias" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          ["SKU a transferir", data.resumen.skuTransferir],
          ["Escobar → Warnes", data.resumen.unidadesEscobarWarnes],
          ["Warnes → Escobar", data.resumen.unidadesWarnesEscobar],
          ["SKU dentro tolerancia", data.resumen.dentroTolerancia],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-[20px] border border-[var(--line)] bg-white px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--navy)]">{number(value)}</p>
          </div>
        ))}
      </section>

      <section aria-label="Filtros de transferencias" className="grid gap-3 rounded-[20px] border border-[var(--line)] bg-white p-4 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_auto] xl:items-end">
        <label className="text-[11px] font-semibold text-[var(--muted)]">
          Buscar SKU o descripción
          <input
            type="search"
            value={filters.texto}
            onChange={(event) => update("texto", event.target.value)}
            placeholder="SKU o descripción"
            className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--blue)]"
          />
        </label>

        <label className="text-[11px] font-semibold text-[var(--muted)]">
          Dirección
          <select
            value={filters.direccion}
            onChange={(event) => update("direccion", event.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)]"
          >
            <option value="">Todas</option>
            {TRANSFER_DIRECTIONS.map((direction) => <option key={direction} value={direction}>{direction}</option>)}
          </select>
        </label>

        <label className="text-[11px] font-semibold text-[var(--muted)]">
          Marca
          <select
            value={filters.marca}
            onChange={(event) => update("marca", event.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)]"
          >
            <option value="">Todas</option>
            {data.marcas.map((marca) => <option key={marca} value={marca}>{marca}</option>)}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setFilters(EMPTY_FILTERS)}
          className="h-10 rounded-xl border border-[var(--line)] bg-[var(--soft)] px-4 text-xs font-semibold text-[var(--navy)] hover:bg-white"
        >
          Limpiar
        </button>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[var(--muted)]">
        <span><strong className="text-[var(--navy)]">{number(visibles.length)}</strong> de {number(data.registros.length)} SKU visibles</span>
        <span className="inline-flex items-center gap-1.5"><ArrowLeftRight aria-hidden="true" className="size-3.5" />{number(data.resumen.sinStock)} SKU sin stock total quedan fuera del cálculo.</span>
      </div>

      <section aria-label="Tabla de transferencias entre depósitos" className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1720px] border-collapse text-left text-[11px]">
            <thead className="bg-[var(--navy)] text-[10px] font-bold uppercase tracking-[0.04em] text-white">
              <tr>
                <th className="px-3 py-3">SKU</th>
                <th className="px-3 py-3">Descripción</th>
                <th className="px-3 py-3">Marca</th>
                <th className="px-3 py-3 text-right"><SortButton label="Stock Warnes" sortKey="stockWarnes" sort={sort} onSort={changeSort} /></th>
                <th className="px-3 py-3 text-right"><SortButton label="Stock Escobar" sortKey="stockEscobar" sort={sort} onSort={changeSort} /></th>
                <th className="px-3 py-3 text-right"><SortButton label="Stock total" sortKey="stockTotal" sort={sort} onSort={changeSort} /></th>
                <th className="px-3 py-3 text-right"><SortButton label="% Warnes" sortKey="porcentajeWarnes" sort={sort} onSort={changeSort} /></th>
                <th className="px-3 py-3 text-right"><SortButton label="% Escobar" sortKey="porcentajeEscobar" sort={sort} onSort={changeSort} /></th>
                <th className="px-3 py-3">Dirección</th>
                <th className="px-3 py-3 text-right"><SortButton label="Cant. transferir" sortKey="cantidadTransferir" sort={sort} onSort={changeSort} /></th>
                <th className="px-3 py-3 text-right"><SortButton label="Warnes final" sortKey="warnesFinal" sort={sort} onSort={changeSort} /></th>
                <th className="px-3 py-3 text-right"><SortButton label="Escobar final" sortKey="escobarFinal" sort={sort} onSort={changeSort} /></th>
                <th className="px-3 py-3 text-right"><SortButton label="% Warnes final" sortKey="porcentajeWarnesFinal" sort={sort} onSort={changeSort} /></th>
                <th className="px-3 py-3 text-right"><SortButton label="% Escobar final" sortKey="porcentajeEscobarFinal" sort={sort} onSort={changeSort} /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {visibles.length ? visibles.map((row) => (
                <tr key={row.sku} className={`${row.aproximado ? "bg-amber-50 hover:bg-amber-100/70" : "hover:bg-[var(--soft)]"}`}>
                  <th scope="row" className="whitespace-nowrap px-3 py-3 font-semibold text-[var(--navy)]">{row.sku}</th>
                  <td className="max-w-80 px-3 py-3">{row.descripcion || "–"}</td>
                  <td className="px-3 py-3">{row.marca}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{number(row.stockWarnes)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{number(row.stockEscobar)}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-[var(--navy)]">{number(row.stockTotal)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{percent(row.porcentajeWarnes)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{percent(row.porcentajeEscobar)}</td>
                  <td className="px-3 py-3"><DirectionBadge value={row.direccion} /></td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-[var(--navy)]">
                    <span>{number(row.cantidadTransferir)}</span>
                    {row.aproximado && <span className="ml-2 inline-flex rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-bold text-amber-900">APROX.</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{number(row.warnesFinal)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{number(row.escobarFinal)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{percent(row.porcentajeWarnesFinal)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{percent(row.porcentajeEscobarFinal)}</td>
                </tr>
              )) : (
                <tr><td colSpan={14} className="px-5 py-12 text-center text-sm text-[var(--muted)]">No hay transferencias para los filtros seleccionados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
