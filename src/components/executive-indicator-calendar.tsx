"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DayButtonProps } from "react-day-picker";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import type { DailyLinesMetric, DailyLinesResponse } from "@/lib/executive-lines";

type RequestState = "loading" | "ready" | "empty" | "error";
const TWO_HOURS_MS = 2 * 60 * 60 * 1_000;

const classificationStyles = {
  A: "text-emerald-700",
  B: "text-amber-600",
  C: "text-red-600",
} as const;

const classificationLabels = {
  A: "Sobre el promedio",
  B: "Dentro del promedio",
  C: "Debajo del promedio",
} as const;

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthRange(month: Date) {
  return {
    from: dateKey(new Date(month.getFullYear(), month.getMonth(), 1)),
    to: dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
  };
}

function ExecutiveCalendarDayButton({
  metric,
  children,
  modifiers,
  day,
  className,
  style,
  ...props
}: DayButtonProps & { metric?: DailyLinesMetric }) {
  const metricStyle = metric ? classificationStyles[metric.classification] : "text-slate-300";

  return (
    <CalendarDayButton
      day={day}
      modifiers={modifiers}
      className={`${className ?? ""} !flex flex-col items-center justify-center gap-0.5 text-center`}
      style={{ ...style, width: "min(100%, 72px)", marginInline: "auto" }}
      title={metric ? `${metric.lines} renglones · ${metric.orders} pedidos` : "Sin actividad registrada"}
      {...props}
    >
      <span className="leading-none">{children}</span>
      {!modifiers.outside && (
        <span
          className={`text-[10px] font-bold leading-none sm:text-[11px] ${
            modifiers.selected ? "text-white/70" : metricStyle
          }`}
        >
          {metric ? metric.lines.toLocaleString("es-AR") : "—"}
        </span>
      )}
    </CalendarDayButton>
  );
}

