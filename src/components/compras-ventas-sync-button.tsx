"use client";

import { Check, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type SyncStatus = "PENDIENTE" | "PROCESANDO" | "COMPLETADO" | "ERROR";

type ApiResponse = {
  ok: boolean;
  alreadyRunning?: boolean;
  request?: {
    id: number;
    status: SyncStatus;
    errorMessage: string | null;
  } | null;
  error?: string;
};

const POLL_MS = 3000;
const MAX_POLLS = 240;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function ComprasVentasSyncButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, startRefresh] = useTransition();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function readRequest(id: number) {
    const response = await fetch(
      `/api/compras/sync-ventas?id=${encodeURIComponent(String(id))}`,
      { method: "GET", cache: "no-store", headers: { Accept: "application/json" } },
    );
    const body = (await response.json()) as ApiResponse;
    if (!response.ok || !body.ok) {
      throw new Error(body.error || "No se pudo consultar la actualización.");
    }
    return body.request ?? null;
  }

  async function poll(id: number) {
    for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
      await sleep(POLL_MS);
      if (!mounted.current) return;
      const request = await readRequest(id);
      if (!request) continue;
      setStatus(request.status);

      if (request.status === "COMPLETADO") {
        setPending(false);
        setMessage("Actualizado");
        startRefresh(() => router.refresh());
        window.setTimeout(() => {
          if (mounted.current) {
            setStatus(null);
            setMessage(null);
          }
        }, 5000);
        return;
      }
      if (request.status === "ERROR") {
        setPending(false);
        setMessage(request.errorMessage || "Error");
        return;
      }
      setMessage(request.status === "PROCESANDO" ? "Actualizando…" : "En cola…");
    }

    if (!mounted.current) return;
    setPending(false);
    setMessage("Sigue en proceso");
  }

  async function handleClick() {
    if (pending) return;
    setPending(true);
    setStatus("PENDIENTE");
    setMessage("En cola…");

    try {
      const response = await fetch("/api/compras/sync-ventas", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
      });
      const body = (await response.json()) as ApiResponse;
      if (!response.ok || !body.ok || !body.request) {
        throw new Error(body.error || "No se pudo iniciar la actualización.");
      }
      setStatus(body.request.status);
      setMessage(body.alreadyRunning ? "Ya en curso…" : "En cola…");
      await poll(body.request.id);
    } catch (cause) {
      if (!mounted.current) return;
      setPending(false);
      setStatus("ERROR");
      setMessage(cause instanceof Error ? cause.message : "Error al actualizar");
    }
  }

  const isError = status === "ERROR";
  const isDone = status === "COMPLETADO";

  return (
    <div className="flex items-center gap-2">
      {message ? (
        <span
          className={`hidden max-w-24 truncate text-[10px] font-semibold xl:inline ${
            isError ? "text-red-700" : isDone ? "text-emerald-700" : "text-sky-800/70"
          }`}
          title={message}
        >
          {message}
        </span>
      ) : null}

      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        title="Actualizar Ventas desde SQL Server"
        aria-label="Actualizar Ventas desde SQL Server"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sky-300/80 bg-white/80 px-2.5 text-[10px] font-bold uppercase tracking-[0.05em] text-sky-800 transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        ) : isDone ? (
          <Check aria-hidden="true" className="size-3.5" />
        ) : isError ? (
          <TriangleAlert aria-hidden="true" className="size-3.5" />
        ) : (
          <RefreshCw aria-hidden="true" className="size-3.5" />
        )}
        {pending ? "Actualizando" : isDone ? "Listo" : isError ? "Reintentar" : "Actualizar"}
      </button>
    </div>
  );
}
