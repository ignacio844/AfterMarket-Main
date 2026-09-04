import type { Metadata } from "next";
import { ExternalLink, MapPinned, ReceiptText } from "lucide-react";

const executiveApps = [
  {
    name: "Facturador",
    description: "Emisión y gestión de comprobantes.",
    href: "https://facturador-aftermarket.vercel.app/",
    icon: ReceiptText,
  },
  {
    name: "Mapa Comercial",
    description: "Clientes y oportunidades por zona.",
    href: "https://mapa-comercial-aftermarket.vercel.app/",
    icon: MapPinned,
  },
] as const;

export const metadata: Metadata = {
  title: "Ejecutivo | Grupo Aftermarket",
  description: "Espacio ejecutivo del portal interno de Grupo Aftermarket.",
};

export default function EjecutivoPage() {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10 lg:py-10">
        <section className="executive-hero relative flex min-h-48 items-center overflow-hidden rounded-[28px] bg-[var(--navy)] px-7 py-8 text-white shadow-[0_24px_60px_-36px_rgba(14,40,65,0.72)] sm:px-9">
          <div className="executive-silver-glow absolute inset-y-0 right-0 w-2/3" aria-hidden="true" />
          <svg
            aria-hidden="true"
            viewBox="0 0 760 220"
            preserveAspectRatio="none"
            className="executive-silver-lines absolute inset-y-0 right-0 h-full w-[58%]"
          >
            <path className="executive-silver-line executive-silver-line-soft" d="M92 220C190 132 263 117 363 142c113 29 196 17 313-66 30-21 57-43 84-65" />
            <path className="executive-silver-line" d="M173 220c75-67 147-84 224-55 105 40 191 16 363-119" />
            <path className="executive-silver-line executive-silver-line-bright" d="M328 220c49-45 105-68 165-63 90 8 158-31 267-132" />
          </svg>
          <div className="relative z-10 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Vista ejecutiva</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Ejecutivo</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
              Nueva sección preparada para incorporar la información y las herramientas del espacio ejecutivo.
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-[24px] border border-[var(--line)] bg-white p-4 sm:p-5" aria-labelledby="executive-apps-title">
          <div className="grid items-stretch gap-3 md:grid-cols-[190px_repeat(2,minmax(0,1fr))]">
            <div className="flex flex-col justify-center px-1 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[var(--blue)]">Herramientas</p>
              <h2 id="executive-apps-title" className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[var(--navy)]">
                Accesos rápidos
              </h2>
            </div>

            {executiveApps.map((application) => {
              const Icon = application.icon;

              return (
                <a
                  key={application.name}
                  href={application.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir ${application.name} en una pestaña nueva`}
                  className="group flex min-h-20 items-center gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--canvas)] px-4 py-3 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--blue)] hover:bg-white hover:shadow-[0_14px_34px_-24px_rgba(14,40,65,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/35"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--blue)] shadow-sm transition group-hover:bg-[var(--navy)] group-hover:text-white">
                    <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[var(--navy)]">{application.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{application.description}</span>
                  </span>
                  <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-[var(--muted)] transition group-hover:text-[var(--blue)]" strokeWidth={1.8} />
                </a>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