export function ExecutiveCalendarIndicator() {
  const today = useMemo(() => new Date(), []);
  const [date, setDate] = useState<Date | undefined>(today);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [data, setData] = useState<DailyLinesResponse | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("loading");
  const [retry, setRetry] = useState(0);
  const range = useMemo(() => monthRange(month), [month]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMetrics() {
      try {
        const params = new URLSearchParams(range);
        const response = await fetch(`/api/executive/daily-lines?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json() as DailyLinesResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron consultar los indicadores.");
        setData(payload);
        setRequestState(payload.days.length ? "ready" : "empty");
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error cargando renglones diarios:", error);
        setData(null);
        setRequestState("error");
      }
    }

    void loadMetrics();
    const refreshTimer = window.setInterval(() => void loadMetrics(), TWO_HOURS_MS);
    return () => {
      controller.abort();
      window.clearInterval(refreshTimer);
    };
  }, [range, retry]);

  const metricsByDate = useMemo(
    () => new Map(data?.days.map((metric) => [metric.date, metric]) ?? []),
    [data],
  );
  const selectedMetric = date ? metricsByDate.get(dateKey(date)) : undefined;
  const selectedDateLabel = date
    ? new Intl.DateTimeFormat("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date)
    : null;
  const lastUpdatedLabel = data?.updatedAt
    ? new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(data.updatedAt))
    : null;

  const DayButton = useCallback(
    (props: DayButtonProps) => (
      <ExecutiveCalendarDayButton {...props} metric={metricsByDate.get(dateKey(props.day.date))} />
    ),
    [metricsByDate],
  );

  function handleMonthChange(nextMonth: Date) {
    setMonth(nextMonth);
    setData(null);
    setRequestState("loading");
  }

  return (
    <section className="mx-auto mt-5 w-full max-w-[920px]" aria-labelledby="executive-indicators-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[var(--blue)]">Información central</p>
          <h2 id="executive-indicators-title" className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[var(--navy)]">
            Indicadores ejecutivos
          </h2>
        </div>
        <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
          {lastUpdatedLabel
            ? `Última actualización · ${lastUpdatedLabel}`
            : requestState === "loading"
              ? "Leyendo última actualización"
              : "Actualización no disponible"}
        </span>
      </div>

      <article className="rounded-[24px] border border-[var(--line)] bg-white p-4 shadow-[0_18px_48px_-40px_rgba(14,40,65,0.5)] sm:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_210px] gap-4 max-[520px]:grid-cols-1">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--navy)]">Renglones por día</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">Cantidad de códigos procesados por pedido.</p>
              </div>
              <div className="flex items-center gap-2 text-[9px] font-semibold text-[var(--muted)]" aria-label="Escala de rendimiento">
                <span><i className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500" />A</span>
                <span><i className="mr-1 inline-block size-1.5 rounded-full bg-amber-400" />B</span>
                <span><i className="mr-1 inline-block size-1.5 rounded-full bg-red-500" />C</span>
              </div>
            </div>

            <Calendar
              mode="single"
              month={month}
              onMonthChange={handleMonthChange}
              selected={date}
              onSelect={setDate}
              showOutsideDays={false}
              timeZone="America/Argentina/Buenos_Aires"
              noonSafe
              classNames={{
                root: "!w-full !max-w-[580px] !p-0",
                months: "!w-full",
                month: "!w-full !space-y-1.5",
                month_caption: "!h-9 !justify-start px-2",
                caption_label: "!text-base",
                nav: "absolute right-1 top-0 flex items-center gap-1",
                month_grid: "!w-full",
                weekdays: "!grid !grid-cols-7",
                weekday: "!w-auto !py-1.5",
                week: "!mt-1 !grid !grid-cols-7",
                day: "!h-11 !w-auto sm:!h-12",
                day_button: "!h-11 !rounded-xl sm:!h-12",
              }}
              components={{ DayButton }}
            />
          </div>

          <aside className="flex min-h-40 flex-col justify-between rounded-[18px] border border-[var(--line)] bg-[var(--navy-soft)]/55 p-4" aria-live="polite">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Día seleccionado</p>
              {selectedDateLabel ? (
                <p className="mt-2 text-sm font-semibold capitalize leading-5 text-[var(--navy)]">{selectedDateLabel}</p>
              ) : (
                <p className="mt-2 text-sm text-[var(--muted)]">Seleccioná una fecha.</p>
              )}
            </div>

            {selectedMetric ? (
              <div className="mt-5 border-t border-[var(--line)] pt-3">
                <p className={`text-2xl font-semibold tracking-[-0.035em] ${classificationStyles[selectedMetric.classification]}`}>
                  {selectedMetric.lines.toLocaleString("es-AR")}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-[var(--muted)]">renglones · {selectedMetric.orders.toLocaleString("es-AR")} pedidos</p>
                <p className={`mt-2 text-[10px] font-bold ${classificationStyles[selectedMetric.classification]}`}>
                  {selectedMetric.classification} · {classificationLabels[selectedMetric.classification]}
                </p>
              </div>
            ) : requestState === "error" ? (
              <div className="mt-5 border-t border-[var(--line)] pt-3">
                <p className="text-xs leading-5 text-[var(--muted)]">Falta configurar o iniciar el bridge local.</p>
                <button
                  type="button"
                  onClick={() => {
                    setRequestState("loading");
                    setRetry((value) => value + 1);
                  }}
                  className="mt-2 text-xs font-semibold text-[var(--blue)] hover:underline"
                >
                  Reintentar conexión
                </button>
              </div>
            ) : (
              <div className="mt-5 border-t border-[var(--line)] pt-3">
                <p className="text-sm font-semibold text-[var(--navy)]">
                  {requestState === "loading" ? "Consultando…" : "Sin actividad"}
                </p>
                {data && data.averageLines > 0 && (
                  <p className="mt-1 text-[10px] text-[var(--muted)]">Promedio mensual: {data.averageLines.toLocaleString("es-AR")} renglones</p>
                )}
              </div>
            )}
          </aside>
        </div>
      </article>
    </section>
  );
}
