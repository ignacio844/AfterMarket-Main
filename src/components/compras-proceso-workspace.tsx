"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, RefreshCw, X } from "lucide-react";
import { filterProceso, type ComprasProceso, type ProcesoFilters, type ProcesoRegistro } from "@/lib/compras-proceso";

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const EMPTY_FILTERS: ProcesoFilters = { texto: "", estado: "", marca: "", proveedor: "" };

function number(value: number) { return integer.format(value || 0); }

function Estado({ value }: { value: string }) {
  const estado = value.toUpperCase();
  const tone = estado === "COMPRA REALIZADA"
    ? "bg-emerald-100 text-emerald-800"
    : estado === "COMPRA PARCIAL"
      ? "bg-orange-100 text-orange-800"
      : estado === "EN GESTION"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none ${tone}`}>{value || "PENDIENTE"}</span>;
}

function exportCsv(registros: ProcesoRegistro[]) {
  const headers = [
    "LOTE", "FECHA ENVIO", "USUARIO ENVIO", "SKU", "DESCRIPCION", "MARCA", "CANTIDAD SOLICITADA",
    "ESTADO", "PROVEEDOR", "CANTIDAD COMPRADA", "SALDO", "RESPONSABLE", "OBSERVACION", "FECHA GESTION", "FECHA COMPRA",
  ];
  const rows = registros.map((row) => [
    row.nroEnvio, row.fechaEnvio, row.usuarioEnvio, row.sku, row.descripcion, row.marca, row.cantidadSolicitada,
    row.estadoCompra, row.proveedor, row.cantidadComprada, row.saldoPendiente, row.responsableCompra,
    row.observacionCompra, row.fechaGestion, row.fechaCompra,
  ]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => {
    const content = typeof cell === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(cell) ? `'${cell}` : String(cell ?? "");
    return `"${content.replace(/"/g, '""')}"`;
  }).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "Compras_en_Proceso.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ComprasProcesoWorkspace({ data }: { data: ComprasProceso }) {
  const [filters, setFilters] = useState<ProcesoFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<ProcesoRegistro | null>(null);
  const visibles = useMemo(() => filterProceso(data.registros, filters), [data.registros, filters]);
  const update = (key: keyof ProcesoFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  return <div className="mt-6 space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Abastecimiento · operación</p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">Compras en Proceso</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Seguimiento de los SKU enviados a Compras, en modo consulta.</p>
        <p className="mt-1 text-xs text-[var(--muted)]">Actualizado: <strong className="text-[var(--navy)]">{data.actualizado}</strong></p>
      </div>
      <button type="button" onClick={() => exportCsv(visibles)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-xs font-semibold text-[var(--navy)] hover:bg-[var(--soft)]">
        <Download aria-hidden="true" className="size-4" />Descargar visibles
      </button>
    </div>

    {data.pendientesDeSincronizar > 0 && <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
      <strong>{number(data.pendientesDeSincronizar)} SKU</strong> todavía no están persistidos en COMPRAS_EN_PROCESO. Se muestran temporalmente desde ENVIOS_COMPRA para reproducir la sincronización legacy sin escribir en Google Sheets.
    </div>}

    <section aria-label="Resumen de compras en proceso" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {([
        ["Lotes EC", data.resumen.lotes],
        ["SKU", data.resumen.sku],
        ["Unidades solicitadas", data.resumen.unidadesSolicitadas],
        ["Unidades compradas", data.resumen.unidadesCompradas],
      ] as const).map(([label, value]) => <div key={label} className="rounded-[20px] border border-[var(--line)] bg-white px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--navy)]">{number(value)}</p>
      </div>)}
    </section>

    <section aria-label="Filtros de compras en proceso" className="grid gap-3 rounded-[20px] border border-[var(--line)] bg-white p-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto] xl:items-end">
      <label className="text-[11px] font-semibold text-[var(--muted)]">Lote / SKU / descripción
        <input type="search" value={filters.texto} onChange={(event) => update("texto", event.target.value)} placeholder="Ej. EC-20260813... o KLILED..." className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--blue)]" />
      </label>
      <label className="text-[11px] font-semibold text-[var(--muted)]">Estado
        <select value={filters.estado} onChange={(event) => update("estado", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)]">
          <option value="">Todos</option>{data.estados.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
        </select>
      </label>
      <label className="text-[11px] font-semibold text-[var(--muted)]">Marca
        <select value={filters.marca} onChange={(event) => update("marca", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)]">
          <option value="">Todas</option>{data.marcas.map((marca) => <option key={marca} value={marca}>{marca}</option>)}
        </select>
      </label>
      <label className="text-[11px] font-semibold text-[var(--muted)]">Proveedor
        <select value={filters.proveedor} onChange={(event) => update("proveedor", event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)]">
          <option value="">Todos</option>{data.proveedores.map((proveedor) => <option key={proveedor} value={proveedor}>{proveedor}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="h-10 rounded-xl border border-[var(--line)] bg-[var(--soft)] px-4 text-xs font-semibold text-[var(--navy)] hover:bg-white">Limpiar</button>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[var(--muted)]">
      <span><strong className="text-[var(--navy)]">{number(visibles.length)}</strong> de {number(data.registros.length)} registros visibles</span>
      <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-semibold text-[var(--navy)] hover:bg-[var(--soft)]"><RefreshCw aria-hidden="true" className="size-3.5" />Actualizar</button>
    </div>

    <section aria-label="Tabla de compras en proceso" className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-white">
      <div className="w-full overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left text-[10px] leading-tight">
          <colgroup>
            <col className="w-[8%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[14%]" />
            <col className="w-[8%]" />
            <col className="w-[6%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[6%]" />
            <col className="w-[4%]" />
            <col className="w-[5%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[5%]" />
          </colgroup>
          <thead className="bg-[var(--navy)] text-[9px] font-bold uppercase leading-tight text-white">
            <tr>
              <th className="px-1.5 py-2">Lote</th>
              <th className="px-1.5 py-2">Fecha envío</th>
              <th className="px-1.5 py-2">SKU</th>
              <th className="px-1.5 py-2">Descripción</th>
              <th className="px-1.5 py-2">Marca</th>
              <th className="px-1.5 py-2 text-right">Cant. solicitada</th>
              <th className="px-1.5 py-2">Estado</th>
              <th className="px-1.5 py-2">Proveedor</th>
              <th className="px-1.5 py-2 text-right">Cant. comprada</th>
              <th className="px-1.5 py-2 text-right">Saldo</th>
              <th className="px-1.5 py-2">Responsable</th>
              <th className="px-1.5 py-2">Observación</th>
              <th className="px-1.5 py-2">Fecha compra</th>
              <th className="px-1.5 py-2">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {visibles.length ? visibles.map((row, index) => <tr key={`${row.nroEnvio}-${row.sku}-${index}`} className={row.virtual ? "bg-amber-50/45" : "hover:bg-[var(--soft)]"}>
              <th scope="row" className="break-words px-1.5 py-2 font-semibold text-[var(--navy)]">{row.nroEnvio}</th>
              <td className="break-words px-1.5 py-2 tabular-nums">{row.fechaEnvio || "–"}</td>
              <td className="break-words px-1.5 py-2 font-semibold text-[var(--navy)]">{row.sku}</td>
              <td className="break-words px-1.5 py-2">{row.descripcion}</td>
              <td className="break-words px-1.5 py-2">{row.marca}</td>
              <td className="px-1.5 py-2 text-right tabular-nums">{number(row.cantidadSolicitada)}</td>
              <td className="px-1.5 py-2"><Estado value={row.estadoCompra} /></td>
              <td className="break-words px-1.5 py-2">{row.proveedor || "–"}</td>
              <td className="px-1.5 py-2 text-right tabular-nums">{row.cantidadComprada > 0 ? number(row.cantidadComprada) : ""}</td>
              <td className="px-1.5 py-2 text-right font-semibold tabular-nums">{number(row.saldoPendiente)}</td>
              <td className="break-words px-1.5 py-2">{row.responsableCompra || "–"}</td>
              <td className="whitespace-pre-wrap break-words px-1.5 py-2">{row.observacionCompra}</td>
              <td className="break-words px-1.5 py-2 tabular-nums">{row.fechaCompra || "–"}</td>
              <td className="px-1 py-2">
                <button type="button" onClick={() => setSelected(row)} className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-[var(--blue)] px-1.5 py-1 text-[9px] font-semibold text-[var(--blue)] hover:bg-[var(--navy-soft)]">
                  <Eye aria-hidden="true" className="size-3" />Gestionar
                </button>
              </td>
            </tr>) : <tr><td colSpan={14} className="px-4 py-10 text-center text-[var(--muted)]">No hay compras que coincidan con los filtros seleccionados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    {selected && <ProcesoModal registro={selected} onClose={() => setSelected(null)} />}
  </div>;
}

function ProcesoModal({ registro, onClose }: { registro: ProcesoRegistro; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-2 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="proceso-modal-title" className="flex max-h-[calc(100vh-1rem)] w-full max-w-[1050px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl outline-none sm:max-h-[calc(100vh-2rem)]">
      <header className="flex items-center justify-between gap-3 bg-[var(--navy)] px-5 py-4 text-white sm:px-6">
        <div><h2 id="proceso-modal-title" className="text-lg font-semibold">Gestionar compra</h2><p className="mt-0.5 text-xs text-white/60">Modo consulta · Guardar permanece deshabilitado</p></div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-white/15"><X aria-hidden="true" className="size-4" /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <dl className="grid gap-2 sm:grid-cols-3">
          {([ ["Lote", registro.nroEnvio], ["SKU", registro.sku], ["Cantidad solicitada", number(registro.cantidadSolicitada)] ] as const).map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-3"><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-[var(--navy)]">{value}</dd></div>)}
        </dl>
        <p className="mt-3 text-sm text-[var(--muted)]">{registro.descripcion || "Sin descripción"}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-[11px] font-semibold text-[var(--muted)]">Estado de compra
            <select disabled value={registro.estadoCompra} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--soft)] px-3 text-sm font-normal text-[var(--ink)] disabled:opacity-100"><option>{registro.estadoCompra}</option></select>
          </label>
          <label className="text-[11px] font-semibold text-[var(--muted)]">Proveedor
            <input disabled value={registro.proveedor} className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--soft)] px-3 text-sm font-normal text-[var(--ink)] disabled:opacity-100" />
          </label>
        </div>

        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] border border-[var(--line)] bg-[var(--canvas)] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Total comprado</p><p className="mt-1 text-xl font-semibold tabular-nums text-[var(--navy)]">{number(registro.cantidadComprada)}</p></div>
          <div className="rounded-[18px] border border-[var(--line)] bg-[var(--canvas)] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Saldo pendiente</p><p className="mt-1 text-xl font-semibold tabular-nums text-[var(--navy)]">{number(registro.saldoPendiente)}</p></div>
        </section>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Responsable</p><p className="mt-1 text-sm text-[var(--navy)]">{registro.responsableCompra || "–"}</p></div>
          <div className="rounded-xl border border-[var(--line)] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Fecha compra</p><p className="mt-1 text-sm tabular-nums text-[var(--navy)]">{registro.fechaCompra || "–"}</p></div>
        </div>
        <div className="mt-3 rounded-xl border border-[var(--line)] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Observación de compra</p><p className="mt-1 whitespace-pre-wrap text-sm text-[var(--ink)]">{registro.observacionCompra || "Sin observación"}</p></div>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-[var(--navy)]">Historial de compras</h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full min-w-[820px] border-collapse text-left text-[11px]">
              <thead className="bg-[var(--soft)] text-[10px] font-bold uppercase text-[var(--navy)]"><tr><th className="px-2 py-2.5">Movimiento</th><th className="px-2 py-2.5">Fecha</th><th className="px-2 py-2.5">Estado</th><th className="px-2 py-2.5">Proveedor</th><th className="px-2 py-2.5 text-right">Cantidad</th><th className="px-2 py-2.5 text-right">Acumulado</th><th className="px-2 py-2.5 text-right">Saldo</th><th className="px-2 py-2.5">Usuario</th></tr></thead>
              <tbody className="divide-y divide-[var(--line)]">{registro.movimientos.length ? registro.movimientos.map((movimiento) => <tr key={movimiento.nroMovimiento || `${movimiento.fecha}-${movimiento.cantidadAcumulada}`}><td className="px-2 py-2 font-semibold text-[var(--navy)]">{movimiento.nroMovimiento}</td><td className="whitespace-nowrap px-2 py-2">{movimiento.fecha}</td><td className="px-2 py-2">{movimiento.estado}</td><td className="px-2 py-2">{movimiento.proveedor || "–"}</td><td className="px-2 py-2 text-right tabular-nums">{number(movimiento.cantidadMovimiento)}</td><td className="px-2 py-2 text-right tabular-nums">{number(movimiento.cantidadAcumulada)}</td><td className="px-2 py-2 text-right tabular-nums">{number(movimiento.saldo)}</td><td className="px-2 py-2">{movimiento.usuario || "–"}</td></tr>) : <tr><td colSpan={8} className="px-4 py-6 text-center text-[var(--muted)]">Sin movimientos registrados.</td></tr>}</tbody>
            </table>
          </div>
        </section>
      </div>

      <footer className="flex justify-end gap-2 border-t border-[var(--line)] bg-white px-5 py-3 sm:px-6">
        <button type="button" onClick={onClose} className="rounded-lg border border-[var(--line)] px-4 py-2.5 text-xs font-semibold text-[var(--navy)] hover:bg-[var(--soft)]">Cerrar</button>
        <button type="button" disabled title="Guardar requiere habilitar escrituras en una etapa posterior" className="rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white opacity-55 disabled:cursor-not-allowed">Guardar</button>
      </footer>
    </div>
  </div>;
}
