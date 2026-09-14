// Read-only ports of obtenerBandejaCotizacionPortal() and obtenerCotizacionesPortal().
import {
  brandAliases, brandConfig, columns, dashboardNumber, formatDate,
  normalizeBrand, text, value, type SheetRows, type SheetValue,
} from "@/lib/compras-dashboard";
import { sheetSerialDate } from "@/lib/compras-dates";

export type CotizacionPendiente = {
  sku: string;
  descripcion: string;
  marca: string;
  origen: string;
  riesgo: string;
  compraSugerida: number;
  cantidadDecidida: number;
  responsable: string;
  observacion: string;
  fechaDecision: string;
};

export type CotizacionItem = {
  sku: string;
  descripcion: string;
  marca: string;
  cantidad: number;
};

export type CotizacionOfertaItem = {
  sku: string;
  codigoProveedor: string;
  precio: number;
  cantidad: number;
  subtotal: number;
};

export type CotizacionOferta = {
  nroCotizacion: string;
  proveedor: string;
  moneda: string;
  observacion: string;
  items: CotizacionOfertaItem[];
  total: number;
};

export type CotizacionLote = {
  nroCotizacion: string;
  fecha: string;
  estado: string;
  proveedorSeleccionado: string;
  items: CotizacionItem[];
  ofertas: CotizacionOferta[];
};

export type ComprasCotizaciones = {
  pendientes: CotizacionPendiente[];
  resumen: { sku: number; unidades: number; marcas: number };
  cotizaciones: CotizacionLote[];
};

export type CotizacionesSheets = {
  gestion: SheetRows;
  cotizaciones: SheetRows;
  ofertas: SheetRows;
  config: SheetRows;
  alias: SheetRows;
};

function fechaPortal(input: SheetValue, timeZone: string) {
  if (!input) return "";
  const date = typeof input === "number" ? sheetSerialDate(input, timeZone) : new Date(String(input));
  return Number.isNaN(date.getTime()) ? String(input) : formatDate(date);
}

function claveSku(input: SheetValue | undefined) {
  return text(input).toUpperCase();
}

function bandejaCotizacion(sheets: CotizacionesSheets, timeZone: string) {
  const rows = sheets.gestion;
  const empty = { pendientes: [] as CotizacionPendiente[], resumen: { sku: 0, unidades: 0, marcas: 0 } };
  if (rows.length < 2) return empty;
  const column = columns(rows[0]);
  if ([column("SKU"), column("MARCA"), column("ESTADO_GESTION"), column("CANTIDAD_DECIDIDA")].some((index) => index < 0)) {
    throw new Error("GESTION_COMPRAS_ACTIVA no contiene las columnas necesarias para Cotizaciones.");
  }

  const abiertas = new Set<string>();
  if (sheets.cotizaciones.length >= 2) {
    const cotColumn = columns(sheets.cotizaciones[0]);
    if (cotColumn("SKU") >= 0 && cotColumn("ESTADO_COTIZACION") >= 0) {
      for (const row of sheets.cotizaciones.slice(1)) {
        if (text(value(row, cotColumn("ESTADO_COTIZACION"))).toUpperCase() === "ABIERTA") {
          const sku = claveSku(value(row, cotColumn("SKU")));
          if (sku) abiertas.add(sku);
        }
      }
    }
  }

  // Legacy consults brand configuration only if ORIGEN is absent.
  const needsConfig = column("ORIGEN") < 0;
  const config = needsConfig ? brandConfig(sheets.config) : null;
  const aliases = needsConfig ? brandAliases(sheets.alias) : null;
  const pendientes: CotizacionPendiente[] = [];
  const marcas = new Set<string>();
  let unidades = 0;
  for (const row of rows.slice(1)) {
    const get = (name: string) => value(row, column(name));
    const sku = text(get("SKU"));
    if (!sku || text(get("ESTADO_GESTION")).toUpperCase() !== "COTIZAR") continue;
    const cantidad = dashboardNumber(get("CANTIDAD_DECIDIDA"));
    if (cantidad <= 0) continue;
    const marca = text(get("MARCA") || "SIN MARCA") || "SIN MARCA";
    const resolved = aliases?.get(normalizeBrand(marca)) || marca;
    const origen = needsConfig
      ? config?.get(normalizeBrand(resolved))?.origen || "SIN CONFIGURAR"
      : text(get("ORIGEN")).toUpperCase();
    if (origen !== "IMPORTADO" || abiertas.has(claveSku(sku))) continue;
    marcas.add(marca);
    unidades += cantidad;
    pendientes.push({
      sku, descripcion: String(get("DESCRIPCION") || ""), marca, origen,
      riesgo: String(get("RIESGO") || ""), compraSugerida: dashboardNumber(get("COMPRA_SUGERIDA")),
      cantidadDecidida: cantidad, responsable: String(get("RESPONSABLE") || ""),
      observacion: String(get("OBSERVACION") || ""), fechaDecision: fechaPortal(get("FECHA_DECISION"), timeZone),
    });
  }
  pendientes.sort((a, b) => a.marca.localeCompare(b.marca, "es") || a.sku.localeCompare(b.sku, "es"));
  return { pendientes, resumen: { sku: pendientes.length, unidades, marcas: marcas.size } };
}

