// Port of the read-only Dashboard in portal_compras.gs. The upstream model is
// deliberately treated as stored data; this module never recalculates it.
export type SheetValue = string | number | boolean | null;
export type SheetRows = SheetValue[][];

export type DashboardBrand = {
  marca: string;
  origen: string;
  compraHabilitada: boolean;
  coberturaObjetivo: number;
  sinStock: number;
  urgente: number;
  comprar: number;
  revisar: number;
  compra: number;
  consumo12: number;
  consumoTrimestralPromedio: number;
  stockConConsumo: number;
  promedioTotal: number;
  coberturaPromedio: number;
};

export type DashboardSource = {
  fecha: string;
  icono: string;
  color: string;
  fontColor: string;
};

export type ComprasDashboard = {
  actualizado: string;
  usuario: string;
  totalSku: number;
  sinStock: number;
  urgente: number;
  comprar: number;
  revisar: number;
  ok: number;
  sinConsumo: number;
  stock: number;
  pendiente: number;
  compraSugerida: number;
  stockConConsumo: number;
  promedioTotal: number;
  coberturaPromedio: number;
  marcas: DashboardBrand[];
  marcasImportadas: DashboardBrand[];
  marcasNacionales: DashboardBrand[];
  marcasNoCompra: DashboardBrand[];
  fuentes: {
    stockWarnes: DashboardSource;
    stockEscobar: DashboardSource;
    ventas: DashboardSource;
    ordenes: DashboardSource;
  };
};

export type DashboardSheets = {
  modelo: SheetRows;
  config: SheetRows;
  alias: SheetRows;
  controlStock: SheetRows;
  ventas: SheetRows;
  logImportaciones: SheetRows;
};

const TIME_ZONE = "America/Argentina/Buenos_Aires";
const EMPTY_CONFIG = { compra: "NO", origen: "SIN CONFIGURAR", objetivo: 0 };
type BrandConfig = typeof EMPTY_CONFIG;

export function text(value: SheetValue | undefined) {
  return String(value || "").trim();
}

function normalizeHeader(value: SheetValue | undefined) {
  return text(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeBrand(value: SheetValue | undefined) {
  return text(value)
    .replace(/\u00a0/g, " ")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-–—_]+/g, " ")
    .replace(/\s+/g, " ");
}

export function columns(headers: SheetValue[]) {
  const indexes = new Map<string, number>();
  headers.forEach((header, index) => indexes.set(normalizeHeader(header), index));
  return (...names: string[]) => {
    for (const name of names) {
      const index = indexes.get(name);
      if (index !== undefined) return index;
    }
    return -1;
  };
}

export function value(row: SheetValue[], index: number): SheetValue {
  return index < 0 ? "" : (row[index] ?? "");
}

// Same punctuation rules as numeroPortalCompras_ (including its fallbacks).
export function dashboardNumber(input: SheetValue | undefined) {
  if (typeof input === "number") return input;
  let parsed = text(input).replace(/\s/g, "");
  if (!parsed) return 0;
  if (parsed.includes(",") && parsed.includes(".")) {
    parsed = parsed.lastIndexOf(",") > parsed.lastIndexOf(".")
      ? parsed.replace(/\./g, "").replace(",", ".")
      : parsed.replace(/,/g, "");
  } else if (parsed.includes(",")) {
    parsed = parsed.replace(",", ".");
  }
  const result = Number(parsed);
  return Number.isNaN(result) ? 0 : result;
}

export function brandConfig(rows: SheetRows) {
  const result = new Map<string, BrandConfig>();
  if (rows.length < 2) return result;
  const column = columns(rows[0]);
  const cMarca = column("MARCA");
  if (cMarca < 0) return result;
  const cCompra = column("COMPRA");
  const cOrigen = column("ORIGEN");
  const cObjetivo = column("COBERTURA_OBJETIVO");
  for (const row of rows.slice(1)) {
    const marca = normalizeBrand(value(row, cMarca));
    if (!marca) continue;
    result.set(marca, {
      compra: text(value(row, cCompra) || "NO").toUpperCase(),
      origen: text(value(row, cOrigen) || "SIN CONFIGURAR").toUpperCase(),
      objetivo: cObjetivo >= 0 ? dashboardNumber(value(row, cObjetivo)) : 0,
    });
  }
  return result;
}

