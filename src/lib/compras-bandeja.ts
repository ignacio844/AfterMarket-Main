// Read-only port of obtenerBandejaCompraPortal() and obtenerMapaCotizacionAprobadaPortal_().
import { columns, dashboardNumber, formatDate, text, value, type SheetRows, type SheetValue } from "@/lib/compras-dashboard";
import { sheetSerialDate } from "@/lib/compras-dates";

export type BandejaCompraRegistro = {
  sku: string;
  descripcion: string;
  marca: string;
  riesgo: string;
  compraSugerida: number;
  cantidadDecidida: number;
  responsable: string;
  observacion: string;
  fechaDecision: string;
  nroCotizacion: string;
  proveedor: string;
  codigoProveedor: string;
};

export type ComprasBandeja = {
  registros: BandejaCompraRegistro[];
  resumen: { sku: number; unidades: number; marcas: number };
};

export type BandejaSheets = {
  gestion: SheetRows;
  cotizaciones: SheetRows;
  ofertas: SheetRows;
};

function clave(input: SheetValue | undefined) {
  return text(input).toUpperCase();
}

function fechaPortal(input: SheetValue | undefined, timeZone: string) {
  if (!input) return "";
  const date = typeof input === "number" ? sheetSerialDate(input, timeZone) : new Date(String(input));
  return Number.isNaN(date.getTime()) ? String(input) : formatDate(date);
}

function mapaCotizacionAprobada(sheets: BandejaSheets) {
  const result = new Map<string, Pick<BandejaCompraRegistro, "nroCotizacion" | "proveedor" | "codigoProveedor">>();
  if (sheets.cotizaciones.length < 2 || sheets.ofertas.length < 2) return result;

  const cotColumn = columns(sheets.cotizaciones[0]);
  const ofertaColumn = columns(sheets.ofertas[0]);
  const aprobadas = new Map<string, string>();
  for (const row of sheets.cotizaciones.slice(1)) {
    if (clave(value(row, cotColumn("ESTADO_COTIZACION"))) !== "APROBADA") continue;
    const nro = text(value(row, cotColumn("NRO_COTIZACION")));
    const sku = clave(value(row, cotColumn("SKU")));
    const proveedor = text(value(row, cotColumn("PROVEEDOR_SELECCIONADO")));
    if (nro && sku && proveedor) aprobadas.set(`${nro}|${sku}`, proveedor);
  }
  for (const row of sheets.ofertas.slice(1)) {
    const nro = text(value(row, ofertaColumn("NRO_COTIZACION")));
    const sku = clave(value(row, ofertaColumn("SKU")));
    const proveedor = text(value(row, ofertaColumn("PROVEEDOR")));
    const elegido = aprobadas.get(`${nro}|${sku}`);
    if (!elegido || elegido.toUpperCase() !== proveedor.toUpperCase()) continue;
    result.set(sku, {
      nroCotizacion: nro,
      proveedor,
      codigoProveedor: text(value(row, ofertaColumn("CODIGO_PROVEEDOR"))),
    });
  }
  return result;
}

export function calculateComprasBandeja(sheets: BandejaSheets, timeZone = "America/Argentina/Buenos_Aires"): ComprasBandeja {
  const empty = { registros: [], resumen: { sku: 0, unidades: 0, marcas: 0 } };
  if (sheets.gestion.length < 2) return empty;

  const column = columns(sheets.gestion[0]);
  if ([column("SKU"), column("ESTADO_GESTION"), column("CANTIDAD_DECIDIDA")].some((index) => index < 0)) {
    throw new Error("GESTION_COMPRAS_ACTIVA no contiene SKU, ESTADO_GESTION o CANTIDAD_DECIDIDA.");
  }

  const registros: BandejaCompraRegistro[] = [];
  const marcas = new Set<string>();
  let unidades = 0;
  for (const row of sheets.gestion.slice(1)) {
    const get = (name: string) => value(row, column(name));
    const sku = text(get("SKU"));
    if (!sku || clave(get("ESTADO_GESTION")) !== "APROBADO") continue;
    const cantidad = dashboardNumber(get("CANTIDAD_DECIDIDA"));
    if (cantidad <= 0) continue;
    const marca = text(get("MARCA") || "SIN MARCA") || "SIN MARCA";
    marcas.add(marca);
    unidades += cantidad;
    registros.push({
      sku,
      descripcion: String(get("DESCRIPCION") || ""),
      marca,
      riesgo: String(get("RIESGO") || ""),
      compraSugerida: dashboardNumber(get("COMPRA_SUGERIDA")),
      cantidadDecidida: cantidad,
      responsable: String(get("RESPONSABLE") || ""),
      observacion: String(get("OBSERVACION") || ""),
      fechaDecision: fechaPortal(get("FECHA_DECISION"), timeZone),
      nroCotizacion: "",
      proveedor: "",
      codigoProveedor: "",
    });
  }

  const cotizaciones = mapaCotizacionAprobada(sheets);
  for (const registro of registros) Object.assign(registro, cotizaciones.get(clave(registro.sku)));
  registros.sort((a, b) => a.marca.localeCompare(b.marca, "es") || a.sku.localeCompare(b.sku, "es"));
  return { registros, resumen: { sku: registros.length, unidades, marcas: marcas.size } };
}