function lotesCotizacion(sheets: CotizacionesSheets, timeZone: string) {
  const lotes = new Map<string, CotizacionLote>();
  const rows = sheets.cotizaciones;
  if (rows.length >= 2) {
    const column = columns(rows[0]);
    if (column("NRO_COTIZACION") < 0) throw new Error("COTIZACIONES_COMPRA no contiene NRO_COTIZACION.");
    for (const row of rows.slice(1)) {
      const get = (name: string) => value(row, column(name));
      const nroCotizacion = text(get("NRO_COTIZACION"));
      if (!nroCotizacion) continue;
      let lote = lotes.get(nroCotizacion);
      if (!lote) {
        lote = {
          nroCotizacion, fecha: fechaPortal(get("FECHA_COTIZACION"), timeZone),
          estado: text(get("ESTADO_COTIZACION")).toUpperCase(),
          proveedorSeleccionado: text(get("PROVEEDOR_SELECCIONADO")), items: [], ofertas: [],
        };
        lotes.set(nroCotizacion, lote);
      }
      lote.items.push({
        sku: String(get("SKU") || ""), descripcion: String(get("DESCRIPCION") || ""),
        marca: String(get("MARCA") || ""), cantidad: dashboardNumber(get("CANTIDAD")),
      });
    }
  }

  const ofertasMap = new Map<string, CotizacionOferta>();
  const offerRows = sheets.ofertas;
  if (offerRows.length >= 2) {
    const column = columns(offerRows[0]);
    for (const row of offerRows.slice(1)) {
      const get = (name: string) => value(row, column(name));
      const nroCotizacion = text(get("NRO_COTIZACION"));
      const lote = lotes.get(nroCotizacion);
      if (!nroCotizacion || !lote) continue;
      const proveedor = text(get("PROVEEDOR"));
      const key = `${nroCotizacion}|${proveedor.toUpperCase()}`;
      let oferta = ofertasMap.get(key);
      if (!oferta) {
        oferta = {
          nroCotizacion, proveedor, moneda: text(get("MONEDA")).toUpperCase(),
          observacion: String(get("OBSERVACION") || ""), items: [], total: 0,
        };
        ofertasMap.set(key, oferta);
      }
      const sku = text(get("SKU"));
      const precio = dashboardNumber(get("PRECIO"));
      const cantidad = lote.items.find((item) => claveSku(item.sku) === claveSku(sku))?.cantidad || 0;
      const subtotal = precio * cantidad;
      oferta.items.push({ sku, codigoProveedor: text(get("CODIGO_PROVEEDOR")), precio, cantidad, subtotal });
      oferta.total += subtotal;
    }
  }
  for (const oferta of ofertasMap.values()) lotes.get(oferta.nroCotizacion)?.ofertas.push(oferta);
  return Array.from(lotes.values()).sort((a, b) => b.nroCotizacion.localeCompare(a.nroCotizacion));
}

export function calculateComprasCotizaciones(
  sheets: CotizacionesSheets,
  timeZone = "America/Argentina/Buenos_Aires",
): ComprasCotizaciones {
  return { ...bandejaCotizacion(sheets, timeZone), cotizaciones: lotesCotizacion(sheets, timeZone) };
}

export type PrecioRanking = "MEJOR PRECIO" | "2° PRECIO" | "OFERTA";

export function rankingPrecio(lote: CotizacionLote, oferta: CotizacionOferta, sku: string): PrecioRanking {
  const clave = claveSku(sku);
  const moneda = oferta.moneda.trim().toUpperCase();
  const precio = oferta.items.find((item) => claveSku(item.sku) === clave)?.precio || 0;
  if (!moneda || precio <= 0 || !Number.isFinite(precio)) return "OFERTA";
  const distintos = Array.from(new Set(lote.ofertas
    .filter((other) => other.moneda.trim().toUpperCase() === moneda)
    .map((other) => other.items.find((item) => claveSku(item.sku) === clave)?.precio || 0)
    .filter((amount) => Number.isFinite(amount) && amount > 0))).sort((a, b) => a - b);
  if (precio === distintos[0]) return "MEJOR PRECIO";
  if (precio === distintos[1]) return "2° PRECIO";
  return "OFERTA";
}
