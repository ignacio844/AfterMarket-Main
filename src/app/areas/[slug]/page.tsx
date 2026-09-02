import { notFound } from "next/navigation";
import { portalAccesses } from "@/lib/portal-data";

type AreaPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AreaPage({ params }: AreaPageProps) {
  const { slug } = await params;
  const area = portalAccesses.find((access) => access.id === slug && access.id !== "it");

  if (!area) notFound();

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <main className="mx-auto max-w-[1440px] px-5 py-10 lg:px-10">
        <section className="rounded-[30px] border border-[var(--line)] bg-white p-8 sm:p-11">
          <span className="rounded-full bg-[var(--soft)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Próximamente</span>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-[var(--blue)]">{area.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[var(--navy)] sm:text-5xl">{area.name}</h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">{area.description}</p>
          <div className="mt-12 rounded-[24px] border border-dashed border-[var(--line)] bg-[var(--canvas)] px-6 py-12 text-center">
            <p className="font-semibold text-[var(--navy)]">Sección preparada</p>
            <p className="mt-2 text-sm text-[var(--muted)]">El contenido se incorporará cuando esta área sea habilitada.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
