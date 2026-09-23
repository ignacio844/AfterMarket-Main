// Read-only port of obtenerHistorialSkuPortal() in the legacy Apps Script.
import {
  brandAliases, brandConfig, columns, dashboardNumber, formatDate,
  normalizeBrand, text, value, type SheetRows, type SheetValue,
} from "@/lib/compras-dashboard";
import { sheetSerialDate } from "@/lib/compras-dates";

export type HistorialEvento = {
  tipo: "GESTION" | "ENVIO" | "COMPRA";
  fechaOrden: number;
  fecha: string;
  titulo: string;
  estado: string;
  detalle: string;
  responsable: string;
  observacion: string;
  referencia: string;
  proveedor?: string;
};

export type ComprasHistorial = {
  sku: string;
  descripcion: string;
  marca: string;
  origen: string;
  compraHabilitada: boolean;
  coberturaActual: number;
  coberturaObjetivo: number;
  estadoActual: string;
  cantidadSolicitada: number;
  cantidadComprada: number;
  saldoPendiente: number;
  stockWarnes: number;
  stockEscobar: number;
  stockTotal: number;
  promedioMensual: number;
  pendienteTotal: number;
  proveedorActual: string;
  responsableActual: string;
  eventos: HistorialEvento[];
};

export type GestionDecisionEvent = {
  tipo: "MIGRACION" | "DECISION";
  estado_gestion: string | null;
  cantidad_decidida: number;
  observacion: string;
  actor: string;
  fecha_evento: string;
  version: number;
};

export function mergeGestionDecisionEvents(
  historial: ComprasHistorial,
  events: GestionDecisionEvent[],
  unresolved = false,
): ComprasHistorial {
  const baseline = historial.eventos.map((event) => unresolved && event.tipo === "GESTION"
    ? { ...event, titulo: "Decisión legacy (sin conciliar)" }
    : event);
  const added: HistorialEvento[] = events.filter((event) => event.tipo === "DECISION").map((event) => {
    const date = new Date(event.fecha_evento);
    return {
      tipo: "GESTION", fechaOrden: date.getTime(), fecha: formatDate(date),
      titulo: "Decisión de compra", estado: event.estado_gestion ?? "SIN RESOLVER",
      detalle: event.cantidad_decidida > 0 ? `Cantidad decidida: ${event.cantidad_decidida}` : "",
      responsable: event.actor, observacion: event.observacion, referencia: `Supabase · versión ${event.version}`,
    };
  });
  return { ...historial, eventos: [...baseline, ...added].sort((a, b) => a.fechaOrden - b.fechaOrden) };
}

export type HistorialSheets = {
  gestionActiva: SheetRows;
  config: SheetRows;
  alias: SheetRows;
  gestionHistorial: SheetRows;
  enviosCompra: SheetRows;
  procesoCompra: SheetRows;
  movimientosCompra: SheetRows;
};

function claveSku(value: SheetValue | undefined) {
  return text(value).toUpperCase();
}

function matchingRows(rows: SheetRows, sku: string) {
  if (rows.length < 2) return { rows: [] as SheetValue[][], column: columns([]) };
  const column = columns(rows[0]);
  const skuColumn = column("SKU");
  if (skuColumn < 0) throw new Error("No se encontró la columna SKU en una hoja del Historial.");
  return {
    rows: rows.slice(1).filter((row) => claveSku(value(row, skuColumn)) === claveSku(sku)),
    column,
  };
}

function eventDate(input: SheetValue, timeZone: string): { fechaOrden: number; fecha: string } {
  if (!input) return { fechaOrden: 0, fecha: "" };
  let date: Date;
  if (typeof input === "number") {
    date = sheetSerialDate(input, timeZone);
  } else {
    const raw = text(input);
    const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(raw);
    date = local
      ? new Date(Date.UTC(Number(local[3]), Number(local[2]) - 1, Number(local[1]), Number(local[4] || 0) + 3, Number(local[5] || 0)))
      : new Date(raw);
  }
  return Number.isNaN(date.getTime())
    ? { fechaOrden: 0, fecha: text(input) }
    : { fechaOrden: date.getTime(), fecha: formatDate(date) };
}

