import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, ArrowDownRight, Boxes, PackageCheck, ShoppingCart, TrendingUp } from "lucide-react";
import { auth } from "@/auth";
import { ComprasDashboardActions } from "@/components/compras-dashboard-actions";
import { ComprasWarnesSyncButton } from "@/components/compras-warnes-sync-button";
import { ComprasVentasSyncButton } from "@/components/compras-ventas-sync-button";
import { ComprasOrdenesSyncButton } from "@/components/compras-ordenes-sync-button";
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
import { resolveGestionBrand, type ComprasGestion } from "@/lib/compras-gestion";
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

function SourceStatus({
  label,
  source,
  action,
}: {
  label: string;
  source: DashboardSource;
  action?: ReactNode;
}) {
  const connected = source.icono === "🟢";
  const warning = source.icono === "🟡";
  const offline = source.icono === "🔴";
  const [fechaOriginal = source.fecha, hora = ""] = source.fecha
    .trim()
    .split(/\s+(?=\d{1,2}:\d{2}(?::\d{2})?$)/);

  const fecha = fechaOriginal.replace(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    (_, dia, mes, anio) => `${dia}/${mes}/${anio.slice(-2)}`,
  );

  const tone = connected
    ? "source-card-connected text-emerald-950"
    : warning
      ? "bg-gradient-to-br from-amber-50 to-amber-100/60 text-amber-900"
      : offline
        ? "bg-gradient-to-br from-red-50 to-red-100/60 text-red-900"
        : "bg-[var(--soft)] text-[var(--ink)]";

  const dotTone = connected
    ? "source-connection-dot bg-emerald-500"
    : warning
      ? "bg-amber-400"
      : offline
        ? "bg-red-500"
        : "bg-slate-400";

  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-2xl px-3 py-2.5 transition ${tone}`}>
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dotTone}`} />

      <div className="flex min-w-0 flex-1 items-center gap-2.5 whitespace-nowrap">
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.08em] text-current">
          {label}
        </span>
        <span className="min-w-0 shrink text-[10px] font-medium text-current/55">
          {fecha}{hora ? ` ${hora}` : ""}
        </span>
        {action ? <div className="ml-auto shrink-0">{action}</div> : null}
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
    <article className="flex min-h-24 flex-col justify-between rounded-[18px] border border-[var(--line)] bg-white px-4.5 py-3.5 shadow-[0_10px_24px_-22px_rgba(14,40,65,0.38)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[var(--muted)]">{label}</p>
        <span className={`grid size-6.5 shrink-0 place-items-center rounded-lg ${colors[tone]}`}><Icon aria-hidden="true" className="size-4" strokeWidth={1.8} /></span>
      </div>
      <div>
        <p className="text-[26px] font-semibold tracking-[-0.045em] tabular-nums text-[var(--navy)]">{value}</p>
        {detail && <p className="mt-1 text-[11px] text-[var(--muted)]">{detail}</p>}
      </div>
    </article>
  );
}

