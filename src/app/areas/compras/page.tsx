import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ArrowDownRight, Boxes, Clock3, PackageCheck, ShoppingCart, TrendingUp } from "lucide-react";
import { auth } from "@/auth";
import { ComprasDashboardActions } from "@/components/compras-dashboard-actions";
import { ComprasGestionWorkspace } from "@/components/compras-gestion-workspace";
import { ComprasHistorialWorkspace } from "@/components/compras-historial-workspace";
import { ComprasEnviosWorkspace } from "@/components/compras-envios-workspace";
import { ComprasCotizacionesWorkspace } from "@/components/compras-cotizaciones-workspace";
import { ComprasBandejaWorkspace } from "@/components/compras-bandeja-workspace";
import { ComprasProcesoWorkspace } from "@/components/compras-proceso-workspace";
import { ComprasPackingWorkspace } from "@/components/compras-packing-workspace";
import { ComprasContenedoresWorkspace } from "@/components/compras-contenedores-workspace";
import { ComprasSeguimientoWorkspace } from "@/components/compras-seguimiento-workspace";
import { ComprasRecepcionesWorkspace } from "@/components/compras-recepciones-workspace";
import { ComprasTransferenciasWorkspace } from "@/components/compras-transferencias-workspace";
import { isPortalUserAllowed } from "@/lib/portal-auth";
import { getComprasDashboard, getComprasGestion, getComprasHistorial, getComprasEnvios, getComprasCotizaciones, getComprasBandeja, getComprasProceso, getComprasPacking, getComprasContenedores, getComprasSeguimiento, getComprasRecepciones, getComprasTransferencias } from "@/lib/compras-sheets";
import type { ComprasDashboard, DashboardBrand, DashboardSource } from "@/lib/compras-dashboard";
import type { ComprasGestion } from "@/lib/compras-gestion";
import type { ComprasHistorial } from "@/lib/compras-historial";
import type { ComprasEnvios } from "@/lib/compras-envios";
import type { ComprasCotizaciones } from "@/lib/compras-cotizaciones";
import type { ComprasBandeja } from "@/lib/compras-bandeja";
import type { ComprasProceso } from "@/lib/compras-proceso";
import type { ComprasPacking } from "@/lib/compras-packing";
import type { ComprasContenedores } from "@/lib/compras-contenedores";
import type { ComprasSeguimiento } from "@/lib/compras-seguimiento";
import type { ComprasRecepciones } from "@/lib/compras-recepciones";
import type { ComprasTransferencias } from "@/lib/compras-transferencias";

export const metadata: Metadata = {
  title: "Compras | Grupo Aftermarket",
  description: "Dashboard de Compras del portal interno de Grupo Aftermarket.",
};

export const dynamic = "force-dynamic";

const whole = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

function number(value: number) {
  return whole.format(Math.round(value || 0));
}

function decimal(value: number, digits: number) {
  return Number(value || 0).toFixed(digits);
}

function SourceStatus({ label, source }: { label: string; source: DashboardSource }) {
  const tone = source.icono === "🟢"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : source.icono === "🟡"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : source.icono === "🔴"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-[var(--line)] bg-[var(--soft)] text-[var(--muted)]";
  return (
    <div className={`flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 ${tone}`}>
      <span aria-hidden="true" className="text-sm">{source.icono}</span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.13em]">{label}</p>
        <p className="mt-1 truncate text-xs font-semibold">{source.fecha}</p>
      </div>
    </div>
  );
}

