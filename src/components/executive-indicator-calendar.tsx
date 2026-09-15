"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import type { DayButtonProps, WeekProps } from "react-day-picker";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import type { DailyLinesClass, DailyLinesMetric, DailyLinesResponse } from "@/lib/executive-lines";

type RequestState = "loading" | "ready" | "empty" | "error";
const TWO_HOURS_MS = 2 * 60 * 60 * 1_000;
const classText = { A: "text-emerald-700", B: "text-amber-600", C: "text-red-600" } as const;
const classColor = { A: "#059669", B: "#d97706", C: "#dc2626" } as const;
const classLabel = { A: "Sobre el promedio", B: "Dentro del promedio", C: "Debajo del promedio" } as const;

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function monthRange(month: Date) {
  return {
    from: dateKey(new Date(month.getFullYear(), month.getMonth(), 1)),
    to: dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
  };
}

function calendarWeekRange(month: Date) {
  const from = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
  to.setDate(to.getDate() + (6 - ((to.getDay() + 6) % 7)));
  return { from: dateKey(from), to: dateKey(to) };
}

function longShortDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" })
    .format(date)
    .replace(".", "");
}

function classification(lines: number, average: number): DailyLinesClass {
  const ratio = average ? lines / average : 1;
  return ratio >= 1.1 ? "A" : ratio >= 0.8 ? "B" : "C";
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" })
    .format(new Date(`${value}T12:00:00`)).replace(".", "");
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const midX = (previous.x + point.x) / 2;
    return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function TrendChart({ days }: { days: DailyLinesMetric[] }) {
  const recent = useMemo(() => [...days].sort((a, b) => a.date.localeCompare(b.date)).slice(-30), [days]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  if (!recent.length) return null;

  const average = recent.reduce((total, day) => total + day.lines, 0) / recent.length;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const width = 430;
  const height = 206;
  const top = 18;
  const bottom = 30;
  const side = 14;
  const chartHeight = height - top - bottom;
  const values = recent.map((day) => day.lines);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = Math.max(rawMax - rawMin, rawMax * 0.18, 1);
  const min = Math.max(0, rawMin - spread * 0.22);
  const max = rawMax + spread * 0.22;
  const points = recent.map((day, index) => ({
    x: side + (recent.length === 1 ? (width - side * 2) / 2 : (index / (recent.length - 1)) * (width - side * 2)),
    y: top + ((max - day.lines) / (max - min)) * chartHeight,
  }));
  const line = smoothPath(points);
  const area = `${line} L ${points.at(-1)!.x} ${height - bottom} L ${points[0].x} ${height - bottom} Z`;
  const averageY = top + ((max - average) / (max - min)) * chartHeight;
  const hoveredDay = hoveredIndex === null ? null : recent[hoveredIndex];
  const hoveredPoint = hoveredIndex === null ? null : points[hoveredIndex];
  const tooltipWidth = 164;
  const tooltipHeight = 68;
  const tooltipX = hoveredPoint ? Math.min(Math.max(hoveredPoint.x - tooltipWidth / 2, side), width - side - tooltipWidth) : 0;
  const tooltipY = hoveredPoint ? (hoveredPoint.y < 92 ? hoveredPoint.y + 14 : hoveredPoint.y - tooltipHeight - 12) : 0;

  return (
    <div>
      <div className="mb-3">
        <div className="w-fit min-w-36 rounded-xl border border-white/80 bg-white/70 px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Promedio</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--navy)]">{Math.round(average).toLocaleString("es-AR")}</p>
        </div>
      </div>
      <div className="rounded-[15px] border border-white/90 bg-white/75 px-1.5 pb-1 pt-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label={`Evolución de los últimos ${recent.length} días con actividad`}>
          <defs>
            <linearGradient id="executive-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a668f" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#2a668f" stopOpacity="0.015" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((position) => <line key={position} x1={side} x2={width - side} y1={top + chartHeight * position} y2={top + chartHeight * position} stroke="#dfe5ea" strokeDasharray="3 6" />)}
          <line x1={side} x2={width - side} y1={averageY} y2={averageY} stroke="#718596" strokeDasharray="5 5" opacity="0.65" />
          <path d={area} fill="url(#executive-trend-fill)" />
          <path d={line} fill="none" stroke="#2a668f" strokeWidth="2.6" strokeLinecap="round" />
          {points.map((point, index) => {
            const day = recent[index];
            const isHovered = hoveredIndex === index;
            const dayClass = classification(day.lines, average);
            return (
              <g
                key={day.date}
                role="button"
                tabIndex={0}
                aria-label={`${shortDate(day.date)}, ${day.lines.toLocaleString("es-AR")} líneas, ${day.orders.toLocaleString("es-AR")} pedidos, ${classLabel[dayClass]}`}
                className="cursor-pointer outline-none"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex(null)}
              >
                {isHovered && <circle cx={point.x} cy={point.y} r="10" fill={classColor[dayClass]} opacity="0.14" />}
                <circle cx={point.x} cy={point.y} r={isHovered ? 5.4 : 3.2} fill={classColor[dayClass]} stroke="white" strokeWidth={isHovered ? 2.5 : 1.8} className="transition-all duration-150" />
                <circle cx={point.x} cy={point.y} r="11" fill="transparent" />
              </g>
            );
          })}
          {hoveredDay && hoveredPoint && (
            <g pointerEvents="none">
              <line x1={hoveredPoint.x} x2={hoveredPoint.x} y1={top} y2={height - bottom} stroke="#2a668f" strokeWidth="1" strokeDasharray="3 4" opacity="0.32" />
              <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx="10" fill="#0e2841" opacity="0.97" />
              <text x={tooltipX + 12} y={tooltipY + 18} fill="#b9d3e5" fontSize="9" fontWeight="700" letterSpacing="0.7">{shortDate(hoveredDay.date).toUpperCase()}</text>
              <text x={tooltipX + 12} y={tooltipY + 38} fill="white" fontSize="13" fontWeight="700">{hoveredDay.lines.toLocaleString("es-AR")} líneas</text>
              <text x={tooltipX + 12} y={tooltipY + 55} fill="#d4dee6" fontSize="9.5">{hoveredDay.orders.toLocaleString("es-AR")} pedidos · {classLabel[classification(hoveredDay.lines, average)]}</text>
            </g>
          )}
          <text x={side} y={height - 8} fill="#687684" fontSize="10">{shortDate(first.date)}</text>
          <text x={width - side} y={height - 8} fill="#687684" fontSize="10" textAnchor="end">{shortDate(last.date)}</text>
        </svg>
      </div>
    </div>
  );
}

function ExecutiveDayButton({ metric, children, modifiers, day, className, style, ...props }: DayButtonProps & { metric?: DailyLinesMetric }) {
  return (
    <CalendarDayButton day={day} modifiers={modifiers} className={`${className ?? ""} !flex flex-col items-center justify-center gap-0.5 text-center`} style={{ ...style, width: "min(100%, 72px)", marginInline: "auto" }} title={metric ? `${metric.lines} líneas · ${metric.orders} pedidos` : "Sin actividad registrada"} {...props}>
      <span className="leading-none">{children}</span>
      {!modifiers.outside && <span className={`text-[10px] font-bold leading-none sm:text-[11px] ${modifiers.selected ? "text-white/70" : metric ? classText[metric.classification] : "text-slate-300"}`}>{metric ? metric.lines.toLocaleString("es-AR") : "—"}</span>}
    </CalendarDayButton>
  );
}

function ExecutiveWeekdays({ children, className, ...props }: ComponentProps<"tr">) {
  return (
    <thead aria-hidden="true">
      <tr {...props} className={`${className ?? ""} items-center`}>
        {children}
        <th scope="col" className="hidden h-full items-center justify-center border-l border-[var(--line)] pl-2 text-center text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--muted)] sm:flex">
          Total
        </th>
      </tr>
    </thead>
  );
}

function ExecutiveWeek({ week, metrics, today, children, className, ...props }: WeekProps & {
  metrics: ReadonlyMap<string, DailyLinesMetric>;
  today: Date;
}) {
  const from = week.days[0].date;
  const to = week.days.at(-1)!.date;
  const weekMetrics = week.days
    .map((day) => metrics.get(dateKey(day.date)))
    .filter((metric): metric is DailyLinesMetric => Boolean(metric));
  const lines = weekMetrics.reduce((total, metric) => total + metric.lines, 0);
  const orders = weekMetrics.reduce((total, metric) => total + metric.orders, 0);
  const hasActivity = weekMetrics.length > 0;
  const todayKey = dateKey(today);
  const isCurrentWeek = dateKey(from) <= todayKey && todayKey <= dateKey(to);
  const rangeLabel = `${longShortDate(from)}–${longShortDate(to)}`;
  const detail = hasActivity
    ? `${rangeLabel}: ${lines.toLocaleString("es-AR")} líneas y ${orders.toLocaleString("es-AR")} pedidos${isCurrentWeek ? ". Semana en curso" : ""}.`
    : `${rangeLabel}: sin actividad registrada${isCurrentWeek ? ". Semana en curso" : ""}.`;

  return (
    <tr {...props} className={`${className ?? ""} group/week rounded-xl transition-colors duration-200 hover:bg-[var(--navy-soft)]/30 focus-within:bg-[var(--navy-soft)]/30`}>
      {children}
      <td className="group/summary relative col-span-7 mt-1 min-w-0 border-t border-[var(--line)] pt-1 sm:col-span-1 sm:mt-0 sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">
        <div
          tabIndex={hasActivity || isCurrentWeek ? 0 : -1}
          aria-label={detail}
          className="flex min-h-8 items-center justify-between gap-2 rounded-lg bg-[var(--navy-soft)]/70 px-2 text-[var(--navy)] outline-none transition group-hover/week:bg-white focus-visible:ring-2 focus-visible:ring-[var(--blue)]/35 sm:min-h-11 sm:flex-col sm:justify-center sm:gap-0 sm:px-1"
        >
          <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--muted)] sm:hidden">Total semanal</span>
          <span className="text-[11px] font-semibold tracking-[-0.025em]">{hasActivity ? lines.toLocaleString("es-AR") : "—"}</span>
          {isCurrentWeek && <span className="text-[7px] font-bold uppercase tracking-[0.08em] text-[var(--blue)]">En curso</span>}
        </div>
        <div aria-hidden="true" role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+6px)] right-0 z-30 hidden w-52 rounded-xl bg-[var(--navy)] px-3 py-2 text-left text-[9px] font-medium leading-4 text-white opacity-0 shadow-xl transition-opacity group-hover/summary:opacity-100 group-focus-within/summary:opacity-100 sm:block">
          <span className="block font-bold uppercase tracking-[0.1em] text-white/60">Semana · {rangeLabel}</span>
          <span className="mt-0.5 block">{hasActivity ? `${lines.toLocaleString("es-AR")} líneas · ${orders.toLocaleString("es-AR")} pedidos` : "Sin actividad registrada"}</span>
          {isCurrentWeek && <span className="mt-0.5 block text-white/65">Total parcial: semana en curso.</span>}
        </div>
      </td>
    </tr>
  );
}