export function brandAliases(rows: SheetRows) {
  const result = new Map<string, string>();
  if (rows.length < 2) return result;
  const column = columns(rows[0]);
  const cAlias = column("ALIAS");
  const cMarca = column("MARCA_CONFIGURADA");
  const cActivo = column("ACTIVO");
  if (cAlias < 0 || cMarca < 0) {
    throw new Error("ALIAS_MARCAS_COMPRA debe contener ALIAS y MARCA CONFIGURADA.");
  }
  for (const row of rows.slice(1)) {
    const activo = cActivo < 0 ? "SI" : text(value(row, cActivo)).toUpperCase();
    if (activo && activo !== "SI") continue;
    const alias = normalizeBrand(value(row, cAlias));
    const marca = text(value(row, cMarca));
    if (alias && marca) result.set(alias, marca);
  }
  return result;
}

export function formatDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "00";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`;
}

// The Sheets API returns native date cells as serial numbers. Text dates keep
// the same dd/MM/yyyy parser used by dashboard5.gs. Argentina is UTC-3.
function sourceDate(input: SheetValue | undefined): Date | null {
  if (!input) return null;
  if (typeof input === "number") {
    const date = new Date(Date.UTC(1899, 11, 30) + input * 86_400_000 + 3 * 3_600_000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const raw = text(input);
  const parts = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (parts) {
    const date = new Date(Date.UTC(
      Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]),
      Number(parts[4] || 0) + 3, Number(parts[5] || 0), Number(parts[6] || 0),
    ));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function source(input: SheetValue | undefined, now: Date): DashboardSource {
  const date = sourceDate(input);
  if (!date) return { fecha: "SIN INFORMACIÓN", icono: "⚪", color: "#E7E6E6", fontColor: "#666666" };
  const hours = (now.getTime() - date.getTime()) / 3_600_000;
  if (hours <= 24) return { fecha: formatDate(date), icono: "🟢", color: "#D9EAD3", fontColor: "#274E13" };
  if (hours <= 72) return { fecha: formatDate(date), icono: "🟡", color: "#FFF2CC", fontColor: "#7F6000" };
  return { fecha: formatDate(date), icono: "🔴", color: "#F4CCCC", fontColor: "#990000" };
}

function sourceDates(sheets: DashboardSheets) {
  let warnes: SheetValue = "";
  let escobar: SheetValue = "";
  const stockRows = sheets.controlStock;
  if (stockRows.length >= 2) {
    const column = columns(stockRows[0]);
    const cDeposito = column("DEPOSITO");
    const cFecha = column("ULTIMA_IMPORTACION");
    for (const row of stockRows.slice(1)) {
      const deposito = normalizeBrand(value(row, cDeposito));
      if (deposito.includes("WARNES")) warnes = value(row, cFecha);
      if (deposito.includes("ESCOBAR")) escobar = value(row, cFecha);
    }
  }

  let ventas: SheetValue = "";
  if (sheets.ventas.length >= 2) {
    const cFecha = columns(sheets.ventas[0])("FECHA_IMPORTACION");
    ventas = value(sheets.ventas[1], cFecha);
  }

  let ordenes: SheetValue = "";
  for (let index = sheets.logImportaciones.length - 1; index >= 1; index--) {
    const row = sheets.logImportaciones[index];
    if (text(row[2]).toUpperCase() === "ORDENES" && ["COMPLETADA", "OK"].includes(text(row[4]).toUpperCase())) {
      ordenes = row[0];
      break;
    }
    if (text(row[1]).toUpperCase() === "ORDENES" && ["COMPLETADA", "OK"].includes(text(row[5]).toUpperCase())) {
      ordenes = row[0];
      break;
    }
  }
  return { warnes, escobar, ventas, ordenes };
}

export function calculateComprasDashboard(sheets: DashboardSheets, usuario: string, now = new Date()): ComprasDashboard {
  if (sheets.modelo.length <= 2) throw new Error("MODELO_COMPRAS no contiene datos.");
  const column = columns(sheets.modelo[1]);
  const cSku = column("SKU");
  const cMarca = column("MARCA");
  const cRiesgo = column("RIESGO");
  const cStock = column("STOCK_TOTAL");
  const cPendiente = column("PENDIENTE_TOTAL", "PENDIENTE_RECIBIR");
  const cPromedio = column("PROMEDIO_MENSUAL");
  const cConsumo12 = column("CONSUMO_12_MESES", "CONSUMO_12M");
  const cCompra = column("COMPRA_SUGERIDA", "CANTIDAD_SUGERIDA");
  if ([cSku, cMarca, cRiesgo, cPromedio].some((index) => index < 0)) {
    throw new Error("No se encontraron SKU, MARCA, RIESGO o PROMEDIO_MENSUAL en MODELO_COMPRAS.");
  }

  const config = brandConfig(sheets.config);
  const aliases = brandAliases(sheets.alias);
  const byBrand = new Map<string, DashboardBrand>();
  const result: ComprasDashboard = {
    actualizado: formatDate(now), usuario,
    totalSku: 0, sinStock: 0, urgente: 0, comprar: 0, revisar: 0, ok: 0, sinConsumo: 0,
    stock: 0, pendiente: 0, compraSugerida: 0, stockConConsumo: 0, promedioTotal: 0, coberturaPromedio: 0,
    marcas: [], marcasImportadas: [], marcasNacionales: [], marcasNoCompra: [],
    fuentes: { stockWarnes: source("", now), stockEscobar: source("", now), ventas: source("", now), ordenes: source("", now) },
  };

  for (const row of sheets.modelo.slice(2)) {
    const sku = text(value(row, cSku));
    if (!sku) continue;
    result.totalSku++;
    const marca = text(value(row, cMarca) || "SIN MARCA") || "SIN MARCA";
    const configuredBrand = aliases.get(normalizeBrand(marca)) || marca;
    const brand = config.get(normalizeBrand(configuredBrand)) || EMPTY_CONFIG;
    const compraHabilitada = brand.compra === "SI";
    const riesgo = text(value(row, cRiesgo)).toUpperCase();
    const stock = dashboardNumber(value(row, cStock));
    const pendiente = dashboardNumber(value(row, cPendiente));
    const promedio = dashboardNumber(value(row, cPromedio));
    const consumo12 = cConsumo12 >= 0 ? dashboardNumber(value(row, cConsumo12)) : promedio * 12;
    const compra = dashboardNumber(value(row, cCompra));

    result.stock += stock;
    result.pendiente += pendiente;
    if (compraHabilitada) {
      result.compraSugerida += compra;
      if (promedio > 0) {
        result.stockConConsumo += stock;
        result.promedioTotal += promedio;
      }
      if (riesgo === "SIN STOCK") result.sinStock++;
      else if (riesgo === "URGENTE") result.urgente++;
      else if (riesgo === "COMPRAR") result.comprar++;
      else if (riesgo === "REVISAR") result.revisar++;
      else if (riesgo === "OK") result.ok++;
      else if (riesgo === "SIN CONSUMO") result.sinConsumo++;
    }

    let group = byBrand.get(marca);
    if (!group) {
      group = {
        marca, origen: brand.origen, compraHabilitada, coberturaObjetivo: brand.objetivo,
        sinStock: 0, urgente: 0, comprar: 0, revisar: 0, compra: 0,
        consumo12: 0, consumoTrimestralPromedio: 0, stockConConsumo: 0, promedioTotal: 0, coberturaPromedio: 0,
      };
      byBrand.set(marca, group);
    }
    if (compraHabilitada) {
      if (riesgo === "SIN STOCK") group.sinStock++;
      else if (riesgo === "URGENTE") group.urgente++;
      else if (riesgo === "COMPRAR") group.comprar++;
      else if (riesgo === "REVISAR") group.revisar++;
      group.compra += compra;
      group.consumo12 += consumo12;
      group.consumoTrimestralPromedio = group.consumo12 / 4;
      if (promedio > 0) {
        group.stockConConsumo += stock;
        group.promedioTotal += promedio;
      }
    }
  }

  if (result.promedioTotal > 0) result.coberturaPromedio = result.stockConConsumo / result.promedioTotal;
  const allBrands = Array.from(byBrand.values())
    .map((brand) => {
      if (brand.promedioTotal > 0) brand.coberturaPromedio = brand.stockConConsumo / brand.promedioTotal;
      return brand;
    })
    .sort((a, b) => b.sinStock - a.sinStock || b.urgente - a.urgente || a.marca.localeCompare(b.marca, "es"));
  result.marcasImportadas = allBrands.filter((brand) => brand.compraHabilitada && brand.origen === "IMPORTADO");
  result.marcasNacionales = allBrands.filter((brand) => brand.compraHabilitada && brand.origen === "NACIONAL");
  result.marcasNoCompra = allBrands.filter((brand) => !brand.compraHabilitada);
  result.marcas = allBrands.filter((brand) => brand.compraHabilitada).slice(0, 20);

  const dates = sourceDates(sheets);
  result.fuentes = {
    stockWarnes: source(dates.warnes, now),
    stockEscobar: source(dates.escobar, now),
    ventas: source(dates.ventas, now),
    ordenes: source(dates.ordenes, now),
  };
  return result;
}
