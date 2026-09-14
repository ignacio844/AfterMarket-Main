// Read-only port of obtenerComprasEnProcesoPortal().
// The legacy synchronizes ENVIOS_COMPRA -> COMPRAS_EN_PROCESO before reading.
// Here that synchronization is reproduced only in memory: Google Sheets is never modified.
import { columns, dashboardNumber, formatDate, text, value, type SheetRows, type SheetValue } from "@/lib/compras-dashboard";
import { sheetSerialDate } from "@/lib/compras-dates";

export const PROCESO_ESTADOS = [
  "PENDIENTE",
  "EN GESTION",
  "COMPRA PARCIAL",
  "COMPRA REALIZADA",
] as const;

export type ProcesoMovimiento = {
  nroMovimiento: string;
  fecha: string;
  usuario: string;
  estado: string;
  proveedor: string;
  cantidadMovimiento: number;
  cantidadAcumulada: number;
  saldo: number;
  observacion: string;
};

export type ProcesoRegistro = {
  nroEnvio: string;
  fechaEnvio: string;
  usuarioEnvio: string;
  sku: string;
  descripcion: string;
  marca: string;
  cantidadSolicitada: number;
  estadoCompra: string;
  proveedor: string;
  cantidadComprada: number;
  saldoPendiente: number;
  observacionCompra: string;
  responsableCompra: string;
  fechaGestion: string;
  fechaCompra: string;
  virtual: boolean;
  movimientos: ProcesoMovimiento[];
};

export type ComprasProceso = {
  actualizado: string;
  registros: ProcesoRegistro[];
  estados: string[];
  marcas: string[];
  proveedores: string[];
  pendientesDeSincronizar: number;
  resumen: {
    lotes: number;
    sku: number;
    unidadesSolicitadas: number;
    unidadesCompradas: number;
  };
};

export type ProcesoFilters = {
  texto: string;
  estado: string;
  marca: string;
  proveedor: string;
};

function key(nroEnvio: string, sku: string) {
  return `${nroEnvio.trim()}|${sku.trim().toUpperCase()}`;
}

function portalDate(input: SheetValue, timeZone: string) {
  if (!input) return "";
  const date = typeof input === "number" ? sheetSerialDate(input, timeZone) : new Date(String(input));
  return Number.isNaN(date.getTime()) ? String(input) : formatDate(date);
}

function movimientosPorRegistro(rows: SheetRows, timeZone: string) {
  const result = new Map<string, ProcesoMovimiento[]>();
  if (rows.length < 2) return result;

  const column = columns(rows[0]);
  const cEnvio = column("NRO_ENVIO");
  const cSku = column("SKU");
  if (cEnvio < 0 || cSku < 0) return result;

  for (const row of rows.slice(1)) {
    const nroEnvio = text(value(row, cEnvio));
    const sku = text(value(row, cSku));
    if (!nroEnvio || !sku) continue;
    const get = (name: string) => value(row, column(name));
    const registro: ProcesoMovimiento = {
      nroMovimiento: text(get("NRO_MOVIMIENTO")),
      fecha: portalDate(get("FECHA_MOVIMIENTO"), timeZone),
      usuario: text(get("USUARIO")),
      estado: text(get("ESTADO_RESULTANTE")),
      proveedor: text(get("PROVEEDOR")),
      cantidadMovimiento: dashboardNumber(get("CANTIDAD_MOVIMIENTO")),
      cantidadAcumulada: dashboardNumber(get("CANTIDAD_ACUMULADA")),
      saldo: dashboardNumber(get("SALDO_RESULTANTE")),
      observacion: text(get("OBSERVACION")),
    };
    const registroKey = key(nroEnvio, sku);
    const actuales = result.get(registroKey) ?? [];
    actuales.push(registro);
    result.set(registroKey, actuales);
  }

  for (const movimientos of result.values()) {
    movimientos.sort((a, b) => a.nroMovimiento.localeCompare(b.nroMovimiento));
  }
  return result;
}