function BrandsTable({ title, subtitle, brands }: { title: string; subtitle: string; brands: DashboardBrand[] }) {
  const visible = brands.slice(0, 30);
  return (
    <section className="overflow-hidden rounded-[24px] border border-[var(--line)] bg-white" aria-label={title}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-2.5 sm:px-6">
        <h2 className="text-xl font-semibold tracking-[-0.025em] text-[var(--navy)]">{title}</h2>
        <span className="shrink-0 rounded-lg bg-[var(--soft)] px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)]">
          {subtitle}
        </span>
      </div>
      {visible.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-[var(--muted)]">No hay marcas habilitadas en este origen.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse text-left text-xs">
            <thead className="bg-[var(--soft)] text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
              <tr>
                <th scope="col" className="sticky left-0 bg-[var(--soft)] px-5 py-2.5">Marca</th>
                <th scope="col" className="px-3 py-2.5 text-right">Sin stock</th>
                <th scope="col" className="px-3 py-2.5 text-right">Urgente</th>
                <th scope="col" className="px-3 py-2.5 text-right">Comprar</th>
                <th scope="col" className="px-3 py-2.5 text-right">Compra sugerida</th>
                <th scope="col" className="px-3 py-2.5 text-right">Consumo trim. prom.</th>
                <th scope="col" className="px-3 py-2.5 text-right">Cobertura actual</th>
                <th scope="col" className="px-5 py-2.5 text-right">Objetivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {visible.map((brand) => (
                <tr key={brand.marca} className="transition hover:bg-[#f8fafb]">
                  <th scope="row" className="sticky left-0 bg-white px-5 py-2.5 font-semibold text-[var(--navy)]">
                    <Link
                      href={`/areas/compras?vista=gestion&marca=${encodeURIComponent(brand.marca)}`}
                      prefetch={false}
                      title={`Ver gestión de ${brand.marca}`}
                      className="rounded-sm text-[var(--blue)] underline underline-offset-2 transition hover:text-[var(--navy)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)]"
                    >
                      {brand.marca}
                    </Link>
                  </th>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-red-700">{number(brand.sinStock)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{number(brand.urgente)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{number(brand.comprar)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[var(--navy)]">{number(brand.compra)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{number(brand.consumoTrimestralPromedio)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{decimal(brand.coberturaPromedio, 2)} meses</td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-[var(--navy)]">{decimal(brand.coberturaObjetivo, 1)}</td>
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
      <section className="mt-4 rounded-[22px] border border-[var(--line)] bg-white p-2.5 sm:p-3" aria-label="Estado de fuentes de datos">
        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          <SourceStatus label="Stock Warnes" source={dashboard.fuentes.stockWarnes} action={<ComprasWarnesSyncButton />} />
          <SourceStatus label="Stock Escobar" source={dashboard.fuentes.stockEscobar} />
          <SourceStatus label="Ventas" source={dashboard.fuentes.ventas} action={<ComprasVentasSyncButton />} />
          <SourceStatus label="Órdenes de compra" source={dashboard.fuentes.ordenes} action={<ComprasOrdenesSyncButton />} />
        </div>
      </section>

      <section className="mt-4" aria-label="Indicadores de compras">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Sin stock" value={number(dashboard.sinStock)} tone="red" icon={AlertCircle} />
          <Kpi label="Urgentes" value={number(dashboard.urgente)} tone="orange" icon={AlertCircle} />
          <Kpi label="Comprar" value={number(dashboard.comprar)} tone="amber" icon={ShoppingCart} />
          <Kpi label="Revisar" value={number(dashboard.revisar)} tone="green" icon={TrendingUp} />
          <Kpi label="Stock" value={number(dashboard.stock)} icon={Boxes} />
          <Kpi label="Pendiente" value={number(dashboard.pendiente)} icon={PackageCheck} />
          <Kpi label="Cobertura" value={decimal(dashboard.coberturaPromedio, 2)} icon={TrendingUp} />
          <Kpi label="Compra sugerida" value={number(dashboard.compraSugerida)} icon={ArrowDownRight} />
        </div>
      </section>

      <div className="mt-7 space-y-5">
        <BrandsTable title="Marcas importadas" subtitle="Objetivo: 6 meses" brands={dashboard.marcasImportadas} />
        <BrandsTable title="Marcas nacionales" subtitle="Objetivo: 1,5 meses" brands={dashboard.marcasNacionales} />
      </div>
      <div className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--soft)] px-5 py-4 text-sm text-[var(--muted)]">
        Marcas excluidas de nuevas compras: <strong className="text-[var(--navy)]">{number(dashboard.marcasNoCompra.length)}</strong>
      </div>
    </>
  );
}

type ComprasParams = { vista?: string | string[]; sku?: string | string[]; marca?: string | string[] };

async function ComprasViewContent({ vista, historialSku, requestedBrand }: { vista?: string | string[]; historialSku: string; requestedBrand: string }) {
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
  return error && !isHistorial ? (
    <div role="alert" className="mt-5 flex items-start gap-3 rounded-[22px] border border-red-200 bg-white px-5 py-6 text-red-800">
      <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold">No se pudo cargar {isGestion ? "Gestión de Compras" : isBandeja ? "Bandeja de Compra" : isProceso ? "Compras en Proceso" : isPacking ? "Packing List" : isContenedores ? "Contenedores" : isSeguimiento ? "Seguimiento" : isRecepciones ? "Recepciones" : isTransferencias ? "Transferencias" : isEnvios ? "Enviados a Compra" : isCotizaciones ? "Cotizaciones" : "el Dashboard de Compras"}</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    </div>
  ) : isHistorial ? <ComprasHistorialWorkspace sku={historialSku} historial={historial} error={error} /> : isGestion && gestion ? <ComprasGestionWorkspace key={requestedBrand} gestion={gestion} initialBrand={resolveGestionBrand(gestion.marcas, requestedBrand)} /> : isBandeja && bandeja ? <ComprasBandejaWorkspace data={bandeja} /> : isProceso && proceso ? <ComprasProcesoWorkspace data={proceso} /> : isPacking && packing ? <ComprasPackingWorkspace data={packing} /> : isContenedores && contenedores ? <ComprasContenedoresWorkspace data={contenedores} /> : isSeguimiento && seguimiento ? <ComprasSeguimientoWorkspace data={seguimiento} /> : isRecepciones && recepciones ? <ComprasRecepcionesWorkspace data={recepciones} /> : isTransferencias && transferencias ? <ComprasTransferenciasWorkspace data={transferencias} /> : isEnvios && envios ? <ComprasEnviosWorkspace data={envios} /> : isCotizaciones && cotizaciones ? <ComprasCotizacionesWorkspace data={cotizaciones} /> : dashboard ? <DashboardContent dashboard={dashboard} /> : null;
}

export default async function ComprasPage({ searchParams }: { searchParams: Promise<ComprasParams> }) {
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
  const requestedBrand = isGestion && typeof params.marca === "string" ? params.marca.trim().slice(0, 120) : "";

  const isMoreView =
    isRecepciones ||
    isHistorial ||
    isTransferencias;

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <main className={`mx-auto ${isWide ? "max-w-[1920px] px-4 py-5 lg:px-5 lg:py-6" : "max-w-[1440px] px-5 py-8 lg:px-10 lg:py-10"}`}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <nav
            aria-label="Vistas de Compras"
            className="flex min-w-0 flex-1 items-center rounded-2xl border border-[var(--line)] bg-white p-1.5 shadow-sm"
          >
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              href="/areas/compras"
              prefetch={false}
              aria-current={!isGestion && !isHistorial && !isEnvios && !isCotizaciones && !isBandeja && !isProceso && !isPacking && !isContenedores && !isSeguimiento && !isRecepciones && !isTransferencias ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition ${!isGestion && !isHistorial && !isEnvios && !isCotizaciones && !isBandeja && !isProceso && !isPacking && !isContenedores && !isSeguimiento && !isRecepciones && !isTransferencias ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Dashboard
            </Link>

            <Link
              href="/areas/compras?vista=gestion"
              aria-current={isGestion ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition ${isGestion ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Gestión
            </Link>

            <Link
              href="/areas/compras?vista=cotizaciones"
              aria-current={isCotizaciones ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition ${isCotizaciones ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Cotizaciones
            </Link>

            <Link
              href="/areas/compras?vista=bandeja"
              aria-current={isBandeja ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition ${isBandeja ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Bandeja
            </Link>

            <Link
              href="/areas/compras?vista=envios"
              aria-current={isEnvios ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition ${isEnvios ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Enviados
            </Link>

            <Link
              href="/areas/compras?vista=proceso"
              prefetch={false}
              aria-current={isProceso ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition ${isProceso ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              En proceso
            </Link>

            <Link
              href="/areas/compras?vista=packing"
              prefetch={false}
              aria-current={isPacking ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition ${isPacking ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Packing List
            </Link>

            <Link
              href="/areas/compras?vista=contenedores"
              prefetch={false}
              aria-current={isContenedores ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition ${isContenedores ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Contenedores
            </Link>

            <Link
              href="/areas/compras?vista=seguimiento"
              prefetch={false}
              aria-current={isSeguimiento ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition ${isSeguimiento ? "bg-[var(--navy)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}
            >
              Seguimiento
            </Link>

            </div>

            <details className="group relative shrink-0">
              <summary
                className={`flex cursor-pointer list-none items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition [&::-webkit-details-marker]:hidden ${
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
          {!isHistorial && !isEnvios && !isCotizaciones && !isBandeja && !isProceso && !isPacking && !isContenedores && !isSeguimiento && !isRecepciones && !isTransferencias && <div className="shrink-0 xl:ml-2"><ComprasDashboardActions canExport={!isGestion} /></div>}
        </div>

        <Suspense key={`${String(vista ?? "dashboard")}:${historialSku}:${requestedBrand}`} fallback={<div role="status" className="mt-5 rounded-[22px] border border-[var(--line)] bg-white px-5 py-6 text-sm text-[var(--muted)]">Cargando vista de Compras…</div>}>
          <ComprasViewContent vista={vista} historialSku={historialSku} requestedBrand={requestedBrand} />
        </Suspense>
      </main>
    </div>
  );
}
