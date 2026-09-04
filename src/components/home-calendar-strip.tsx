"use client";

import { CalendarDays, Gift } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DayButton as ReactDayPickerDayButton, type DayButtonProps } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import birthdays from "@/lib/birthdays.json";
import { portalEvents, type PortalEvent } from "@/lib/portal-events";

const TIME_ZONE = "America/Argentina/Buenos_Aires";
const DAY_IN_MS = 86_400_000;

type CalendarDay = {
  date: Date;
  key: string;
  dayName: string;
  dayNumber: string;
  isToday: boolean;
  isSelected: boolean;
  events: PortalEvent[];
  birthdays: Birthday[];
};

type Birthday = (typeof birthdays)[number];

type NextBirthday = {
  birthday: Birthday;
  date: Date;
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

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthDayKey(date: Date) {
  return toLocalDateKey(date).slice(5);
}

function getBirthdaysForDate(date: Date) {
  const monthDay = toMonthDayKey(date);
  return birthdays.filter((birthday) => birthday.birthDate.slice(5) === monthDay);
}

function getHolidaysForDate(date: Date) {
  const key = toLocalDateKey(date);
  return portalEvents.filter((event) => event.type === "holiday" && event.date === key);
}

function CalendarEventDayButton({ day, modifiers, children, ...buttonProps }: DayButtonProps) {
  const hasBirthday = modifiers.birthday;
  const hasHoliday = modifiers.holiday;
  const isSelected = modifiers.selected;

  return (
    <ReactDayPickerDayButton day={day} modifiers={modifiers} {...buttonProps}>
      <span>{children}</span>
      {(hasBirthday || hasHoliday) && (
        <span className="pointer-events-none absolute bottom-0.5 left-1/2 flex -translate-x-1/2 items-center gap-0.5" aria-hidden="true">
          {hasBirthday && (
            <span className={`h-1 w-2.5 rounded-full ${isSelected ? "bg-white" : "bg-[var(--blue)]"}`} />
          )}
          {hasHoliday && (
            <span className={`size-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[var(--blue)]"}`} />
          )}
        </span>
      )}
    </ReactDayPickerDayButton>
  );
}

function formatCountdown(days: number) {
  if (days === 0) return "Es hoy";
  if (days === 1) return "Falta 1 día";
  return `Faltan ${days} días`;
}

function capitalizeFirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPersonName(value: string) {
  return value
    .toLocaleLowerCase("es-AR")
    .replace(/(^|[\s'-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("es-AR"));
}

function getNextBirthday(today: Date): NextBirthday | null {
  return birthdays
    .map((birthday) => {
      const [, month, day] = birthday.birthDate.split("-").map(Number);
      let date = new Date(Date.UTC(today.getUTCFullYear(), month - 1, day, 12));

      if (date < today) {
        date = new Date(Date.UTC(today.getUTCFullYear() + 1, month - 1, day, 12));
      }

      return { birthday, date };
    })
    .sort(
      (first, second) =>
        first.date.getTime() - second.date.getTime() ||
        first.birthday.name.localeCompare(second.birthday.name, "es-AR"),
    )[0] ?? null;
}

export function HomeCalendarStrip({ now }: { now: Date | null }) {
  const [highlight, setHighlight] = useState<"holiday" | "birthday">("holiday");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();

  useEffect(() => {
    const timer = window.setInterval(
      () => setHighlight((current) => (current === "holiday" ? "birthday" : "holiday")),
      6_000,
    );

    return () => window.clearInterval(timer);
  }, []);

  const calendar = useMemo(() => {
    if (!now) return null;

    const parts = getDateParts(now);
    const today = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
    const todayKey = toDateKey(today);
    const visibleDate = selectedDate
      ? new Date(Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 12))
      : today;
    const selectedKey = selectedDate ? toDateKey(visibleDate) : null;
    const days: CalendarDay[] = Array.from({ length: 8 }, (_, index) => {
      const date = new Date(visibleDate.getTime() + (index - 3) * DAY_IN_MS);
      const key = toDateKey(date);

      return {
        date,
        key,
        dayName: new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" })
          .format(date)
          .replace(".", ""),
        dayNumber: new Intl.DateTimeFormat("es-AR", { day: "numeric", timeZone: "UTC" }).format(date),
        isToday: key === todayKey,
        isSelected: key === selectedKey,
        events: portalEvents.filter((event) => event.date === key),
        birthdays: getBirthdaysForDate(date),
      };
    });
    const nextEvent = portalEvents
      .filter((event) => event.date >= todayKey)
      .sort((first, second) => first.date.localeCompare(second.date))[0];

    const nextBirthday = getNextBirthday(today);

    return { today, days, nextEvent, nextBirthday };
  }, [now, selectedDate]);

  if (!calendar) {
    return <div className="mt-4 h-24 animate-pulse rounded-[24px] border border-[var(--line)] bg-white/70" aria-hidden="true" />;
  }

  const nextEventDate = calendar.nextEvent ? dateFromKey(calendar.nextEvent.date) : null;
  const daysUntilEvent = nextEventDate
    ? Math.round((nextEventDate.getTime() - calendar.today.getTime()) / DAY_IN_MS)
    : null;
  const daysUntilBirthday = calendar.nextBirthday
    ? Math.round((calendar.nextBirthday.date.getTime() - calendar.today.getTime()) / DAY_IN_MS)
    : null;
  const showBirthday = highlight === "birthday" && calendar.nextBirthday && daysUntilBirthday !== null;
  const calendarToday = new Date(
    calendar.today.getUTCFullYear(),
    calendar.today.getUTCMonth(),
    calendar.today.getUTCDate(),
  );

  function selectCalendarDate(date: Date | undefined) {
    if (!date) return;
    setSelectedDate(date);
  }

  const selectedCalendarDate = selectedDate ?? calendarToday;
  const selectedBirthdays = getBirthdaysForDate(selectedCalendarDate);
  const selectedHolidays = getHolidaysForDate(selectedCalendarDate);

  return (
    <section
      className="mt-4 grid rounded-[24px] border border-[var(--line)] bg-white shadow-[0_20px_50px_-42px_rgba(14,40,65,0.5)] lg:grid-cols-[minmax(0,1fr)_340px]"
      aria-label="Calendario y próximos eventos"
    >
      <div className="grid min-h-[99px] grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[64px_minmax(0,1fr)]">
        <div className="flex items-center justify-center rounded-tl-[23px] border-r border-[var(--line)] bg-[var(--navy-soft)]/45 lg:rounded-bl-[23px]">
          <div className="relative">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Abrir calendario"
                  aria-describedby="calendar-trigger-tooltip"
                  className="peer grid size-9 shrink-0 place-items-center rounded-full bg-white text-[var(--blue)] shadow-sm transition hover:bg-[var(--navy)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/35"
                >
                  <CalendarDays aria-hidden="true" className="size-[18px]" strokeWidth={1.8} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="center" side="right" sideOffset={12}>
                <Card className="p-0">
                  <CardContent className="p-0">
                  <Calendar
                    classNames={{
                      root: "!p-2",
                      month: "!space-y-2",
                      month_caption: "ms-2.5 justify-start",
                      nav: "flex items-center w-full absolute -top-1 inset-x-0 justify-end",
                      weekday: "!py-1.5",
                      day: "!size-8",
                      day_button: "!size-8",
                    }}
                    components={{ DayButton: CalendarEventDayButton }}
                    labels={{
                      labelDayButton: (date) => {
                        const birthdayNames = getBirthdaysForDate(date).map((birthday) => formatPersonName(birthday.name));
                        const holidayNames = getHolidaysForDate(date).map((event) => event.title);
                        const details = [...birthdayNames.map((name) => `Cumpleaños de ${name}`), ...holidayNames];
                        const formattedDate = capitalizeFirst(
                          new Intl.DateTimeFormat("es-AR", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }).format(date),
                        );
                        return details.length > 0 ? `${formattedDate}. ${details.join(". ")}` : formattedDate;
                      },
                    }}
                    mode="single"
                    modifiers={{
                      birthday: (date) => getBirthdaysForDate(date).length > 0,
                      holiday: (date) => getHolidaysForDate(date).length > 0,
                    }}
                    onSelect={selectCalendarDate}
                    selected={selectedCalendarDate}
                    timeZone={TIME_ZONE}
                    noonSafe
                  />
                    <div className="border-t border-[var(--line)] bg-[var(--navy-soft)]/35 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                      {capitalizeFirst(
                        new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(
                          selectedCalendarDate,
                        ),
                      )}
                    </p>
                    {selectedBirthdays.length === 0 && selectedHolidays.length === 0 ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">Sin cumpleaños ni feriados.</p>
                    ) : (
                      <div className="mt-1.5 space-y-1.5">
                        {selectedBirthdays.map((birthday) => (
                          <div key={birthday.name} className="flex items-start gap-2 text-xs text-[var(--navy)]">
                            <Gift className="mt-px size-3.5 shrink-0 text-[var(--blue)]" strokeWidth={2} aria-hidden="true" />
                            <span>Cumpleaños de {formatPersonName(birthday.name)}</span>
                          </div>
                        ))}
                        {selectedHolidays.map((event) => (
                          <div key={event.id} className="flex items-start gap-2 text-xs text-[var(--navy)]">
                            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--blue)]" aria-hidden="true" />
                            <span>{event.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    </div>
                  </CardContent>
                </Card>
              </PopoverContent>
            </Popover>
            <span
              id="calendar-trigger-tooltip"
              role="tooltip"
              className="pointer-events-none absolute left-full top-1/2 z-40 ml-2.5 w-max -translate-y-1/2 translate-x-1 rounded-lg bg-[var(--navy)] px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition duration-150 before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-[var(--navy)] peer-hover:translate-x-0 peer-hover:opacity-100 peer-focus-visible:translate-x-0 peer-focus-visible:opacity-100 peer-data-[state=open]:hidden"
            >
              Abrir calendario
            </span>
          </div>
        </div>

        <div className="min-w-0 px-3 py-3 sm:px-5">
          <div className="grid grid-cols-8 gap-0.5 sm:gap-1">
            {calendar.days.map((day) => {
              const isFocused = day.isSelected || (!selectedDate && day.isToday);
              return (
                <time
                  key={day.key}
                  dateTime={day.key}
                  aria-current={day.isToday ? "date" : undefined}
                  aria-selected={day.isSelected || undefined}
                  className={`flex min-w-0 flex-col items-center justify-center rounded-xl px-0.5 py-1.5 transition-colors ${
                    isFocused
                      ? "bg-[var(--navy)] text-white"
                      : day.isToday
                        ? "bg-[var(--navy-soft)] text-[var(--navy)] ring-1 ring-inset ring-[var(--blue)]/30"
                        : "text-[var(--navy)]"
                  }`}
                >
                  <span className="text-base font-semibold leading-none sm:text-lg">{day.dayNumber}</span>
                  <span className={`mt-0.5 text-[9px] capitalize sm:text-[10px] ${isFocused ? "text-white/65" : "text-[var(--muted)]"}`}>
                    {day.dayName}
                  </span>
                </time>
              );
            })}
          </div>

          <div className="relative mt-2 grid grid-cols-8 gap-0.5 px-2 sm:gap-1">
            <span className="absolute left-[6%] right-[6%] top-1/2 border-t border-dashed border-[var(--line)]" />
            {calendar.days.map((day) => {
              const hasHoliday = day.events.some((event) => event.type === "holiday");
              const hasBirthday = day.birthdays.length > 0;

              return (
                <span key={day.key} className="relative flex min-h-4 items-center justify-center">
                  {hasBirthday ? (
                    <span
                      className="group relative z-20 flex min-w-4 cursor-help items-center justify-center rounded-full bg-white px-0.5 text-[var(--blue)] ring-2 ring-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/40"
                      tabIndex={0}
                      aria-describedby={`birthday-tooltip-${day.key}`}
                    >
                      <Gift className="size-3.5" strokeWidth={2.1} aria-hidden="true" />
                      {day.birthdays.length > 1 && <span className="ml-px text-[8px] font-bold">{day.birthdays.length}</span>}
                      {hasHoliday && <span className="ml-0.5 size-1.5 rounded-full bg-[var(--blue)]" aria-hidden="true" />}
                      <span
                        id={`birthday-tooltip-${day.key}`}
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2.5 w-max max-w-60 -translate-x-1/2 translate-y-1 rounded-xl bg-[var(--navy)] px-3 py-2 text-left text-white opacity-0 shadow-[0_12px_30px_-12px_rgba(14,40,65,0.75)] transition duration-150 before:absolute before:left-1/2 before:top-full before:-translate-x-1/2 before:border-[5px] before:border-transparent before:border-t-[var(--navy)] group-hover:translate-y-0 group-hover:opacity-100 group-focus:translate-y-0 group-focus:opacity-100"
                      >
                        <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-white/60">
                          {day.birthdays.length > 1 ? `${day.birthdays.length} cumpleaños` : "Cumpleaños"}
                        </span>
                        <span className="mt-1 block text-[11px] font-semibold leading-4">
                          {day.birthdays.map((birthday) => formatPersonName(birthday.name)).join(" · ")}
                        </span>
                        <span className="mt-0.5 block text-[10px] font-normal capitalize text-white/65">
                          {new Intl.DateTimeFormat("es-AR", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            timeZone: "UTC",
                          }).format(day.date)}
                        </span>
                      </span>
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className={`relative z-10 size-2 rounded-full ring-4 ring-white ${
                        hasHoliday ? "bg-[var(--blue)]" : day.isToday ? "bg-[var(--navy)]" : "bg-[#d9e0e5]"
                      }`}
                    />
                  )}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex min-h-[99px] items-center gap-3 rounded-b-[23px] border-t border-[var(--line)] bg-[var(--navy-soft)]/45 px-5 py-3.5 lg:rounded-bl-none lg:rounded-r-[23px] lg:border-l lg:border-t-0">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--blue)] shadow-sm" aria-hidden="true">
          {showBirthday ? (
            <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 11.25h14v8H5v-8Zm7 0v8m-8.5-8h17M7.25 8.5C5.75 8.5 5 7.72 5 6.75s.75-1.75 2.25-1.75C9.5 5 12 8.5 12 8.5H7.25Zm9.5 0C18.25 8.5 19 7.72 19 6.75S18.25 5 16.75 5C14.5 5 12 8.5 12 8.5h4.75Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75v2.5m10.5-2.5v2.5M4.5 9.25h15m-13.25-4h11.5A1.75 1.75 0 0 1 19.5 7v11.25A1.75 1.75 0 0 1 17.75 20H6.25a1.75 1.75 0 0 1-1.75-1.75V7a1.75 1.75 0 0 1 1.75-1.75Z" />
            </svg>
          )}
        </span>
        <div key={showBirthday ? "birthday" : "holiday"} className="calendar-highlight-enter min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[var(--blue)]">
            {showBirthday ? "Próximo cumpleaños" : "Próximo feriado"}
          </p>
          {showBirthday ? (
            <>
              <p className="mt-0.5 text-sm font-semibold leading-[1.15rem] text-[var(--navy)]" title={calendar.nextBirthday?.birthday.name}>
                {formatPersonName(calendar.nextBirthday!.birthday.name)}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                {capitalizeFirst(new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(calendar.nextBirthday!.date))}
                <span aria-hidden="true"> · </span>
                <span className="normal-case">{formatCountdown(daysUntilBirthday!)}</span>
              </p>
            </>
          ) : calendar.nextEvent && nextEventDate && daysUntilEvent !== null ? (
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
