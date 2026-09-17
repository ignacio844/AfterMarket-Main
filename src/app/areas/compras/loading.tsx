export default function ComprasLoading() {
  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <main className="mx-auto max-w-[1920px] px-4 py-5 lg:px-5 lg:py-6">
        <div className="h-48 animate-pulse rounded-[28px] bg-[var(--navy)]" />
        <div className="mt-5 rounded-[24px] border border-[var(--line)] bg-white p-6">
          <p className="text-sm font-semibold text-[var(--navy)]">Cargando Compras…</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Leyendo los datos de la vista seleccionada.</p>
        </div>
      </main>
    </div>
  );
}
