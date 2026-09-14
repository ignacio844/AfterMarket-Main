import Link from "next/link";
import { Search } from "lucide-react";
import type { ComprasHistorial, HistorialEvento } from "@/lib/compras-historial";

const whole = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

function number(value: number) {
  return whole.format(value || 0);
}

function Fact({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 ${wide ? "xl:col-span-2" : ""}`}>
      <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-[var(--navy)]">{children}</dd>
    </div>
  );
}

function TimelineEvent({ event }: { event: HistorialEvento }) {
  const dot = event.tipo === "GESTION" ? "bg-violet-600" : event.tipo === "ENVIO" ? "bg-blue-600" : "bg-emerald-600";
  return (
    <li className="relative pl-8 pb-4 last:pb-0">
      <span aria-hidden="true" className={`absolute left-0 top-4 z-10 size-3 rounded-full ring-4 ring-[var(--canvas)] ${dot}`} />
      <article className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 sm:px-5">
        <time className="text-[11px] font-medium tabular-nums text-[var(--muted)]">{event.fecha || "Sin fecha"}</time>
        <h4 className="mt-0.5 text-sm font-semibold text-[var(--navy)]">{event.titulo}</h4>
        <dl className="mt-2 space-y-0.5 text-xs leading-5 text-[var(--ink)]">
          {event.estado && <div><dt className="inline font-semibold">Estado: </dt><dd className="inline">{event.estado}</dd></div>}
          {event.detalle && <div>{event.detalle}</div>}
          {event.proveedor && <div><dt className="inline font-semibold">Proveedor: </dt><dd className="inline">{event.proveedor}</dd></div>}
          {event.responsable && <div><dt className="inline font-semibold">Responsable: </dt><dd className="inline">{event.responsable}</dd></div>}
          {event.observacion && <div><dt className="inline font-semibold">Observación: </dt><dd className="inline whitespace-pre-wrap">{event.observacion}</dd></div>}
        </dl>
        {event.referencia && <p className="mt-3 text-[11px] font-medium text-[var(--muted)]">Referencia: {event.referencia}</p>}
      </article>
    </li>
  );
}

export function ComprasHistorialWorkspace({ sku, historial, error }: {
  sku: string;
  historial: ComprasHistorial | null;
  error: string | null;
}) {
  return (
    <div className="mt-6 space-y-5">
      <section aria-labelledby="historial-sku-title">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Trazabilidad</p>
        <h2 id="historial-sku-title" className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[var(--navy)]">Historial de SKU</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Desde la decisión hasta las compras realizadas.</p>
      </section>

      <form action="/areas/compras" method="get" className="rounded-[22px] border border-[var(--line)] bg-white p-5 sm:p-6">
        <input type="hidden" name="vista" value="historial" />
        <label htmlFor="historial-sku-busqueda" className="block text-xs font-semibold text-[var(--navy)]">SKU</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <span className="relative flex-1">
            <Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-[var(--muted)]" />
            <input
              id="historial-sku-busqueda"
              name="sku"
              type="search"
              maxLength={100}
              defaultValue={sku}
              placeholder="Ingresá el SKU…"
              autoComplete="off"
              className="h-10 w-full rounded-xl border border-[var(--line)] bg-white pl-9 pr-3 text-sm text-[var(--navy)] outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15"
            />
          </span>
          <button type="submit" className="rounded-xl bg-[var(--navy)] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[var(--blue)]">Buscar</button>
        </div>
      </form>

      {!sku ? (
        <p className="rounded-[22px] border border-[var(--line)] bg-white px-5 py-6 text-sm text-[var(--muted)]">Ingresá un SKU para consultar su situación actual y trazabilidad.</p>
      ) : error ? (
        <p role="alert" className="rounded-[22px] border border-red-200 bg-white px-5 py-6 text-sm text-red-800">{error}</p>
      ) : historial ? (
        <>
          <section aria-labelledby="historial-actual-title">
            <h3 id="historial-actual-title" className="mb-3 border-b border-[var(--line)] pb-2 text-base font-semibold text-[var(--navy)]">Situación actual</h3>
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Fact label="SKU / Descripción" wide>{historial.sku}{historial.descripcion ? ` · ${historial.descripcion}` : ""}</Fact>
              <Fact label="Marca">{historial.marca || "–"}</Fact>
              <Fact label="Origen">{historial.origen || "–"}</Fact>
              <Fact label="Política de compra">{historial.compraHabilitada ? "COMPRAR" : "NO COMPRAR"}</Fact>
              <Fact label="Cobertura objetivo">{historial.coberturaObjetivo > 0 ? `${historial.coberturaObjetivo.toFixed(1)} meses` : "–"}</Fact>
              <Fact label="Cobertura actual">{historial.coberturaActual.toFixed(2)} meses</Fact>
              <Fact label="Estado actual">{historial.estadoActual || "–"}</Fact>
              <Fact label="Stock Warnes">{number(historial.stockWarnes)}</Fact>
              <Fact label="Stock Escobar">{number(historial.stockEscobar)}</Fact>
              <Fact label="Stock total">{number(historial.stockTotal)}</Fact>
              <Fact label="Consumo mensual">{number(historial.promedioMensual)}</Fact>
              <Fact label="Pendiente recibir">{number(historial.pendienteTotal)}</Fact>
              <Fact label="Solicitado">{number(historial.cantidadSolicitada)}</Fact>
              <Fact label="Comprado">{number(historial.cantidadComprada)}</Fact>
              <Fact label="Saldo compra">{number(historial.saldoPendiente)}</Fact>
            </dl>
          </section>

          <section aria-labelledby="historial-timeline-title">
            <h3 id="historial-timeline-title" className="mb-4 border-b border-[var(--line)] pb-2 text-base font-semibold text-[var(--navy)]">Trazabilidad</h3>
            <ol className="relative before:absolute before:bottom-4 before:left-[5px] before:top-4 before:w-px before:bg-[var(--line)]">
              {historial.eventos.map((event, index) => <TimelineEvent key={`${event.tipo}-${event.fechaOrden}-${index}`} event={event} />)}
            </ol>
          </section>
        </>
      ) : null}

      <Link href="/areas/compras?vista=gestion" prefetch={false} className="inline-block text-xs font-semibold text-[var(--blue)] hover:underline">Volver a Gestión de Compras</Link>
    </div>
  );
}
