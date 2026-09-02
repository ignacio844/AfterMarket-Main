import Link from "next/link";
import { portalAccesses } from "@/lib/portal-data";

export default function AreasPage() {
  const areas = portalAccesses.filter((access) => access.id !== "it");

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <main className="mx-auto max-w-[1440px] px-5 py-10 lg:px-10">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--blue)]">Organización</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[var(--navy)]">Áreas de la compañía</h1>
          <p className="mt-4 leading-7 text-[var(--muted)]">
            Accedé a los recursos de cada equipo. Las áreas se habilitarán progresivamente.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {areas.map((area, index) => (
            <Link key={area.id} href={area.href} className="flex min-h-52 flex-col justify-between rounded-[24px] border border-[var(--line)] bg-white p-6 transition hover:-translate-y-0.5 hover:border-[var(--navy)]">
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs font-bold text-[var(--blue)]">{String(index + 1).padStart(2, "0")}</span>
                <span className="rounded-full bg-[var(--soft)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Próximamente</span>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--blue)]">{area.eyebrow}</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--navy)]">{area.name}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{area.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