function Kpi({ label, value, detail, tone = "blue", icon: Icon }: {
  label: string;
  value: string;
  detail?: string;
  tone?: "red" | "orange" | "amber" | "green" | "blue";
  icon: typeof AlertCircle;
}) {
  const colors = {
    red: "bg-red-50 text-red-700",
    orange: "bg-orange-50 text-orange-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-[var(--navy-soft)] text-[var(--blue)]",
  };
  return (
    <article className="flex min-h-36 flex-col justify-between rounded-[22px] border border-[var(--line)] bg-white p-5 shadow-[0_10px_24px_-22px_rgba(14,40,65,0.38)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--muted)]">{label}</p>
        <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${colors[tone]}`}><Icon aria-hidden="true" className="size-4" strokeWidth={1.8} /></span>
      </div>
      <div>
        <p className="text-[30px] font-semibold tracking-[-0.045em] tabular-nums text-[var(--navy)]">{value}</p>
        {detail && <p className="mt-1 text-[11px] text-[var(--muted)]">{detail}</p>}
      </div>
    </article>
  );
}

function BrandsTable({ title, subtitle, brands }: { title: string; subtitle: string; brands: DashboardBrand[] }) {
  const visible = brands.slice(0, 30);
  return (
    <section className="overflow-hidden rounded-[24px] border border-[var(--line)] bg-white" aria-label={title}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-5 sm:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Análisis por origen</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[var(--navy)]">{title}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{subtitle}</p>
        </div>
        <span className="rounded-full bg-[var(--soft)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]">{number(brands.length)} marcas</span>
      </div>
      {visible.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-[var(--muted)]">No hay marcas habilitadas en este origen.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse text-left text-xs">
            <thead className="bg-[var(--soft)] text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
              <tr>
                <th scope="col" className="sticky left-0 bg-[var(--soft)] px-5 py-3.5">Marca</th>
                <th scope="col" className="px-3 py-3.5 text-right">Sin stock</th>
                <th scope="col" className="px-3 py-3.5 text-right">Urgente</th>
                <th scope="col" className="px-3 py-3.5 text-right">Comprar</th>
                <th scope="col" className="px-3 py-3.5 text-right">Compra sugerida</th>
                <th scope="col" className="px-3 py-3.5 text-right">Consumo trim. prom.</th>
                <th scope="col" className="px-3 py-3.5 text-right">Cobertura actual</th>
                <th scope="col" className="px-5 py-3.5 text-right">Objetivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {visible.map((brand) => (
                <tr key={brand.marca} className="transition hover:bg-[#f8fafb]">
                  <th scope="row" className="sticky left-0 bg-white px-5 py-3.5 font-semibold text-[var(--navy)]">{brand.marca}</th>
                  <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-red-700">{number(brand.sinStock)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{number(brand.urgente)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{number(brand.comprar)}</td>
                  <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-[var(--navy)]">{number(brand.compra)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{number(brand.consumoTrimestralPromedio)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{decimal(brand.coberturaPromedio, 2)} meses</td>
                  <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-[var(--navy)]">{decimal(brand.coberturaObjetivo, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {brands.length > 30 && <p className="border-t border-[var(--line)] px-5 py-3 text-xs text-[var(--muted)]">Se muestran las primeras 30 marcas, siguiendo el orden del Dashboard legacy.</p>}
    </section>
  );
}

function DashboardContent({ dashboard }: { dashboard: ComprasDashboard }) {
  return (
    <>
      <section className="mt-5 rounded-[24px] border border-[var(--line)] bg-white p-5 sm:p-6" aria-labelledby="compras-fuentes-title">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Calidad de datos</p>
            <h2 id="compras-fuentes-title" className="mt-1 text-base font-semibold text-[var(--navy)]">Última importación por fuente</h2>
          </div>
          <Clock3 aria-hidden="true" className="size-5 text-[var(--muted)]" strokeWidth={1.7} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <SourceStatus label="Stock Warnes" source={dashboard.fuentes.stockWarnes} />
          <SourceStatus label="Stock Escobar" source={dashboard.fuentes.stockEscobar} />
          <SourceStatus label="Ventas" source={dashboard.fuentes.ventas} />
          <SourceStatus label="Órdenes de compra" source={dashboard.fuentes.ordenes} />
        </div>
      </section>

      <section className="mt-7" aria-labelledby="compras-resumen-title">
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Resumen operativo</p>
          <h2 id="compras-resumen-title" className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[var(--navy)]">Indicadores de compras</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Sin stock" value={number(dashboard.sinStock)} tone="red" icon={AlertCircle} />
          <Kpi label="Urgentes" value={number(dashboard.urgente)} tone="orange" icon={AlertCircle} />
          <Kpi label="Comprar" value={number(dashboard.comprar)} tone="amber" icon={ShoppingCart} />
          <Kpi label="Revisar" value={number(dashboard.revisar)} tone="green" icon={TrendingUp} />
          <Kpi label="Stock" value={number(dashboard.stock)} detail="Unidades físicas totales" icon={Boxes} />
          <Kpi label="Pendiente" value={number(dashboard.pendiente)} detail="Unidades por recibir" icon={PackageCheck} />
          <Kpi label="Cobertura" value={decimal(dashboard.coberturaPromedio, 2)} detail="Meses · marcas habilitadas" icon={TrendingUp} />
          <Kpi label="Compra sugerida" value={number(dashboard.compraSugerida)} detail="Unidades · marcas habilitadas" icon={ArrowDownRight} />
        </div>
      </section>

      <div className="mt-7 space-y-5">
        <BrandsTable title="Marcas importadas" subtitle="Objetivo de referencia: 6 meses" brands={dashboard.marcasImportadas} />
        <BrandsTable title="Marcas nacionales" subtitle="Objetivo de referencia: 1,5 meses" brands={dashboard.marcasNacionales} />
      </div>
      <div className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--soft)] px-5 py-4 text-sm text-[var(--muted)]">
        Marcas excluidas de nuevas compras: <strong className="text-[var(--navy)]">{number(dashboard.marcasNoCompra.length)}</strong>
      </div>
    </>
  );
}

export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ vista?: string | string[]; sku?: string | string[] }> }) {
  const session = await auth();
  if (!session?.user?.email || !isPortalUserAllowed(session.user.email)) return null;
  const params = await searchParams;
  const vista = params.vista;
  const isGestion = vista === "gestion";
  const isHistorial = vista === "historial";
  const isEnvios = vista === "envios";
  const isCotizaciones = vista === "cotizaciones";
  const isBandeja = vista === "bandeja";
  const isProceso = vista === "proceso";
  const isPacking = vista === "packing";
  const isContenedores = vista === "contenedores";
  const isSeguimiento = vista === "seguimiento";
  const isRecepciones = vista === "recepciones";
  const isTransferencias = vista === "transferencias";
  const isWide = isGestion || isCotizaciones || isBandeja || isProceso || isPacking || isContenedores || isSeguimiento || isRecepciones || isTransferencias;
  const historialSku = typeof params.sku === "string" ? params.sku.trim().slice(0, 100) : "";

  let dashboard: ComprasDashboard | null = null;
  let gestion: ComprasGestion | null = null;
  let historial: ComprasHistorial | null = null;
  let envios: ComprasEnvios | null = null;
  let cotizaciones: ComprasCotizaciones | null = null;
  let bandeja: ComprasBandeja | null = null;
  let proceso: ComprasProceso | null = null;
  let packing: ComprasPacking | null = null;
  let contenedores: ComprasContenedores | null = null;
  let seguimiento: ComprasSeguimiento | null = null;
  let recepciones: ComprasRecepciones | null = null;
  let transferencias: ComprasTransferencias | null = null;
  let error: string | null = null;
  try {
    if (isGestion) gestion = await getComprasGestion();
    else if (isHistorial && historialSku) historial = await getComprasHistorial(historialSku);
    else if (isEnvios) envios = await getComprasEnvios();
    else if (isCotizaciones) cotizaciones = await getComprasCotizaciones();
    else if (isBandeja) bandeja = await getComprasBandeja();
    else if (isProceso) proceso = await getComprasProceso();
    else if (isPacking) packing = await getComprasPacking();
    else if (isContenedores) contenedores = await getComprasContenedores();
    else if (isSeguimiento) seguimiento = await getComprasSeguimiento();
    else if (isRecepciones) recepciones = await getComprasRecepciones();
    else if (isTransferencias) transferencias = await getComprasTransferencias();
    else if (!isHistorial) dashboard = await getComprasDashboard();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    error = /^(Falta configurar|No se pudo (leer|conectar|autenticar)|No existe la hoja|MODELO_COMPRAS no contiene|No se encontraron SKU|No se encontró historial|No se encontró la columna SKU|ALIAS_MARCAS_COMPRA debe contener|GESTION_COMPRAS_ACTIVA no contiene|ENVIOS_COMPRA no contiene|COMPRAS_EN_PROCESO no contiene|COTIZACIONES_COMPRA no contiene|PACKING_LIST no contiene|CONTENEDORES no contiene|CONTENEDOR_PACKING_LIST debe contener|ORDENES no contiene|DETALLE_IMPORTACIONES no contiene|DETALLE_IMPORTACIONES debe contener|GESTION_COMPRAS_ACTIVA debe contener)/.test(message)
      ? message
      : `No se pudo cargar ${isHistorial ? "Historial SKU" : isGestion ? "Gestión de Compras" : isBandeja ? "Bandeja de Compra" : isProceso ? "Compras en Proceso" : isPacking ? "Packing List" : isContenedores ? "Contenedores" : isSeguimiento ? "Seguimiento" : isRecepciones ? "Recepciones" : isTransferencias ? "Transferencias" : isEnvios ? "Enviados a Compra" : isCotizaciones ? "Cotizaciones" : "el Dashboard de Compras"}.`;
  }

  const isMoreView =
    isRecepciones ||
    isHistorial ||
    isTransferencias;

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <main className={`mx-auto ${isWide ? "max-w-[1920px] px-4 py-5 lg:px-5 lg:py-6" : "max-w-[1440px] px-5 py-8 lg:px-10 lg:py-10"}`}>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <nav
            aria-label="Vistas de Compras"
            className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border border-[var(--line)] bg-white p-1.5 shadow-sm"
          >
            <Link
              href="/areas/compras"
              prefetch={false}
              aria-current={!isGestion && !isHistorial && !isEnvios && !isCotizaciones && !isBandeja && !isProceso && !isPacking && !isContenedores && !isSeguimiento && !isRecepciones && !isTransferencias ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${!isGestion && !isHistorial && !isEnvios && !isCotizaciones && !isBandeja && !isProceso && !isPacking && !isContenedores && !isSeguimiento && !isRecepciones && !isTransferencias ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Dashboard
            </Link>

            <Link
              href="/areas/compras?vista=gestion"
              prefetch={false}
              aria-current={isGestion ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${isGestion ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Gestión
            </Link>

            <Link
              href="/areas/compras?vista=cotizaciones"
              prefetch={false}
              aria-current={isCotizaciones ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${isCotizaciones ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Cotizaciones
            </Link>

            <Link
              href="/areas/compras?vista=bandeja"
              prefetch={false}
              aria-current={isBandeja ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${isBandeja ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Bandeja
            </Link>

            <Link
              href="/areas/compras?vista=envios"
              prefetch={false}
              aria-current={isEnvios ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${isEnvios ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Enviados
            </Link>

            <Link
              href="/areas/compras?vista=proceso"
              prefetch={false}
              aria-current={isProceso ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${isProceso ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              En proceso
            </Link>

            <Link
              href="/areas/compras?vista=packing"
              prefetch={false}
              aria-current={isPacking ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${isPacking ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Packing List
            </Link>

            <Link
              href="/areas/compras?vista=contenedores"
              prefetch={false}
              aria-current={isContenedores ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${isContenedores ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Contenedores
            </Link>

            <Link
              href="/areas/compras?vista=seguimiento"
              prefetch={false}
              aria-current={isSeguimiento ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${isSeguimiento ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Seguimiento
            </Link>

            <details className="group relative">
              <summary
                className={`flex cursor-pointer list-none items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-semibold transition [&::-webkit-details-marker]:hidden ${
                  isMoreView
                    ? "bg-[var(--navy)] text-white"
                    : "text-[var(--muted)] hover:bg-[var(--soft)]"
                }`}
              >
                Más
                <span aria-hidden="true" className="text-[10px] transition group-open:rotate-180">▼</span>
              </summary>

              <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-1.5 shadow-[0_18px_42px_-20px_rgba(14,40,65,0.45)]">
                <Link
                  href="/areas/compras?vista=recepciones"
                  prefetch={false}
                  className={`block rounded-xl px-3 py-2.5 text-xs font-semibold transition ${isRecepciones ? "bg-[var(--navy)] text-white" : "text-[var(--ink)] hover:bg-[var(--soft)]"}`}
                >
                  Recepciones
                </Link>

                <Link
                  href="/areas/compras?vista=historial"
                  prefetch={false}
                  className={`block rounded-xl px-3 py-2.5 text-xs font-semibold transition ${isHistorial ? "bg-[var(--navy)] text-white" : "text-[var(--ink)] hover:bg-[var(--soft)]"}`}
                >
                  Historial SKU
                </Link>

                <Link
                  href="/areas/compras?vista=transferencias"
                  prefetch={false}
                  className={`block rounded-xl px-3 py-2.5 text-xs font-semibold transition ${isTransferencias ? "bg-[var(--navy)] text-white" : "text-[var(--ink)] hover:bg-[var(--soft)]"}`}
                >
                  Transferencias
                </Link>
              </div>
            </details>
          </nav>
          {!isHistorial && !isEnvios && !isCotizaciones && !isBandeja && !isProceso && !isPacking && !isContenedores && !isSeguimiento && !isRecepciones && !isTransferencias && <ComprasDashboardActions canExport={Boolean(dashboard) && !isGestion} />}
        </div>

        {error && !isHistorial ? (
          <div role="alert" className="mt-5 flex items-start gap-3 rounded-[22px] border border-red-200 bg-white px-5 py-6 text-red-800">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">No se pudo cargar {isGestion ? "Gestión de Compras" : isBandeja ? "Bandeja de Compra" : isProceso ? "Compras en Proceso" : isPacking ? "Packing List" : isContenedores ? "Contenedores" : isSeguimiento ? "Seguimiento" : isRecepciones ? "Recepciones" : isTransferencias ? "Transferencias" : isEnvios ? "Enviados a Compra" : isCotizaciones ? "Cotizaciones" : "el Dashboard de Compras"}</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        ) : isHistorial ? <ComprasHistorialWorkspace sku={historialSku} historial={historial} error={error} /> : isGestion && gestion ? <ComprasGestionWorkspace gestion={gestion} /> : isBandeja && bandeja ? <ComprasBandejaWorkspace data={bandeja} /> : isProceso && proceso ? <ComprasProcesoWorkspace data={proceso} /> : isPacking && packing ? <ComprasPackingWorkspace data={packing} /> : isContenedores && contenedores ? <ComprasContenedoresWorkspace data={contenedores} /> : isSeguimiento && seguimiento ? <ComprasSeguimientoWorkspace data={seguimiento} /> : isRecepciones && recepciones ? <ComprasRecepcionesWorkspace data={recepciones} /> : isTransferencias && transferencias ? <ComprasTransferenciasWorkspace data={transferencias} /> : isEnvios && envios ? <ComprasEnviosWorkspace data={envios} /> : isCotizaciones && cotizaciones ? <ComprasCotizacionesWorkspace data={cotizaciones} /> : dashboard ? <DashboardContent dashboard={dashboard} /> : null}
      </main>
    </div>
  );
}
