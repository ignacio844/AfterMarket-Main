"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, LockKeyhole, PackageCheck, RefreshCw } from "lucide-react";
import type { ComprasRecepciones, RecepcionOrden } from "@/lib/compras-recepciones";

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function number(value: number) {
  return integer.format(value || 0);
}

function quantity(value: number) {
  return decimal.format(value || 0);
}

function EstadoRecepcion({ value }: { value: string }) {
  const estado = value.trim().toUpperCase() || "PENDIENTE";
  const tone = estado === "RECIBIDO"
    ? "bg-emerald-100 text-emerald-800"
    : estado === "PARCIAL"
      ? "bg-amber-100 text-amber-800"
      : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${tone}`}>{estado}</span>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="text-[11px] font-semibold text-[var(--muted)]">
      {label}
      <input
        value={value}
        readOnly
        className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--soft)] px-3 text-sm font-normal text-[var(--ink)] outline-none"
      />
    </label>
  );
}

function todayInput() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ComprasRecepcionesWorkspace({ data }: { data: ComprasRecepciones }) {
  const [mode, setMode] = useState<"manual" | "excel">("manual");
  const [ordenId, setOrdenId] = useState("");

  const orden = useMemo<RecepcionOrden | null>(
    () => data.ordenes.find((item) => item.idOrden === ordenId) ?? null,
    [data.ordenes, ordenId],
  );

  const fecha = useMemo(todayInput, []);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Abastecimiento · ingreso</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">Recepción de mercadería</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Consulta de recepciones parciales o totales sobre DETALLE_IMPORTACIONES.</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Actualizado: <strong className="text-[var(--navy)]">{data.actualizado}</strong></p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-xs font-semibold text-[var(--navy)] hover:bg-[var(--soft)]"
        >
          <RefreshCw aria-hidden="true" className="size-4" />Actualizar
        </button>
      </div>

      <div className="rounded-[18px] border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
        <strong>Modo consulta.</strong> La selección de órdenes y el detalle pendiente replican el legacy. Registrar recepciones e importar Excel permanecen deshabilitados porque esas acciones modifican Google Sheets.
      </div>

      <section aria-label="Resumen de recepciones" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {([
          ["Órdenes pendientes", data.resumen.ordenesPendientes],
          ["Órdenes parciales", data.resumen.ordenesParciales],
          ["Líneas pendientes", data.resumen.lineasPendientes],
          ["Unidades pendientes", data.resumen.unidadesPendientes],
          ["Recibido acumulado", data.resumen.unidadesRecibidas],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-[20px] border border-[var(--line)] bg-white px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--navy)]">{number(value)}</p>
          </div>
        ))}
      </section>

      <div className="inline-flex rounded-2xl border border-[var(--line)] bg-white p-1">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition ${mode === "manual" ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
        >
          Recepción manual
        </button>
        <button
          type="button"
          onClick={() => setMode("excel")}
          className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition ${mode === "excel" ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
        >
          Importar desde Excel
        </button>
      </div>

      {mode === "manual" ? (
        <>
          <section className="rounded-[22px] border border-[var(--line)] bg-white p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="text-[11px] font-semibold text-[var(--muted)]">
                Orden / PI
                <select
                  value={ordenId}
                  onChange={(event) => setOrdenId(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--blue)]"
                >
                  <option value="">Seleccione una orden</option>
                  {data.ordenes.map((item) => (
                    <option key={item.idOrden} value={item.idOrden}>
                      {item.numeroPI || item.idOrden}{item.proveedor ? ` - ${item.proveedor}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[11px] font-semibold text-[var(--muted)]">
                Fecha de recepción
                <input
                  type="date"
                  value={fecha}
                  readOnly
                  disabled
                  className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--soft)] px-3 text-sm font-normal text-[var(--ink)] disabled:opacity-100"
                />
              </label>

              <Field label="Proveedor" value={orden?.proveedor ?? ""} />
              <Field label="Legajo / Contenedor" value={orden?.legajo ?? ""} />
              <Field label="Estado logístico" value={orden?.estado ?? ""} />
              <div className="text-[11px] font-semibold text-[var(--muted)]">
                Estado recepción
                <div className="mt-1.5 flex h-10 items-center rounded-xl border border-[var(--line)] bg-[var(--soft)] px-3">
                  {orden ? <EstadoRecepcion value={orden.estadoRecepcion} /> : <span className="text-sm font-normal text-[var(--muted)]">—</span>}
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-left text-xs">
                <thead className="bg-[var(--navy)] text-[10px] font-bold uppercase tracking-[0.06em] text-white">
                  <tr>
                    <th className="px-3 py-3">ID detalle</th>
                    <th className="px-3 py-3">Marca</th>
                    <th className="px-3 py-3">SKU</th>
                    <th className="px-3 py-3">Item</th>
                    <th className="px-3 py-3">Status línea</th>
                    <th className="px-3 py-3 text-right">Pendiente</th>
                    <th className="px-3 py-3 text-right">Recibido acum.</th>
                    <th className="px-3 py-3 text-right">Recibir ahora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {!orden ? (
                    <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-[var(--muted)]">Seleccione una orden para consultar los productos pendientes.</td></tr>
                  ) : orden.detalle.length === 0 ? (
                    <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-[var(--muted)]">La orden no tiene productos pendientes.</td></tr>
                  ) : orden.detalle.map((linea) => (
                    <tr key={linea.idDetalle} className="hover:bg-[var(--soft)]">
                      <th scope="row" className="whitespace-nowrap px-3 py-3 font-semibold text-[var(--navy)]">{linea.idDetalle}</th>
                      <td className="px-3 py-3">{linea.marca || "–"}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-[var(--navy)]">{linea.sku || linea.item || "–"}</td>
                      <td className="px-3 py-3">{linea.item || "–"}</td>
                      <td className="px-3 py-3">{linea.statusLinea || "–"}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{quantity(linea.cantidadPendiente)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{quantity(linea.cantidadRecibida)}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={0}
                          readOnly
                          disabled
                          aria-label={`Recibir ahora ${linea.sku || linea.item || linea.idDetalle}`}
                          className="h-9 w-24 rounded-lg border border-[var(--line)] bg-[var(--soft)] px-2 text-right tabular-nums text-[var(--muted)] disabled:opacity-100"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[22px] border border-[var(--line)] bg-white p-5">
            <label className="text-[11px] font-semibold text-[var(--muted)]">
              Observaciones
              <textarea
                disabled
                placeholder="Observaciones opcionales de la recepción"
                className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--soft)] p-3 text-sm text-[var(--muted)] disabled:opacity-100"
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold text-[var(--muted)]">Líneas seleccionadas: 0 · Cantidad total: 0</p>
              <button
                type="button"
                disabled
                title="El registro de recepciones se habilitará cuando se active la etapa de escritura"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-semibold text-white opacity-55 disabled:cursor-not-allowed"
              >
                <LockKeyhole aria-hidden="true" className="size-4" />Registrar recepción
              </button>
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-[22px] border border-[var(--line)] bg-white p-5">
          <div className="mb-5 flex items-start gap-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            <FileSpreadsheet aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>El legacy valida archivos por <strong>ID_DETALLE</strong> y luego registra recepciones masivas. La lectura y confirmación del Excel quedan bloqueadas hasta habilitar escrituras.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-[11px] font-semibold text-[var(--muted)]">Archivo Excel
              <input type="file" disabled accept=".xlsx,.xls" className="mt-1.5 block h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--soft)] px-3 py-2 text-xs text-[var(--muted)] disabled:opacity-100" />
            </label>
            <label className="text-[11px] font-semibold text-[var(--muted)]">Fecha por defecto
              <input type="date" value={fecha} readOnly disabled className="mt-1.5 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--soft)] px-3 text-sm disabled:opacity-100" />
            </label>
            <Field label="Observación por defecto" value="" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" disabled className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--soft)] px-4 py-2.5 text-xs font-semibold text-[var(--muted)] opacity-70 disabled:cursor-not-allowed"><LockKeyhole aria-hidden="true" className="size-4" />Validar archivo</button>
            <button type="button" disabled className="inline-flex items-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-semibold text-white opacity-55 disabled:cursor-not-allowed"><PackageCheck aria-hidden="true" className="size-4" />Confirmar importación</button>
          </div>
          <div className="mt-5 rounded-[18px] border border-dashed border-[var(--line)] bg-[var(--soft)] px-5 py-10 text-center text-sm text-[var(--muted)]">Seleccione un archivo Excel cuando la etapa de escritura esté habilitada.</div>
        </section>
      )}
    </div>
  );
}
