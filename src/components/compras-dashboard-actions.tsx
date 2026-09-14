"use client";

import { Download, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ComprasDashboardActions({ canExport }: { canExport: boolean }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => startRefresh(() => router.refresh())}
        disabled={refreshing}
        className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-xs font-semibold text-[var(--navy)] transition hover:border-[var(--blue)] hover:bg-[var(--soft)] disabled:cursor-wait disabled:opacity-60"
      >
        <RefreshCw aria-hidden="true" className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Actualizando…" : "Actualizar"}
      </button>
      {canExport && (
        <a
          href="/api/compras/dashboard-export"
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--navy)] px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#173d60]"
        >
          <Download aria-hidden="true" className="size-4" />
          Descargar registros
        </a>
      )}
    </div>
  );
}
