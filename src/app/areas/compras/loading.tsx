export default function ComprasLoading() {
  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10 lg:py-10">
        <div className="h-48 animate-pulse rounded-[28px] bg-[var(--navy)]" />
        <div className="mt-5 rounded-[24px] border border-[var(--line)] bg-white p-6">
          <p className="text-sm font-semibold text-[var(--navy)]">Cargando Dashboard de Compras…</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Leyendo el modelo y el estado de las fuentes.</p>
        </div>
      </main>
    </div>
  );
}