export function calculateComprasHistorial(
  sheets: HistorialSheets,
  requestedSku: string,
  sheetTimeZone = "America/Argentina/Buenos_Aires",
): ComprasHistorial {
  const sku = requestedSku.trim();
  if (!sku) throw new Error("Ingresá un SKU.");

  const result: ComprasHistorial = {
    sku, descripcion: "", marca: "", origen: "", compraHabilitada: false,
    coberturaActual: 0, coberturaObjetivo: 0, estadoActual: "",
    cantidadSolicitada: 0, cantidadComprada: 0, saldoPendiente: 0,
    stockWarnes: 0, stockEscobar: 0, stockTotal: 0, promedioMensual: 0,
    pendienteTotal: 0, proveedorActual: "", responsableActual: "", eventos: [],
  };

  const active = matchingRows(sheets.gestionActiva, sku);
  const activeRow = active.rows[0];
  if (activeRow) {
    const get = (name: string) => value(activeRow, active.column(name));
    result.stockWarnes = dashboardNumber(get("STOCK_WARNES"));
    result.stockEscobar = dashboardNumber(get("STOCK_ESCOBAR"));
    result.stockTotal = dashboardNumber(get("STOCK_TOTAL"));
    result.promedioMensual = dashboardNumber(get("PROMEDIO_MENSUAL"));
    result.pendienteTotal = dashboardNumber(get("PENDIENTE_TOTAL"));
    result.coberturaActual = dashboardNumber(get("COBERTURA_ACTUAL"));
    if (!result.stockTotal && (result.stockWarnes || result.stockEscobar)) {
      result.stockTotal = result.stockWarnes + result.stockEscobar;
    }
    if (result.coberturaActual <= 0 && result.promedioMensual > 0) {
      result.coberturaActual = result.stockTotal / result.promedioMensual;
    }
    result.descripcion = text(get("DESCRIPCION"));
    result.marca = text(get("MARCA"));
  }

  // Legacy resolves the brand policy now, before falling back to older rows.
  const aliases = brandAliases(sheets.alias);
  const config = brandConfig(sheets.config);
  const configuredBrand = aliases.get(normalizeBrand(result.marca)) || result.marca;
  const policy = config.get(normalizeBrand(configuredBrand)) || { compra: "NO", origen: "SIN CONFIGURAR", objetivo: 0 };
  result.origen = policy.origen;
  result.compraHabilitada = policy.compra === "SI";
  result.coberturaObjetivo = policy.objetivo;

  const gestion = matchingRows(sheets.gestionHistorial, sku);
  const decision = gestion.rows[0];
  if (decision) {
    const get = (name: string) => value(decision, gestion.column(name));
    const estado = text(get("ESTADO_GESTION"));
    const fecha = get("FECHA_DECISION");
    const cantidad = dashboardNumber(get("CANTIDAD_DECIDIDA"));
    if (fecha || estado) {
      result.eventos.push({
        tipo: "GESTION", ...eventDate(fecha, sheetTimeZone), titulo: "Decisión de compra",
        estado, detalle: cantidad > 0 ? `Cantidad decidida: ${cantidad}` : "",
        responsable: text(get("RESPONSABLE")), observacion: text(get("OBSERVACION")), referencia: "",
      });
    }
  }

  const envios = matchingRows(sheets.enviosCompra, sku);
  for (const row of envios.rows) {
    const get = (name: string) => value(row, envios.column(name));
    if (!result.descripcion) result.descripcion = text(get("DESCRIPCION"));
    if (!result.marca) result.marca = text(get("MARCA"));
    result.eventos.push({
      tipo: "ENVIO", ...eventDate(get("FECHA_ENVIO"), sheetTimeZone), titulo: "Enviado a Compra",
      estado: "ENVIADO A COMPRA", detalle: `Cantidad enviada: ${dashboardNumber(get("CANTIDAD_DECIDIDA"))}`,
      responsable: text(get("USUARIO_ENVIO")), observacion: text(get("OBSERVACION")),
      referencia: text(get("NRO_ENVIO")),
    });
  }

  const proceso = matchingRows(sheets.procesoCompra, sku);
  const lastProcess = proceso.rows.at(-1);
  if (lastProcess) {
    const get = (name: string) => value(lastProcess, proceso.column(name));
    result.descripcion ||= text(get("DESCRIPCION"));
    result.marca ||= text(get("MARCA"));
    result.estadoActual = text(get("ESTADO_COMPRA"));
    result.cantidadSolicitada = dashboardNumber(get("CANTIDAD_SOLICITADA"));
    result.cantidadComprada = dashboardNumber(get("CANTIDAD_COMPRADA"));
    result.saldoPendiente = Math.max(result.cantidadSolicitada - result.cantidadComprada, 0);
    result.proveedorActual = text(get("PROVEEDOR"));
    result.responsableActual = text(get("RESPONSABLE_COMPRA"));
  }

  const movimientos = matchingRows(sheets.movimientosCompra, sku);
  for (const row of movimientos.rows) {
    const get = (name: string) => value(row, movimientos.column(name));
    const referencia = text(get("NRO_MOVIMIENTO"));
    const envio = get("NRO_ENVIO");
    result.eventos.push({
      tipo: "COMPRA", ...eventDate(get("FECHA_MOVIMIENTO"), sheetTimeZone), titulo: "Movimiento de compra",
      estado: text(get("ESTADO_RESULTANTE")),
      detalle: `Compra: ${dashboardNumber(get("CANTIDAD_MOVIMIENTO"))} · Acumulado: ${dashboardNumber(get("CANTIDAD_ACUMULADA"))} · Saldo: ${dashboardNumber(get("SALDO_RESULTANTE"))}`,
      responsable: text(get("USUARIO")), observacion: text(get("OBSERVACION")),
      referencia: referencia + (envio ? ` · ${String(envio)}` : ""), proveedor: text(get("PROVEEDOR")),
    });
  }

  result.eventos.sort((a, b) => a.fechaOrden - b.fechaOrden);
  if (result.eventos.length === 0) throw new Error(`No se encontró historial para el SKU ${sku}.`);
  return result;
}
