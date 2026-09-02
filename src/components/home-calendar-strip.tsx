"use client";

import { useMemo } from "react";
import { portalEvents, type PortalEvent } from "@/lib/portal-events";

const TIME_ZONE = "America/Argentina/Buenos_Aires";
const DAY_IN_MS = 86_400_000;

type CalendarDay = {
  date: Date;
  key: string;
  dayName: string;
  dayNumber: string;
  isToday: boolean;
  events: PortalEvent[];
};

function getDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIME_ZONE,
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return { year: value("year"), month: value("month"), day: value("day") };
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00Z`);
}

function formatCountdown(days: number) {
  if (days === 0) return "Es hoy";
  if (days === 1) return "Falta 1 día";
  return `Faltan ${days} días`;
}

function capitalizeFirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function HomeCalendarStrip({ now }: { now: Date | null }) {
  const calendar = useMemo(() => {
    if (!now) return null;

    const parts = getDateParts(now);
    const today = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
    const todayKey = toDateKey(today);
    const days: CalendarDay[] = Array.from({ length: 8 }, (_, index) => {
      const date = new Date(today.getTime() + (index - 3) * DAY_IN_MS);
      const key = toDateKey(date);

      return {
        date,
        key,
        dayName: new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" })
          .format(date)
          .replace(".", ""),
        dayNumber: new Intl.DateTimeFormat("es-AR", { day: "numeric", timeZone: "UTC" }).format(date),
        isToday: key === todayKey,
        events: portalEvents.filter((event) => event.date === key),
      };
    });
    const nextEvent = portalEvents
      .filter((event) => event.date >= todayKey)
      .sort((first, second) => first.date.localeCompare(second.date))[0];

    return { today, days, nextEvent };
  }, [now]);

  if (!calendar) {
    return <div className="mt-4 h-24 animate-pulse rounded-[24px] border border-[var(--line)] bg-white/70" aria-hidden="true" />;
  }

  const nextEventDate = calendar.nextEvent ? dateFromKey(calendar.nextEvent.date) : null;
  const daysUntilEvent = nextEventDate
    ? Math.round((nextEventDate.getTime() - calendar.today.getTime()) / DAY_IN_MS)
    : null;

  return (
    <section
      className="mt-4 grid overflow-hidden rounded-[24px] border border-[var(--line)] bg-white shadow-[0_20px_50px_-42px_rgba(14,40,65,0.5)] lg:grid-cols-[minmax(0,1fr)_340px]"
      aria-label="Calendario y próximos eventos"
    >
      <div className="px-3 py-3 sm:px-5">
        <div className="grid grid-cols-8 gap-0.5 sm:gap-1">
          {calendar.days.map((day) => (
            <time
              key={day.key}
              dateTime={day.key}
              aria-current={day.isToday ? "date" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center rounded-xl px-0.5 py-1.5 transition-colors ${
                day.isToday ? "bg-[var(--navy)] text-white" : "text-[var(--navy)]"
              }`}
            >
              <span className="text-base font-semibold leading-none sm:text-lg">{day.dayNumber}</span>
              <span className={`mt-0.5 text-[9px] capitalize sm:text-[10px] ${day.isToday ? "text-white/65" : "text-[var(--muted)]"}`}>
                {day.dayName}
              </span>
            </time>
          ))}
        </div>

        <div className="relative mt-2 grid grid-cols-8 gap-0.5 px-2 sm:gap-1" aria-hidden="true">
          <span className="absolute left-[6%] right-[6%] top-1/2 border-t border-dashed border-[var(--line)]" />
          {calendar.days.map((day) => (
            <span key={day.key} className="relative flex justify-center">
              <span
                className={`size-2 rounded-full ring-4 ring-white ${
                  day.events.length > 0 ? "bg-[var(--blue)]" : day.isToday ? "bg-[var(--navy)]" : "bg-[#d9e0e5]"
                }`}
              />
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--line)] bg-[var(--navy-soft)]/45 px-5 py-3.5 lg:border-l lg:border-t-0">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--blue)] shadow-sm" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75v2.5m10.5-2.5v2.5M4.5 9.25h15m-13.25-4h11.5A1.75 1.75 0 0 1 19.5 7v11.25A1.75 1.75 0 0 1 17.75 20H6.25a1.75 1.75 0 0 1-1.75-1.75V7a1.75 1.75 0 0 1 1.75-1.75Z" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[var(--blue)]">Próximo feriado</p>
          {calendar.nextEvent && nextEventDate && daysUntilEvent !== null ? (
            <>
              <p className="mt-0.5 text-sm font-semibold leading-[1.15rem] text-[var(--navy)]" title={calendar.nextEvent.title}>
                {calendar.nextEvent.title}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                {capitalizeFirst(new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(nextEventDate))}
                <span aria-hidden="true"> · </span>
                <span className="normal-case">{formatCountdown(daysUntilEvent)}</span>
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold text-[var(--navy)]">Sin feriados programados</p>
          )}
        </div>
      </div>
    </section>
  );
}
