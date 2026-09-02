"use client";

import Image from "next/image";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { signIn } from "next-auth/react";

export function AccessGate() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--canvas)] px-5 py-10 text-[var(--ink)]">
      <span className="absolute -left-32 -top-36 size-[420px] rounded-full border-[52px] border-[var(--blue)]/5" />
      <span className="absolute -bottom-52 -right-36 size-[520px] rounded-full bg-[var(--navy-soft)]/55" />

      <section className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-[var(--line)] bg-white p-7 text-center shadow-[0_32px_80px_-48px_rgba(14,40,65,0.55)] sm:p-9">
        <div className="mx-auto h-14 w-[220px] overflow-hidden">
          <Image src="/grupo-aftermarket.svg" alt="Grupo Aftermarket" width={1280} height={720} priority className="h-auto w-full" />
        </div>

        <span className="mx-auto mt-7 grid size-12 place-items-center rounded-2xl bg-[var(--navy-soft)] text-[var(--blue)]">
          <LockKeyhole aria-hidden="true" className="size-5" strokeWidth={1.8} />
        </span>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.17em] text-[var(--blue)]">Portal interno</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[var(--navy)]">Accedé con tu cuenta corporativa</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--muted)]">Los recursos y aplicaciones de Grupo Aftermarket están disponibles únicamente para usuarios autorizados.</p>

        <button
          type="button"
          onClick={() => signIn("google", { redirectTo: "/" })}
          className="mt-7 flex w-full items-center justify-between rounded-2xl bg-[var(--navy)] px-5 py-4 text-sm font-semibold text-white transition hover:bg-[#173d60]"
        >
          <span>Continuar con Google</span>
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
        <p className="mt-4 text-xs text-[var(--muted)]">Usá tu correo @grupo-aftermarket.com</p>
      </section>
    </main>
  );
}
