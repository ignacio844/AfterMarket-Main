// Read-only port of obtenerOrdenesPendientes() + obtenerDetalleRecepcion().
// registrarRecepcion() and registrarRecepcionesExcel() are intentionally excluded
// because those legacy actions write to DETALLE_IMPORTACIONES and audit sheets.
import { columns, dashboardNumber, formatDate, text, value, type SheetRows } from "@/lib/compras-dashboard";

export type RecepcionLinea = {
  idDetalle: string;
  sku: string;
  item: string;
  marca: string;
  statusLinea: string;
  estadoRecepcion: string;
  cantidadPendiente: number;
  cantidadRecibida: number;
  precio: number;
};

export type RecepcionOrden = {
  idOrden: string;
  numeroPI: string;
  proveedor: string;
  legajo: string;
  estado: string;
  estadoRecepcion: string;
  detalle: RecepcionLinea[];
};

export type ComprasRecepciones = {
  actualizado: string;
  ordenes: RecepcionOrden[];
  resumen: {
    ordenesPendientes: number;
    lineasPendientes: number;
    unidadesPendientes: number;
    unidadesRecibidas: number;
    ordenesParciales: number;
  };
};

function upper(input: unknown) {
  return String(input ?? "").trim().toUpperCase();
}

export function calculateComprasRecepciones(
  sheets: { ordenes: SheetRows; detalleImportaciones: SheetRows },
  now = new Date(),
): ComprasRecepciones {
  if (!sheets.ordenes.length) throw new Error("ORDENES no contiene datos.");
  if (!sheets.detalleImportaciones.length) throw new Error("DETALLE_IMPORTACIONES no contiene datos.");

  const orderColumn = columns(sheets.ordenes[0]);
  const detailColumn = columns(sheets.detalleImportaciones[0]);

  const orderId = orderColumn("ID_ORDEN", "NUMERO_ORDEN", "NUMERO_PI");
  if (orderId < 0) throw new Error("ORDENES no contiene ID_ORDEN, NUMERO_ORDEN ni NUMERO_PI.");

  const detailOrder = detailColumn("ID_ORDEN");
  const detailId = detailColumn("ID_DETALLE");
  const detailPending = detailColumn("CANTIDAD_PENDIENTE");
  if (detailOrder < 0 || detailId < 0 || detailPending < 0) {
    throw new Error("DETALLE_IMPORTACIONES debe contener ID_ORDEN, ID_DETALLE y CANTIDAD_PENDIENTE.");
  }

  const detallesPorOrden = new Map<string, RecepcionLinea[]>();

  for (const row of sheets.detalleImportaciones.slice(1)) {
    const idOrden = text(value(row, detailOrder));
    const idDetalle = text(value(row, detailId));
    const cantidadPendiente = dashboardNumber(value(row, detailPending));
    if (!idOrden || !idDetalle || cantidadPendiente <= 0) continue;

    const linea: RecepcionLinea = {
      idDetalle,
      sku: text(value(row, detailColumn("SKU"))),
      item: text(value(row, detailColumn("ITEM"))),
      marca: text(value(row, detailColumn("MARCA"))),
      statusLinea: text(value(row, detailColumn("STATUS_LINEA"))),
      estadoRecepcion: text(value(row, detailColumn("ESTADO_RECEPCION"))) || "PENDIENTE",
      cantidadPendiente,
      cantidadRecibida: dashboardNumber(value(row, detailColumn("CANTIDAD_RECIBIDA"))),
      precio: dashboardNumber(value(row, detailColumn("PRECIO_UNITARIO"))),
    };

    const lista = detallesPorOrden.get(idOrden) ?? [];
    lista.push(linea);
    detallesPorOrden.set(idOrden, lista);
  }

  const ordenes: RecepcionOrden[] = [];

  for (const row of sheets.ordenes.slice(1)) {
    const estadoRecepcion = text(value(row, orderColumn("ESTADO_RECEPCION"))) || "PENDIENTE";
    const status = text(value(row, orderColumn("STATUS")));
    const situacion = text(value(row, orderColumn("SITUACION")));
    const statusLogistico = status || situacion;

    if (upper(estadoRecepcion) === "RECIBIDO") continue;
    if (["CERRADO", "CERRADA"].includes(upper(statusLogistico))) continue;

    const idOrden = text(value(row, orderColumn("ID_ORDEN")))
      || text(value(row, orderColumn("NUMERO_ORDEN")))
      || text(value(row, orderColumn("NUMERO_PI")));
    if (!idOrden) continue;

    const detalle = detallesPorOrden.get(idOrden) ?? [];

    ordenes.push({
      idOrden,
      numeroPI: text(value(row, orderColumn("NUMERO_PI")))
        || text(value(row, orderColumn("PI")))
        || idOrden,
      proveedor: text(value(row, orderColumn("PROVEEDOR"))),
      legajo: text(value(row, orderColumn("LEGAJO_CONTENEDOR")))
        || text(value(row, orderColumn("LEGAJO_NRO")))
        || text(value(row, orderColumn("LEGAJO"))),
      estado: statusLogistico,
      estadoRecepcion,
      detalle,
    });
  }

  ordenes.sort((a, b) => a.numeroPI.localeCompare(b.numeroPI, "es", { numeric: true, sensitivity: "base" }));

  let lineasPendientes = 0;
  let unidadesPendientes = 0;
  let unidadesRecibidas = 0;
  let ordenesParciales = 0;

  for (const orden of ordenes) {
    lineasPendientes += orden.detalle.length;
    if (upper(orden.estadoRecepcion) === "PARCIAL") ordenesParciales++;
    for (const linea of orden.detalle) {
      unidadesPendientes += linea.cantidadPendiente;
      unidadesRecibidas += linea.cantidadRecibida;
    }
  }

  return {
    actualizado: formatDate(now),
    ordenes,
    resumen: {
      ordenesPendientes: ordenes.length,
      lineasPendientes,
      unidadesPendientes,
      unidadesRecibidas,
      ordenesParciales,
    },
  };
}
