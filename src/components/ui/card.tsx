import type { ComponentProps } from "react";

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={joinClasses(
        "rounded-2xl border border-[var(--line)] bg-white text-[var(--ink)] shadow-[0_22px_60px_-32px_rgba(14,40,65,0.45)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={joinClasses("p-5", className)} {...props} />;
}
