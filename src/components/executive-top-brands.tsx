"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { TopBrandsResponse } from "@/lib/executive-brands";

type RequestState = "loading" | "ready" | "empty" | "error";
const TWO_HOURS_MS = 2 * 60 * 60 * 1_000;

function formatUpdatedAt(value: string) {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}`;
}

export function ExecutiveTopBrands() {
  const [data, setData] = useState<TopBrandsResponse | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBrands() {
      try {
        const response = await fetch("/api/executive/top-brands", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json() as TopBrandsResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "No se pudo consultar el ranking.");
        setData(payload);
        setRequestState(payload.brands.length ? "ready" : "empty");
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error cargando el ranking de marcas:", error);
        setData(null);
        setRequestState("error");
      }
    }

    void loadBrands();
    const timer = window.setInterval(() => void loadBrands(), TWO_HOURS_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [retry]);

  return (
    <section className="mt-5" aria-labelledby="executive-brands-title">
      <article className="overflow-hidden rounded-[24px] border border-[var(--line)] bg-white p-4 shadow-[0_18px_48px_-40px_rgba(14,40,65,0.5)] sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4 px-1">
          <div>
            <h2 id="executive-brands-title" className="text-xl font-semibold tracking-[-0.025em] text-[var(--navy)]">Marcas más vendidas</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Participación por renglones durante los últimos 30 días.</p>
          </div>
          <div className="text-right">
            {data?.updatedAt && <p className="text-[10px] font-medium text-[var(--muted)]">Valores actualizados a {formatUpdatedAt(data.updatedAt)}</p>}
          </div>
        </div>

        {requestState === "ready" && data ? (
          <div className="mt-5 grid overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--canvas)] sm:grid-cols-2 xl:grid-cols-5">
            {data.brands.map((brand) => (
              <div
                key={brand.name}
                className={`group relative flex min-h-64 flex-col border-t-2 border-[var(--line)] px-5 py-5 transition-colors duration-200 first:border-t-0 hover:bg-white xl:min-h-72 xl:border-l-2 xl:border-t-0 xl:first:border-l-0 ${brand.rank === 1 ? "bg-[var(--navy-soft)]/45" : "bg-transparent"}`}
              >
                <span className={`grid size-7 place-items-center rounded-full text-[10px] font-bold ${brand.rank === 1 ? "bg-[var(--navy)] text-white" : "border border-[var(--line)] bg-white text-[var(--blue)]"}`} aria-label={`Posición ${brand.rank}`}>
                  {brand.rank}
                </span>

                <div className="relative mt-4 flex h-20 items-center justify-center px-2">
                  {brand.logo && (
                    <Image
                      src={brand.logo}
                      alt=""
                      width={220}
                      height={110}
                      sizes="(max-width: 639px) 55vw, (max-width: 1279px) 28vw, 14vw"
                      className="max-h-20 w-auto max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  )}
                </div>

                <div className="mt-auto pt-5">
                  <h3 className="truncate text-sm font-semibold tracking-[-0.015em] text-[var(--navy)]" title={brand.name}>{brand.name}</h3>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--navy)]">{brand.lines.toLocaleString("es-AR")}</p>
                    <p className="text-[10px] font-bold text-[var(--blue)]">{brand.share.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</p>
                  </div>
                  <span className="sr-only">renglones</span>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-[var(--blue)] transition-[width] duration-500" style={{ width: `${brand.share}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : requestState === "loading" ? (
          <div className="mt-5 grid gap-px overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-5" aria-label="Cargando ranking de marcas">
            {Array.from({ length: 5 }, (_, index) => <div key={index} className="min-h-64 animate-pulse bg-[var(--canvas)]" />)}
          </div>
        ) : (
          <div className="mt-5 grid min-h-40 place-items-center rounded-[20px] border border-[var(--line)] bg-[var(--canvas)] px-6 text-center">
            <div>
              <p className="text-sm font-semibold text-[var(--navy)]">{requestState === "error" ? "No se pudo consultar el ranking." : "Todavía no hay marcas para mostrar."}</p>
              {requestState === "error" && <button type="button" onClick={() => { setRequestState("loading"); setRetry((value) => value + 1); }} className="mt-2 text-xs font-semibold text-[var(--blue)] hover:underline">Reintentar conexión</button>}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