export function ExecutiveCalendarIndicator({ initialDate }: { initialDate: string }) {
  const today = useMemo(() => dateFromKey(initialDate), [initialDate]);
  const [date, setDate] = useState<Date | undefined>(today);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [data, setData] = useState<DailyLinesResponse | null>(null);
  const [weekData, setWeekData] = useState<DailyLinesResponse | null>(null);
  const [trendData, setTrendData] = useState<DailyLinesResponse | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("loading");
  const [trendState, setTrendState] = useState<RequestState>("loading");
  const [retry, setRetry] = useState(0);
  const range = useMemo(() => monthRange(month), [month]);
  const weekRange = useMemo(() => calendarWeekRange(month), [month]);
  const trendRange = useMemo(() => {
    const from = new Date(today);
    from.setDate(from.getDate() - 92);
    return { from: dateKey(from), to: dateKey(today) };
  }, [today]);

  useEffect(() => {
    const controller = new AbortController();
    async function getMetrics(target: { from: string; to: string }) {
      const response = await fetch(`/api/executive/daily-lines?${new URLSearchParams(target)}`, { cache: "no-store", signal: controller.signal });
      const payload = await response.json() as DailyLinesResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudieron consultar los indicadores.");
      return payload;
    }
    async function load() {
      const [calendarResult, weekResult, trendResult] = await Promise.allSettled([
        getMetrics(range),
        getMetrics(weekRange),
        getMetrics(trendRange),
      ]);
      if (controller.signal.aborted) return;
      if (calendarResult.status === "fulfilled") {
        setData(calendarResult.value);
        setRequestState(calendarResult.value.days.length ? "ready" : "empty");
      } else {
        console.error("Error cargando líneas diarias:", calendarResult.reason);
        setData(null);
        setRequestState("error");
      }
      if (weekResult.status === "fulfilled") {
        setWeekData(weekResult.value);
      } else {
        console.error("Error cargando totales semanales:", weekResult.reason);
        setWeekData(null);
      }
      if (trendResult.status === "fulfilled") {
        setTrendData(trendResult.value);
        setTrendState(trendResult.value.days.length ? "ready" : "empty");
      } else {
        console.error("Error cargando evolución:", trendResult.reason);
        setTrendData(null);
        setTrendState("error");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), TWO_HOURS_MS);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [range, retry, trendRange, weekRange]);

  const metrics = useMemo(() => new Map(data?.days.map((metric) => [metric.date, metric]) ?? []), [data]);
  const weekMetrics = useMemo(() => new Map(weekData?.days.map((metric) => [metric.date, metric]) ?? []), [weekData]);
  const monthlySummary = useMemo(() => {
    if (!data) return null;

    const lines = data.days.reduce((total, metric) => total + metric.lines, 0);
    const orders = data.days.reduce((total, metric) => total + metric.orders, 0);

    return {
      lines,
      orders,
      averageLines: data.averageLines,
      linesPerOrder: orders > 0 ? lines / orders : 0,
    };
  }, [data]);
  const selected = date ? metrics.get(dateKey(date)) : undefined;
  const selectedLabel = date ? new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date) : null;
  const updatedAt = trendData?.updatedAt ?? data?.updatedAt;
  const updatedLabel = updatedAt ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(updatedAt)) : null;
  const DayButton = useCallback((props: DayButtonProps) => <ExecutiveDayButton {...props} metric={metrics.get(dateKey(props.day.date))} />, [metrics]);
  const Week = useCallback((props: WeekProps) => <ExecutiveWeek {...props} metrics={weekMetrics} today={today} />, [today, weekMetrics]);
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const isAtToday = isCurrentMonth && Boolean(date && dateKey(date) === dateKey(today));

  function changeMonth(next: Date) {
    setMonth(next);
    setData(null);
    setWeekData(null);
    setRequestState("loading");
  }

  function goToToday() {
    setDate(today);
    if (!isCurrentMonth) changeMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12));
  }

  function retryConnection() {
    setRequestState("loading");
    setTrendState("loading");
    setRetry((value) => value + 1);
  }

  return (
    <section className="mt-5 w-full" aria-labelledby="executive-indicators-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
        <h2 id="executive-indicators-title" className="text-xl font-semibold tracking-[-0.025em] text-[var(--navy)]">Indicadores de negocio</h2>
        <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{updatedLabel ? `Última actualización · ${updatedLabel}` : requestState === "loading" ? "Leyendo última actualización" : "Actualización no disponible"}</span>
      </div>

      <div className="space-y-[7px]">
        <article className="rounded-[24px] border border-[var(--line)] bg-white p-4 shadow-[0_18px_48px_-40px_rgba(14,40,65,0.5)] sm:p-5" aria-label="Resumen del mes visible">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Líneas del mes", value: monthlySummary?.lines.toLocaleString("es-AR"), background: "#174d70", border: "#174d70", labelColor: "#cfe5f1", valueColor: "#ffffff", dot: "#8bc3df" },
              { label: "Pedidos del mes", value: monthlySummary?.orders.toLocaleString("es-AR"), background: "#34779f", border: "#34779f", labelColor: "#e1eff6", valueColor: "#ffffff", dot: "#b9dbea" },
              { label: "Promedio diario", value: monthlySummary?.averageLines.toLocaleString("es-AR", { maximumFractionDigits: 1 }), background: "#b8d6e4", border: "#a7cbdc", labelColor: "#275f7f", valueColor: "#123f5b", dot: "#3f7f9f" },
              { label: "Líneas por pedido", value: monthlySummary?.linesPerOrder.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }), background: "#eef5f9", border: "#d7e6ee", labelColor: "#5f879d", valueColor: "#285d7b", dot: "#79a3ba" },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="relative flex min-h-16 items-center justify-between gap-3 overflow-hidden rounded-[16px] border px-3.5 py-2.5 sm:px-4"
                style={{ borderColor: kpi.border, backgroundColor: kpi.background }}
              >
                <p className="flex items-center gap-2 text-[9px] font-bold uppercase leading-4 tracking-[0.12em]" style={{ color: kpi.labelColor }}>
                  <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: kpi.dot }} aria-hidden="true" />
                  {kpi.label}
                </p>
                <p className="shrink-0 text-lg font-semibold tracking-[-0.035em]" style={{ color: kpi.valueColor }}>{kpi.value ?? "—"}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[24px] border border-[var(--line)] bg-white p-4 shadow-[0_18px_48px_-40px_rgba(14,40,65,0.5)] sm:p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
            <div className="min-w-0 lg:pr-1">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div><h3 className="text-sm font-semibold text-[var(--navy)]">Líneas por día</h3><p className="mt-1 text-xs text-[var(--muted)]">Cantidad de códigos procesados por pedido.</p></div>
              <div className="flex items-center gap-2 text-[9px] font-semibold text-[var(--muted)]" aria-label="Escala de rendimiento"><span><i className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500" />A</span><span><i className="mr-1 inline-block size-1.5 rounded-full bg-amber-400" />B</span><span><i className="mr-1 inline-block size-1.5 rounded-full bg-red-500" />C</span></div>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={goToToday}
                disabled={isAtToday}
                aria-label="Volver al día de hoy"
                className="absolute right-[4.75rem] top-0 z-10 flex h-8 items-center rounded-lg bg-[var(--navy-soft)] px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--blue)] transition hover:bg-[var(--soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/35 disabled:cursor-default disabled:opacity-40"
              >
                Hoy
              </button>
              <Calendar mode="single" month={month} onMonthChange={changeMonth} selected={date} onSelect={setDate} showOutsideDays={false} timeZone="America/Argentina/Buenos_Aires" noonSafe components={{ DayButton, Week, Weekdays: ExecutiveWeekdays }} classNames={{ root: "!w-full !p-0", months: "!w-full", month: "!w-full !space-y-1.5", month_caption: "!h-9 !justify-start px-2", caption_label: "!text-base !text-[var(--blue)]", nav: "absolute right-1 top-0 flex items-center gap-1", button_previous: "!text-[var(--blue)]", button_next: "!text-[var(--blue)]", month_grid: "!w-full", weekdays: "!grid !grid-cols-7 sm:!grid-cols-[repeat(7,minmax(0,1fr))_76px]", weekday: "!w-auto !py-1.5", week: "!mt-1 !grid !grid-cols-7 sm:!grid-cols-[repeat(7,minmax(0,1fr))_76px]", day: "!h-11 !w-auto sm:!h-12", day_button: "!h-11 !rounded-xl sm:!h-12" }} />
            </div>
            </div>

            <aside className="flex min-h-[390px] flex-col rounded-[20px] border border-[var(--line)] bg-[var(--navy-soft)]/55 p-4 sm:p-5" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Últimos registros</p><h3 className="mt-1 text-sm font-semibold text-[var(--navy)]">Evolución reciente</h3></div>
              <span className="rounded-full border border-white/90 bg-white/65 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">30 días</span>
            </div>
            <div className="mt-4 flex-1">
              {trendState === "ready" && trendData ? <TrendChart days={trendData.days} /> : <div className="grid min-h-56 place-items-center rounded-[15px] border border-white/90 bg-white/55 px-5 text-center text-xs leading-5 text-[var(--muted)]">{trendState === "loading" ? "Preparando evolución…" : trendState === "error" ? "No se pudo consultar la evolución." : "Todavía no hay registros suficientes para mostrar."}</div>}
            </div>
            <div className="mt-4 border-t border-[var(--line)] pt-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Día seleccionado</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0"><p className="text-xs font-semibold capitalize leading-5 text-[var(--navy)]">{selectedLabel ?? "Seleccioná una fecha."}</p>{selected && <p className={`mt-1 text-[10px] font-bold ${classText[selected.classification]}`}>{selected.classification} · {classLabel[selected.classification]}</p>}</div>
                {selected ? <div className="text-right"><p className={`text-xl font-semibold tracking-[-0.035em] ${classText[selected.classification]}`}>{selected.lines.toLocaleString("es-AR")}</p><p className="mt-0.5 text-[9px] text-[var(--muted)]">{selected.orders.toLocaleString("es-AR")} pedidos</p></div> : requestState === "error" ? <button type="button" onClick={retryConnection} className="text-xs font-semibold text-[var(--blue)] hover:underline">Reintentar</button> : <p className="text-xs font-semibold text-[var(--navy)]">{requestState === "loading" ? "Consultando…" : "Sin actividad"}</p>}
              </div>
            </div>
            </aside>
          </div>
        </article>
      </div>
    </section>
  );
}
