"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type SyncRequest = { id: number; status: "PENDIENTE" | "PROCESANDO" | "COMPLETADO" | "ERROR"; errorMessage: string | null };
type ApiResponse = { ok: boolean; request?: SyncRequest | null; error?: string };

export function ComprasOrdenesSyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function update() {
    if (busy) return;
    setBusy(true);
    setMessage("En cola…");
    try {
      const response = await fetch("/api/compras/sync-ordenes", { method: "POST", headers: { Accept: "application/json" } });
      const body = await response.json() as ApiResponse;
      if (!response.ok || !body.ok || !body.request) throw new Error(body.error || "No se pudo iniciar la actualización.");
      for (let attempt = 0; attempt < 240; attempt++) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
        if (!mounted.current) return;
        const check = await fetch(`/api/compras/sync-ordenes?id=${body.request.id}`, { cache: "no-store" });
        const result = await check.json() as ApiResponse;
        if (!check.ok || !result.ok || !result.request) throw new Error(result.error || "No se pudo consultar la actualización.");
        if (result.request.status === "COMPLETADO") { setMessage("Actualizado"); router.refresh(); return; }
        if (result.request.status === "ERROR") throw new Error(result.request.errorMessage || "Falló la actualización.");
        setMessage(result.request.status === "PROCESANDO" ? "Actualizando…" : "En cola…");
      }
      setMessage("Sigue en proceso");
    } catch (cause) {
      if (mounted.current) setMessage(cause instanceof Error ? cause.message : "Error");
    } finally { if (mounted.current) setBusy(false); }
  }

  return <div className="flex items-center gap-2">
    {message ? <span className="hidden max-w-24 truncate text-[10px] font-semibold xl:inline" title={message}>{message}</span> : null}
    <button type="button" onClick={update} disabled={busy} title="Actualizar órdenes desde el Excel de Drive"
      aria-label="Actualizar órdenes desde el Excel de Drive"
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sky-300/80 bg-white/80 px-2.5 text-[10px] font-bold uppercase tracking-[0.05em] text-sky-800 transition hover:bg-white disabled:cursor-wait disabled:opacity-60">
      <RefreshCw aria-hidden="true" className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
      {busy ? "Actualizando" : "Actualizar"}
    </button>
  </div>;
}
