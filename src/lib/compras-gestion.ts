// Gestión combines a read-only plan snapshot with authoritative decisions.
import {
  brandAliases, brandConfig, columns, dashboardNumber, formatDate,
  normalizeBrand, text, value, type SheetRows, type SheetValue,
} from "@/lib/compras-dashboard";
import { sheetSerialDate } from "@/lib/compras-dates";

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
  version: number;
  requiereRevision: boolean;
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

export function resolveGestionBrand(marcas: string[], requested: string) {
  const brand = requested.trim();
  if (!brand) return "";
  if (marcas.includes(brand)) return brand;
  const matches = marcas.filter((option) => normalizeBrand(option) === normalizeBrand(brand));
  return matches.length === 1 ? matches[0] : brand;
}

export const GESTION_ESTADOS = [
  "PENDIENTE", "COTIZAR", "APROBADO", "NO COMPRAR", "POSTERGAR", "ENVIADO A COMPRA",
];

function decisionDate(input: SheetValue, timeZone: string) {
  if (!input) return "";
  // Sheets returns native date cells as serial numbers, not Apps Script Date objects.
  const date = typeof input === "number"
    ? sheetSerialDate(input, timeZone)
    : new Date(String(input));
  return Number.isNaN(date.getTime()) ? String(input) : formatDate(date);
}

export function calculateComprasGestion(
  sheets: { gestion: SheetRows; config: SheetRows; alias: SheetRows },
  now = new Date(),
  sheetTimeZone = "America/Argentina/Buenos_Aires",
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
      fechaDecision: decisionDate(value(row, cFecha), sheetTimeZone),
      version: 0,
      requiereRevision: false,
    });
  }

  return {
    ...empty, total: registros.length, registros,
    riesgos: Array.from(riesgos).sort(),
    marcas: Array.from(marcas).sort((a, b) => a.localeCompare(b)),
  };
}

export type GestionDecision = {
  sku: string;
  estado_gestion: string | null;
  cantidad_decidida: number;
  responsable: string;
  observacion: string;
  fecha_decision: string | null;
  requiere_revision: boolean;
  version: number;
};

export function overlayGestionDecisions(base: ComprasGestion, decisions: GestionDecision[]): ComprasGestion {
  const bySku = new Map(decisions.map((decision) => [decision.sku, decision]));
  return {
    ...base,
    registros: base.registros.map((registro) => {
      const decision = bySku.get(registro.sku.trim().toUpperCase());
      if (!decision) return registro;
      return {
        ...registro,
        estadoGestion: decision.requiere_revision ? "SIN RESOLVER" : decision.estado_gestion ?? "PENDIENTE",
        cantidadDecidida: decision.cantidad_decidida,
        responsable: decision.responsable,
        observacion: decision.observacion,
        fechaDecision: decision.fecha_decision ? formatDate(new Date(decision.fecha_decision)) : "",
        version: decision.version,
        requiereRevision: decision.requiere_revision,
      };
    }),
    estados: [...base.estados, "SIN RESOLVER"],
  };
}

export function overlayGestionSheetRows(rows: SheetRows, decisions: GestionDecision[]): SheetRows {
  if (!rows.length) return rows;
  const column = columns(rows[0]);
  const indexes = {
    sku: column("SKU"), estado: column("ESTADO_GESTION"), cantidad: column("CANTIDAD_DECIDIDA"),
    responsable: column("RESPONSABLE"), observacion: column("OBSERVACION"), fecha: column("FECHA_DECISION"),
  };
  if (Object.values(indexes).some((index) => index < 0)) throw new Error("La hoja de Gestión no contiene las columnas de decisión.");
  const bySku = new Map(decisions.map((decision) => [decision.sku, decision]));
  return [rows[0], ...rows.slice(1).map((original) => {
    const decision = bySku.get(text(value(original, indexes.sku)).toUpperCase());
    if (!decision) return original;
    const row = [...original];
    row[indexes.estado] = decision.requiere_revision ? "SIN RESOLVER" : decision.estado_gestion ?? "PENDIENTE";
    row[indexes.cantidad] = decision.cantidad_decidida;
    row[indexes.responsable] = decision.responsable;
    row[indexes.observacion] = decision.observacion;
    row[indexes.fecha] = decision.fecha_decision ?? "";
    return row;
  })];
}

export function normalizeGestionChanges(input: unknown) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 4000) {
    throw new Error("Seleccioná entre 1 y 4.000 SKU para guardar.");
  }
  const skus = new Set<string>();
  return input.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Cambio de Gestión inválido.");
    const candidate = item as Record<string, unknown>;
    const sku = typeof candidate.sku === "string" ? candidate.sku.trim().toUpperCase() : "";
    const estadoGestion = candidate.estadoGestion;
    const cantidadDecidida = candidate.cantidadDecidida;
    const observacion = candidate.observacion;
    const version = candidate.version;
    if (!sku || sku.length > 100 || skus.has(sku) || !GESTION_ESTADOS.includes(String(estadoGestion)) ||
      !Number.isSafeInteger(cantidadDecidida) || Number(cantidadDecidida) < 0 ||
      typeof observacion !== "string" || observacion.length > 1000 ||
      !Number.isSafeInteger(version) || Number(version) < 1) {
      throw new Error(`Cambio de Gestión inválido${sku ? ` para ${sku}` : ""}.`);
    }
    skus.add(sku);
    return { sku, estadoGestion: String(estadoGestion), cantidadDecidida: Number(cantidadDecidida), observacion, version: Number(version) };
  });
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
