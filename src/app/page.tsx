"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HomeCalendarStrip } from "@/components/home-calendar-strip";
import { WeatherClockCard } from "@/components/weather-clock-card";
import { defaultHomeAccessIds, portalAccesses } from "@/lib/portal-data";

const STORAGE_KEY = "grupo-aftermarket:home-accesses:ignacio";

function getTimeData(date: Date) {
  const timeZone = "America/Argentina/Buenos_Aires";
  const hour = Number(
    new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      hour12: false,
      timeZone,
    })
      .formatToParts(date)
      .find((part) => part.type === "hour")?.value ?? "0",
  );
  return {
    greeting: hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches",
    time: new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    }).format(date),
  };
}

export default function Home() {
  const [now, setNow] = useState<Date | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultHomeAccessIds);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) {
          const validIds = parsed.filter(
            (id): id is string => typeof id === "string" && portalAccesses.some((access) => access.id === id),
          );
          setSelectedIds(validIds);
        }
      }
    } catch {
      setSelectedIds(defaultHomeAccessIds);
    }
  }, []);

  const visibleAccesses = useMemo(
    () => selectedIds.map((id) => portalAccesses.find((access) => access.id === id)).filter(Boolean),
    [selectedIds],
  );
  const timeData = now ? getTimeData(now) : null;

  function toggleAccess(id: string) {
    setSelectedIds((current) => {
      const next = current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function resetAccesses() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultHomeAccessIds));
    setSelectedIds(defaultHomeAccessIds);
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <main className="mx-auto max-w-[1440px] px-5 py-7 lg:px-10 lg:py-9">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="relative flex min-h-48 items-center overflow-hidden rounded-[28px] bg-[var(--navy)] px-7 py-8 text-white shadow-[0_24px_60px_-36px_rgba(14,40,65,0.72)] sm:px-9">
            <div className="absolute -right-12 -top-28 size-64 rounded-full border border-white/10" />
            <div className="absolute right-12 top-16 size-28 rounded-full border border-white/10" />
            <div className="relative max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                {timeData?.greeting ?? "Buenos días"}, Ignacio.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
                Tus herramientas y accesos de trabajo, organizados en un solo lugar.
              </p>
            </div>
          </div>

          <WeatherClockCard time={timeData?.time ?? "--:--"} />
        </section>

        <HomeCalendarStrip now={now} />

        <section className="mt-10 pb-12" aria-labelledby="my-accesses-title">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--blue)]">Espacio personal</p>
              <h2 id="my-accesses-title" className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                Mis accesos
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">Elegí qué áreas querés tener disponibles en tu inicio.</p>
            </div>

            <details className="relative z-20 w-full sm:w-auto">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] shadow-sm transition hover:border-[var(--navy)] sm:min-w-52">
                Personalizar accesos
                <span className="text-xs text-[var(--muted)]">{selectedIds.length}/{portalAccesses.length}</span>
              </summary>
              <div className="absolute right-0 mt-2 w-full min-w-72 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-[0_24px_70px_-28px_rgba(14,40,65,0.38)] sm:w-80">
                <div className="max-h-80 space-y-1 overflow-y-auto">
                  {portalAccesses.map((access) => (
                    <label key={access.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-[var(--soft)]">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(access.id)}
                        onChange={() => toggleAccess(access.id)}
                        className="size-4 accent-[var(--navy)]"
                      />
                      <span className="flex-1 text-sm font-medium">{access.name}</span>
                      {!access.enabled && <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Próximamente</span>}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={resetAccesses}
                  className="mt-2 w-full rounded-xl bg-[var(--soft)] px-3 py-2.5 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--navy)]"
                >
                  Restablecer selección
                </button>
              </div>
            </details>
          </div>

          {visibleAccesses.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {visibleAccesses.map((access, index) =>
                access ? (
                  <Link
                    key={access.id}
                    href={access.href}
                    className="group flex min-h-48 flex-col justify-between rounded-[24px] border border-[var(--line)] bg-white p-6 transition hover:-translate-y-0.5 hover:border-[var(--navy)] hover:shadow-[0_18px_45px_-34px_rgba(14,40,65,0.6)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">{access.eyebrow}</span>
                      {!access.enabled && (
                        <span className="rounded-full bg-[var(--soft)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">
                          Próximamente
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</span>
                      <h3 className="mt-2 text-xl font-semibold text-[var(--navy)]">{access.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{access.description}</p>
                    </div>
                  </Link>
                ) : null,
              )}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
              <p className="font-semibold text-[var(--navy)]">Tu inicio está vacío</p>
              <p className="mt-2 text-sm text-[var(--muted)]">Usá “Personalizar accesos” para agregar las áreas que necesitás.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
