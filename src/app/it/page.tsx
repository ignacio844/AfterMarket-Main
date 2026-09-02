import type { LucideIcon } from "lucide-react";
import {
  DatabaseZap,
  ExternalLink,
  ListChecks,
  MapPinned,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";

type Application = {
  name: string;
  category: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const applications: Application[] = [
  {
    name: "Facturador",
    category: "Administración",
    description: "Emisión y gestión de comprobantes operativos.",
    href: "https://facturador-aftermarket.vercel.app/",
    icon: ReceiptText,
  },
  {
    name: "Mapa Comercial",
    category: "Comercial",
    description: "Visualización territorial de clientes y oportunidades.",
    href: "https://mapa-comercial-aftermarket.vercel.app/",
    icon: MapPinned,
  },
  {
    name: "Auditoría",
    category: "Control",
    description: "Seguimiento de controles, hallazgos y acciones.",
    href: "https://auditoria-pro-nachin1.vercel.app/",
    icon: ShieldCheck,
  },
  {
    name: "Códigos Máster",
    category: "Datos",
    description: "Cruce y homologación de códigos SKU entre bases.",
    href: "https://codigosmasteraftermarket.vercel.app/",
    icon: DatabaseZap,
  },
  {
    name: "Project Tracker",
    category: "Proyectos",
    description: "Seguimiento de tareas, responsables y fechas límite.",
    href: "https://after-market-project-tracker.vercel.app/",
    icon: ListChecks,
  },
];

export default function ItPage() {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10 lg:py-10">
        <section className="relative flex min-h-48 items-center overflow-hidden rounded-[28px] bg-[var(--navy)] px-7 py-8 text-white shadow-[0_24px_60px_-36px_rgba(14,40,65,0.72)] sm:px-9">
          <div className="absolute -right-20 -top-32 size-80 rounded-full border border-white/10" />
          <div className="absolute right-20 top-20 size-28 rounded-full border border-white/10" />
          <div className="relative max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Tecnología e innovación</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Aplicaciones internas</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
                Accedé a las soluciones digitales desarrolladas para acompañar la operación de Grupo Aftermarket.
              </p>
          </div>
        </section>

        <section className="pb-12 pt-7" aria-label="Aplicaciones disponibles">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {applications.map((application) => {
              const Icon = application.icon;

              return (
                <article key={application.name} className="shine group flex min-h-72 flex-col rounded-[26px] border border-[var(--line)] bg-white p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid size-12 place-items-center rounded-2xl bg-[var(--navy-soft)] text-[var(--blue)] ring-1 ring-[var(--line)]">
                      <Icon aria-hidden="true" className="size-6" strokeWidth={1.8} />
                    </div>
                  </div>

                  <div className="mt-8 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--blue)]">{application.category}</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[var(--navy)]">{application.name}</h3>
                    <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted)]">{application.description}</p>
                  </div>

                  <a
                    href={application.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir ${application.name} en una pestaña nueva`}
                    className="mt-8 flex items-center justify-between rounded-xl bg-[var(--soft)] px-4 py-3 text-sm font-semibold text-[var(--navy)] transition group-hover:bg-[var(--navy)] group-hover:text-white"
                  >
                    Abrir aplicación
                    <ExternalLink aria-hidden="true" className="size-4" strokeWidth={1.8} />
                  </a>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