export function calculateComprasProceso(
  sheets: { procesoCompra: SheetRows; enviosCompra: SheetRows; movimientosCompra?: SheetRows },
  now = new Date(),
  sheetTimeZone = "America/Argentina/Buenos_Aires",
): ComprasProceso {
  const movimientos = movimientosPorRegistro(sheets.movimientosCompra ?? [], sheetTimeZone);
  const registros: ProcesoRegistro[] = [];
  const existentes = new Set<string>();

  if (sheets.procesoCompra.length >= 1) {
    const column = columns(sheets.procesoCompra[0]);
    const required = [column("NRO_ENVIO"), column("SKU"), column("CANTIDAD_SOLICITADA"), column("ESTADO_COMPRA")];
    if (required.some((index) => index < 0)) {
      throw new Error("COMPRAS_EN_PROCESO no contiene las columnas requeridas.");
    }

    for (const row of sheets.procesoCompra.slice(1)) {
      const get = (name: string) => value(row, column(name));
      const nroEnvio = text(get("NRO_ENVIO"));
      const sku = text(get("SKU"));
      if (!nroEnvio || !sku) continue;

      const cantidadSolicitada = dashboardNumber(get("CANTIDAD_SOLICITADA"));
      const cantidadComprada = dashboardNumber(get("CANTIDAD_COMPRADA"));
      const registroKey = key(nroEnvio, sku);
      existentes.add(registroKey);
      registros.push({
        nroEnvio,
        fechaEnvio: portalDate(get("FECHA_ENVIO"), sheetTimeZone),
        usuarioEnvio: text(get("USUARIO_ENVIO")),
        sku,
        descripcion: text(get("DESCRIPCION")),
        marca: text(get("MARCA") || "SIN MARCA") || "SIN MARCA",
        cantidadSolicitada,
        estadoCompra: text(get("ESTADO_COMPRA") || "PENDIENTE").toUpperCase(),
        proveedor: text(get("PROVEEDOR")),
        cantidadComprada,
        saldoPendiente: Math.max(cantidadSolicitada - cantidadComprada, 0),
        observacionCompra: text(get("OBSERVACION_COMPRA")),
        responsableCompra: text(get("RESPONSABLE_COMPRA")),
        fechaGestion: portalDate(get("FECHA_GESTION"), sheetTimeZone),
        fechaCompra: portalDate(get("FECHA_COMPRA"), sheetTimeZone),
        virtual: false,
        movimientos: movimientos.get(registroKey) ?? [],
      });
    }
  }

  let pendientesDeSincronizar = 0;
  if (sheets.enviosCompra.length >= 2) {
    const column = columns(sheets.enviosCompra[0]);
    const cEnvio = column("NRO_ENVIO");
    const cSku = column("SKU");
    const cCantidad = column("CANTIDAD_DECIDIDA");
    if ([cEnvio, cSku, cCantidad].some((index) => index < 0)) {
      throw new Error("ENVIOS_COMPRA no contiene las columnas requeridas para Compras en Proceso.");
    }

    for (const row of sheets.enviosCompra.slice(1)) {
      const get = (name: string) => value(row, column(name));
      const nroEnvio = text(get("NRO_ENVIO"));
      const sku = text(get("SKU"));
      if (!nroEnvio || !sku) continue;
      const registroKey = key(nroEnvio, sku);
      if (existentes.has(registroKey)) continue;

      const cantidadSolicitada = dashboardNumber(get("CANTIDAD_DECIDIDA"));
      pendientesDeSincronizar++;
      existentes.add(registroKey);
      registros.push({
        nroEnvio,
        fechaEnvio: portalDate(get("FECHA_ENVIO"), sheetTimeZone),
        usuarioEnvio: text(get("USUARIO_ENVIO")),
        sku,
        descripcion: text(get("DESCRIPCION")),
        marca: text(get("MARCA") || "SIN MARCA") || "SIN MARCA",
        cantidadSolicitada,
        estadoCompra: "PENDIENTE",
        proveedor: "",
        cantidadComprada: 0,
        saldoPendiente: cantidadSolicitada,
        observacionCompra: "",
        responsableCompra: "",
        fechaGestion: "",
        fechaCompra: "",
        virtual: true,
        movimientos: movimientos.get(registroKey) ?? [],
      });
    }
  }

  registros.sort((a, b) => {
    const lote = b.nroEnvio.localeCompare(a.nroEnvio);
    return lote !== 0 ? lote : a.sku.localeCompare(b.sku, "es");
  });

  const lotes = new Set<string>();
  const marcas = new Set<string>();
  const proveedores = new Set<string>();
  let unidadesSolicitadas = 0;
  let unidadesCompradas = 0;

  for (const registro of registros) {
    lotes.add(registro.nroEnvio);
    marcas.add(registro.marca);
    if (registro.proveedor) proveedores.add(registro.proveedor);
    unidadesSolicitadas += registro.cantidadSolicitada;
    unidadesCompradas += registro.cantidadComprada;
  }

  return {
    actualizado: formatDate(now),
    registros,
    estados: [...PROCESO_ESTADOS],
    marcas: Array.from(marcas).sort((a, b) => a.localeCompare(b, "es")),
    proveedores: Array.from(proveedores).sort((a, b) => a.localeCompare(b, "es")),
    pendientesDeSincronizar,
    resumen: {
      lotes: lotes.size,
      sku: registros.length,
      unidadesSolicitadas,
      unidadesCompradas,
    },
  };
}

export function filterProceso(registros: ProcesoRegistro[], filters: ProcesoFilters) {
  const search = filters.texto.trim().toUpperCase();
  return registros.filter((registro) => {
    if (filters.estado && registro.estadoCompra !== filters.estado) return false;
    if (filters.marca && registro.marca !== filters.marca) return false;
    if (filters.proveedor && registro.proveedor !== filters.proveedor) return false;
    if (!search) return true;
    return `${registro.nroEnvio} ${registro.sku} ${registro.descripcion} ${registro.marca} ${registro.proveedor}`
      .toUpperCase()
      .includes(search);
  });
}
