"use client";

import { DayPicker, type ClassNames, type DayPickerProps } from "react-day-picker";
import { es } from "react-day-picker/locale";

const baseClassNames = {
  root: "w-fit p-3",
  months: "relative flex flex-col",
  month: "space-y-3",
  month_caption: "relative flex h-10 items-center justify-center",
  caption_label: "text-sm font-semibold capitalize text-[var(--navy)]",
  nav: "flex items-center gap-1",
  button_previous: "grid size-8 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/35",
  button_next: "grid size-8 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/35",
  chevron: "size-4 fill-current",
  month_grid: "w-full border-collapse",
  weekdays: "flex",
  weekday: "w-9 py-2 text-center text-[10px] font-bold uppercase text-[var(--muted)]",
  week: "mt-1 flex w-full",
  day: "relative size-9 p-0 text-center text-sm",
  day_button: "grid size-9 place-items-center rounded-xl text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--navy-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/35",
  selected: "[&>button]:bg-[var(--navy)] [&>button]:font-semibold [&>button]:text-white [&>button]:hover:bg-[var(--navy)]",
  today: "[&>button]:ring-1 [&>button]:ring-[var(--blue)]/45",
  outside: "opacity-35",
  disabled: "pointer-events-none opacity-30",
  hidden: "invisible",
} satisfies Partial<ClassNames>;

function mergeClassNames(overrides?: Partial<ClassNames>) {
  const keys = new Set([...Object.keys(baseClassNames), ...Object.keys(overrides ?? {})]);
  return Object.fromEntries(
    [...keys].map((key) => [
      key,
      [baseClassNames[key as keyof typeof baseClassNames], overrides?.[key as keyof ClassNames]]
        .filter(Boolean)
        .join(" "),
    ]),
  ) as Partial<ClassNames>;
}

export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      className={className}
      classNames={mergeClassNames(classNames)}
      locale={es}
      navLayout="after"
      showOutsideDays
      {...props}
    />
  );
}
