export type PortalEventType = "holiday" | "birthday" | "special";

export type PortalEvent = {
  id: string;
  date: string;
  title: string;
  type: PortalEventType;
};

// Calendario nacional 2026. La estructura admite cumpleaños y eventos internos
// sin acoplarlos al componente visual de Inicio.
export const portalEvents: PortalEvent[] = [
  { id: "new-year-2026", date: "2026-01-01", title: "Año Nuevo", type: "holiday" },
  { id: "carnival-1-2026", date: "2026-02-16", title: "Carnaval", type: "holiday" },
  { id: "carnival-2-2026", date: "2026-02-17", title: "Carnaval", type: "holiday" },
  { id: "tourism-march-2026", date: "2026-03-23", title: "Día no laborable con fines turísticos", type: "holiday" },
  { id: "memory-day-2026", date: "2026-03-24", title: "Día Nacional de la Memoria por la Verdad y la Justicia", type: "holiday" },
  { id: "malvinas-2026", date: "2026-04-02", title: "Día del Veterano y de los Caídos en la Guerra de Malvinas", type: "holiday" },
  { id: "good-friday-2026", date: "2026-04-03", title: "Viernes Santo", type: "holiday" },
  { id: "labour-day-2026", date: "2026-05-01", title: "Día del Trabajador", type: "holiday" },
  { id: "may-revolution-2026", date: "2026-05-25", title: "Día de la Revolución de Mayo", type: "holiday" },
  { id: "guemes-2026", date: "2026-06-15", title: "Paso a la Inmortalidad del General Martín Miguel de Güemes", type: "holiday" },
  { id: "belgrano-2026", date: "2026-06-20", title: "Paso a la Inmortalidad del General Manuel Belgrano", type: "holiday" },
  { id: "independence-2026", date: "2026-07-09", title: "Día de la Independencia", type: "holiday" },
  { id: "tourism-july-2026", date: "2026-07-10", title: "Día no laborable con fines turísticos", type: "holiday" },
  { id: "san-martin-2026", date: "2026-08-17", title: "Paso a la Inmortalidad del General José de San Martín", type: "holiday" },
  { id: "cultural-diversity-2026", date: "2026-10-12", title: "Día del Respeto a la Diversidad Cultural", type: "holiday" },
  { id: "sovereignty-2026", date: "2026-11-23", title: "Día de la Soberanía Nacional", type: "holiday" },
  { id: "tourism-december-2026", date: "2026-12-07", title: "Día no laborable con fines turísticos", type: "holiday" },
  { id: "immaculate-conception-2026", date: "2026-12-08", title: "Inmaculada Concepción de María", type: "holiday" },
  { id: "christmas-2026", date: "2026-12-25", title: "Navidad", type: "holiday" },
];
