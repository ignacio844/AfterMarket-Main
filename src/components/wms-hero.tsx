"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

const IMPLEMENTATION_DATE = new Date("2026-11-02T00:00:00-03:00");
const DAY_IN_MILLISECONDS = 86_400_000;

function getRemainingDays() {
  return Math.max(0, Math.ceil((IMPLEMENTATION_DATE.getTime() - Date.now()) / DAY_IN_MILLISECONDS));
}

export function WmsHero() {
  const [remainingDays, setRemainingDays] = useState<number | null>(null);

  useEffect(() => {
    setRemainingDays(getRemainingDays());
    const timer = window.setInterval(() => setRemainingDays(getRemainingDays()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]" aria-label="Implementación y acceso WMS">
      <div className="relative flex min-h-48 items-center overflow-hidden rounded-[28px] bg-[var(--navy)] p-7 text-white shadow-[0_24px_60px_-36px_rgba(14,40,65,0.72)] sm:p-8">
        <div className="absolute -right-20 -top-32 size-80 rounded-full border border-white/10" />
        <div className="absolute right-24 top-24 size-32 rounded-full border border-white/10" />
        <div className="relative flex w-full flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Operaciones y logística</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Implementación WMS</h1>
          </div>
          <div className="flex shrink-0 items-center gap-4 rounded-2xl bg-[var(--navy-soft)] px-5 py-4 text-[var(--navy)] shadow-sm ring-1 ring-white/20 sm:min-w-72">
            <span className="font-mono text-5xl font-semibold leading-none tracking-[-0.08em] tabular-nums">{remainingDays ?? "--"}</span>
            <div className="border-l border-[var(--line)] pl-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--blue)]">Días</p>
              <p className="mt-1 max-w-32 text-xs font-semibold leading-4 text-[var(--navy)]">Días hasta la implementación</p>
            </div>
          </div>
        </div>
      </div>

      <a
        href="https://wms.grupo-aftermarket.com:4446/SGLWMS_DISTRIMAR_PROD/hinicio.aspx"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir WMS en una pestaña nueva"
        className="shine group relative flex min-h-48 flex-col justify-between overflow-hidden rounded-[28px] bg-[#111f3a] p-6 text-white shadow-[0_24px_60px_-36px_rgba(14,40,65,0.72)]"
      >
        <span className="absolute -left-24 -top-28 size-64 rounded-full border-[26px] border-[#1f3d70]/65" />
        <span className="absolute -right-24 -top-24 size-72 rounded-full bg-[#182a49]" />
        <span className="absolute -bottom-40 -left-6 size-72 rounded-full bg-[#1a2d4d]" />
        <div className="relative flex flex-1 items-center justify-center">
          <span className="mr-5 h-20 w-1 bg-[#3974df]" />
          <span className="text-5xl font-light tracking-[-0.05em] sm:text-6xl">WMS</span>
        </div>
        <div className="relative flex items-center justify-between border-t border-white/10 pt-4 text-sm font-semibold text-white/70 transition group-hover:text-white">
          <span>Abrir sistema</span>
          <ExternalLink aria-hidden="true" className="size-4" strokeWidth={1.8} />
        </div>
      </a>
    </section>
  );
}
