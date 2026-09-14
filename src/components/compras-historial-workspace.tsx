import Link from "next/link";
import { Clock3, Search } from "lucide-react";

// Navigation shell only. The legacy historical data sources are not connected yet.
export function ComprasHistorialWorkspace({ sku }: { sku: string }) {
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

      <section role="status" className="rounded-[22px] border border-[var(--line)] bg-white px-5 py-8 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--navy-soft)] text-[var(--blue)]"><Clock3 aria-hidden="true" className="size-5" /></span>
          <div>
            <h3 className="font-semibold text-[var(--navy)]">{sku ? `SKU seleccionado: ${sku}` : "Buscá un SKU"}</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {sku
                ? "El buscador y la navegación ya están preparados. La trazabilidad histórica todavía no está conectada; no se muestran eventos hasta disponer de datos reales."
                : "Ingresá un código para preparar la consulta. La trazabilidad histórica se conectará en una etapa posterior."}
            </p>
            <Link href="/areas/compras?vista=gestion" prefetch={false} className="mt-4 inline-block text-xs font-semibold text-[var(--blue)] hover:underline">Volver a Gestión de Compras</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
