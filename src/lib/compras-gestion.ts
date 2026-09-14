// Read-only port of obtenerGestionComprasPortal and its legacy filters/summary.
import {
  brandAliases, brandConfig, columns, dashboardNumber, formatDate,
  normalizeBrand, text, value, type SheetRows, type SheetValue,
} from "@/lib/compras-dashboard";

export type GestionRegistro = {
  sku: string;
  descripcion: string;
  marca: string;
  origen: string;
  compraHabilitada: boolean;
  coberturaObjetivo: number;
  coberturaActual: number;
  riesgo: string;
  compraSugerida: number;
  estadoGestion: string;
  cantidadDecidida: number;
  responsable: string;
  observacion: string;
  fechaDecision: string;
};

export type ComprasGestion = {
  actualizado: string;
  total: number;
  registros: GestionRegistro[];
  estados: string[];
  riesgos: string[];
  marcas: string[];
};

export type GestionFilters = {
  texto: string;
  riesgo: string;
  estado: string;
  marca: string;
  politica: string;
};

export const GESTION_ESTADOS = [
  "PENDIENTE", "COTIZAR", "APROBADO", "NO COMPRAR", "POSTERGAR", "ENVIADO A COMPRA",
];

function decisionDate(input: SheetValue) {
  if (!input) return "";
  // Sheets returns native date cells as serial numbers, not Apps Script Date objects.
  const date = typeof input === "number"
    ? new Date(Date.UTC(1899, 11, 30) + input * 86_400_000 + 3 * 3_600_000)
    : new Date(String(input));
  return Number.isNaN(date.getTime()) ? String(input) : formatDate(date);
}

export function calculateComprasGestion(
  sheets: { gestion: SheetRows; config: SheetRows; alias: SheetRows },
  now = new Date(),
): ComprasGestion {
  const { gestion } = sheets;
  const empty = {
    actualizado: formatDate(now), total: 0, registros: [] as GestionRegistro[],
    estados: [...GESTION_ESTADOS], riesgos: [] as string[], marcas: [] as string[],
  };
  if (gestion.length < 2) return empty;

  const column = columns(gestion[0]);
  const cSku = column("SKU");
  const cDescripcion = column("DESCRIPCION");
  const cMarca = column("MARCA");
  const cRiesgo = column("RIESGO");
  const cCompra = column("COMPRA_SUGERIDA");
  const cCobertura = column("COBERTURA_ACTUAL");
  const cEstado = column("ESTADO_GESTION");
  const cCantidad = column("CANTIDAD_DECIDIDA");
  const cResponsable = column("RESPONSABLE");
  const cObservacion = column("OBSERVACION");
  const cFecha = column("FECHA_DECISION");
  if ([cSku, cRiesgo, cCompra, cEstado].some((index) => index < 0)) {
    throw new Error("GESTION_COMPRAS_ACTIVA no contiene las columnas requeridas.");
  }

  const config = brandConfig(sheets.config);
  const aliases = brandAliases(sheets.alias);
  const registros: GestionRegistro[] = [];
  const riesgos = new Set<string>();
  const marcas = new Set<string>();

  for (const row of gestion.slice(1)) {
    const sku = text(value(row, cSku));
    if (!sku) continue;
    const descripcion = text(value(row, cDescripcion));
    const marca = text(value(row, cMarca) || "SIN MARCA") || "SIN MARCA";
    const resolvedBrand = aliases.get(normalizeBrand(marca)) || marca;
    const policy = config.get(normalizeBrand(resolvedBrand)) || {
      compra: "NO", origen: "SIN CONFIGURAR", objetivo: 0,
    };
    const riesgo = text(value(row, cRiesgo)).toUpperCase();
    const estadoGestion = text(value(row, cEstado) || "PENDIENTE").toUpperCase();
    if (riesgo) riesgos.add(riesgo);
    marcas.add(marca);
    registros.push({
      sku, descripcion, marca,
      origen: policy.origen,
      compraHabilitada: policy.compra === "SI",
      coberturaObjetivo: policy.objetivo,
      coberturaActual: dashboardNumber(value(row, cCobertura)),
      riesgo,
      compraSugerida: dashboardNumber(value(row, cCompra)),
      estadoGestion,
      cantidadDecidida: dashboardNumber(value(row, cCantidad)),
      responsable: text(value(row, cResponsable)),
      observacion: text(value(row, cObservacion)),
      fechaDecision: decisionDate(value(row, cFecha)),
    });
  }

  return {
    ...empty, total: registros.length, registros,
    riesgos: Array.from(riesgos).sort(),
    marcas: Array.from(marcas).sort((a, b) => a.localeCompare(b)),
  };
}

export function filterGestion(registros: GestionRegistro[], filters: GestionFilters) {
  const search = filters.texto.trim().toUpperCase();
  return registros.filter((r) => {
    if (filters.riesgo && r.riesgo !== filters.riesgo) return false;
    if (filters.estado && r.estadoGestion !== filters.estado) return false;
    if (filters.marca && r.marca !== filters.marca) return false;
    if (filters.politica === "COMPRAR" && !r.compraHabilitada) return false;
    if (filters.politica === "NO COMPRAR" && r.compraHabilitada) return false;
    return !search || `${r.sku} ${r.descripcion} ${r.marca}`.toUpperCase().includes(search);
  });
}

export function summarizeGestion(registros: GestionRegistro[]) {
  let pendientes = 0;
  let conDecision = 0;
  let compraSugerida = 0;
  for (const r of registros) {
    if (r.estadoGestion === "PENDIENTE") pendientes++;
    else conDecision++;
    compraSugerida += Number(r.compraSugerida || 0);
  }
  return { total: registros.length, pendientes, conDecision, compraSugerida };
}
