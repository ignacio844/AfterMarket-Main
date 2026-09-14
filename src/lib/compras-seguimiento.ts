// Read-only port of obtenerSeguimientoContenedoresPortal().
// ORDENES (STATUS + SITUACION) remains the source of truth. No state-change
// actions are exposed here because the legacy no longer keeps a parallel state.
import {
  columns,
  dashboardNumber,
  formatDate,
  text,
  value,
  type SheetRows,
  type SheetValue,
} from "@/lib/compras-dashboard";
import { sheetSerialDate } from "@/lib/compras-dates";

export const SEGUIMIENTO_ESTADOS = [
  "EN FÁBRICA",
  "A EMBARCAR",
  "EMBARCADO",
  "A INGRESAR",
  "INGRESADO",
] as const;

export type SeguimientoEstado = (typeof SEGUIMIENTO_ESTADOS)[number];

export type SeguimientoError = {
  fila: number;
  orden: string;
  status: string;
  situacion: string;
  proveedor: string;
  motivo: string;
};

export type SeguimientoMercaderia = {
  ocProveedor: string;
  sku: string;
  descripcion: string;
  cantidadPl: number;
  cajas: number;
  estado: string;
};

export type SeguimientoRegistro = {
  tipo: "CONTENEDOR" | "ORDEN";
  numero: string;
  idPl: string;
  pi: string;
  ordenes: string[];
  packingLists: string[];
  proveedores: string[];
  proveedor: string;
  estado: SeguimientoEstado;
  situacion: string;
  fechaEstado: string;
  fechaEstadoFuente: string;
  fechaEmbarque: string;
  eta: string;
  fechaArribo: string;
  fechaIngreso: string;
  diasEstado: number | null;
  unidades: number;
  lineas: number;
  cajas: number;
  cbm: number;
  observacion: string;
  ocProveedor: string;
  filas: number[];
  cantidadOrdenes: number;
  cantidadPackingLists: number;
  cantidadProveedores: number;
  demora: boolean;
  items: SeguimientoMercaderia[];
};

export type ComprasSeguimiento = {
  actualizado: string;
  registros: SeguimientoRegistro[];
  errores: SeguimientoError[];
  proveedores: string[];
  resumen: {
    enSeguimiento: number;
    activos: number;
    enFabrica: number;
    aEmbarcar: number;
    embarcado: number;
    aIngresar: number;
    ingresado: number;
    demorados: number;
    errores: number;
  };
};

export type SeguimientoFilters = {
  texto: string;
  proveedor: string;
  estado: string;
};

const DISPLAY_TIME_ZONE = "America/Argentina/Buenos_Aires";

function normalize(input: SheetValue | undefined) {
  return text(input)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseDate(input: SheetValue, sheetTimeZone: string): Date | null {
  if (!input) return null;
  if (typeof input === "number") {
    const date = sheetSerialDate(input, sheetTimeZone);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const raw = text(input);
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (match) {
    // Midday UTC keeps the calendar day stable when only a display date exists.
    const date = new Date(Date.UTC(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1]),
      Number(match[4] || 12),
      Number(match[5] || 0),
    ));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(input: SheetValue, sheetTimeZone: string) {
  const date = parseDate(input, sheetTimeZone);
  if (!date) return text(input);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")}`;
}

function calendarDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (name: string) => Number(parts.find((item) => item.type === name)?.value || 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"));
}

function daysSince(date: Date | null, now: Date) {
  if (!date) return null;
  return Math.max(0, Math.floor((calendarDay(now) - calendarDay(date)) / 86_400_000));
}

function containerFromSituation(input: string) {
  return input.trim().replace(/^CONTENEDOR\s*/i, "").trim();
}

function resolveState(input: SheetValue): SeguimientoEstado | null {
  const normalized = normalize(input);
  const valid: Record<string, SeguimientoEstado> = {
    "EN FABRICA": "EN FÁBRICA",
    "A EMBARCAR": "A EMBARCAR",
    EMBARCADO: "EMBARCADO",
    "A INGRESAR": "A INGRESAR",
    INGRESADO: "INGRESADO",
  };
  return valid[normalized] ?? null;
}

export function calculateComprasSeguimiento(
  sheets: {
    ordenes: SheetRows;
    historialLogistica: SheetRows;
    packingListDetalle: SheetRows;
  },
  now = new Date(),
  sheetTimeZone = "America/Argentina/Buenos_Aires",
): ComprasSeguimiento {
  if (sheets.ordenes.length === 0) {
    return {
      actualizado: formatDate(now),
      registros: [],
      errores: [],
      proveedores: [],
      resumen: {
        enSeguimiento: 0,
        activos: 0,
        enFabrica: 0,
        aEmbarcar: 0,
        embarcado: 0,
        aIngresar: 0,
        ingresado: 0,
        demorados: 0,
        errores: 0,
      },
    };
  }

  const historyByKey = new Map<string, Date>();
  if (sheets.historialLogistica.length > 1) {
    const column = columns(sheets.historialLogistica[0]);
    const cFecha = column("FECHA");
    const cEstado = column("ESTADO_NUEVO");
    const cPi = column("PI");
    const cOc = column("OC");
    const cPl = column("ID_PL");

    for (const row of sheets.historialLogistica.slice(1)) {
      const fecha = parseDate(value(row, cFecha), sheetTimeZone);
      const estado = normalize(value(row, cEstado));
      const pi = text(value(row, cPi));
      const oc = text(value(row, cOc));
      const pl = text(value(row, cPl));
      if (!fecha || !estado) continue;

      for (const key of [
        pi ? `PI|${normalize(pi)}` : "",
        oc ? `OC|${normalize(oc)}` : "",
        pl ? `PL|${normalize(pl)}` : "",
      ]) {
        if (!key) continue;
        const compound = `${key}|${estado}`;
        const previous = historyByKey.get(compound);
        if (!previous || fecha.getTime() > previous.getTime()) historyByKey.set(compound, fecha);
      }
    }
  }

  function stateDate(order: string, packing: string, state: string) {
    const normalizedState = normalize(state);
    const candidates = [
      order ? historyByKey.get(`PI|${normalize(order)}|${normalizedState}`) : undefined,
      order ? historyByKey.get(`OC|${normalize(order)}|${normalizedState}`) : undefined,
      packing ? historyByKey.get(`PL|${normalize(packing)}|${normalizedState}`) : undefined,
    ].filter((date): date is Date => Boolean(date));
    candidates.sort((a, b) => b.getTime() - a.getTime());
    return candidates[0] ?? null;
  }

  type MutableGroup = Omit<SeguimientoRegistro, "cantidadOrdenes" | "cantidadPackingLists" | "cantidadProveedores" | "demora" | "items"> & {
    fechaEstadoObj: Date | null;
  };

  const groups = new Map<string, MutableGroup>();
  const errores: SeguimientoError[] = [];
  const column = columns(sheets.ordenes[0]);
  const cOrden = column("ID_ORDEN", "ORDEN", "NUMERO_ORDEN", "NUMERO_PI", "PI");
  const cProveedor = column("PROVEEDOR");
  const cStatus = column("STATUS", "ESTADO");
  const cSituacion = column("SITUACION");
  const cPl = column("PACKING_LIST");
  const cFechaEmbarque = column("FECHA_EMBARQUE");
  const cEta = column("FECHA_ESTIMADA_ARRIBO", "ETA");
  const cFechaArribo = column("FECHA_ARRIBO");
  const cFechaIngreso = column("FECHA_INGRESO");
  const cUnidades = column("UNIDADES");
  const cLineas = column("LINEAS");

  for (let index = 1; index < sheets.ordenes.length; index++) {
    const row = sheets.ordenes[index];
    const rowNumber = index + 1;
    const orden = text(value(row, cOrden));
    const proveedor = text(value(row, cProveedor));
    const statusRaw = text(value(row, cStatus));
    const estado = resolveState(statusRaw);
    if (!estado) continue;

    const situacion = text(value(row, cSituacion));
    const situacionNormalizada = normalize(situacion);
    const packing = text(value(row, cPl));
    const fechaEmbarqueRaw = value(row, cFechaEmbarque);
    const etaRaw = value(row, cEta);
    const fechaArriboRaw = value(row, cFechaArribo);
    const fechaIngresoRaw = value(row, cFechaIngreso);
    const unidades = dashboardNumber(value(row, cUnidades));
    const lineas = dashboardNumber(value(row, cLineas));
    const post = estado === "EMBARCADO" || estado === "A INGRESAR" || estado === "INGRESADO";

    let inconsistencia = "";
    if (post && situacionNormalizada.includes("EN FABRICA")) {
      inconsistencia = `Un contenedor no puede estar EN FABRICA cuando STATUS = ${estado}.`;
    } else if (post && !situacionNormalizada.startsWith("CONTENEDOR")) {
      inconsistencia = `STATUS ${estado} requiere una SITUACION que identifique el CONTENEDOR.`;
    } else if (estado === "EN FÁBRICA" && situacionNormalizada.startsWith("CONTENEDOR")) {
      inconsistencia = "Una orden EN FABRICA no debería estar asignada a un contenedor.";
    }

    if (inconsistencia) {
      errores.push({ fila: rowNumber, orden, status: statusRaw, situacion, proveedor, motivo: inconsistencia });
      continue;
    }

    const numero = post ? containerFromSituation(situacion) : "";
    const key = post
      ? `C|${normalize(numero)}`
      : `P|${normalize(packing || orden || `FILA ${rowNumber}`)}`;
    const fechaEstadoReal = stateDate(orden, packing, estado);

    if (!groups.has(key)) {
      groups.set(key, {
        tipo: post ? "CONTENEDOR" : "ORDEN",
        numero,
        idPl: packing,
        pi: orden,
        ordenes: [],
        packingLists: [],
        proveedores: [],
        proveedor,
        estado,
        situacion,
        fechaEstado: fechaEstadoReal ? formatDateOnly(fechaEstadoReal.toISOString(), sheetTimeZone) : "",
        fechaEstadoFuente: fechaEstadoReal ? "HISTORIAL_ESTADOS_LOGISTICA" : "",
        fechaEstadoObj: fechaEstadoReal,
        fechaEmbarque: formatDateOnly(fechaEmbarqueRaw, sheetTimeZone),
        eta: formatDateOnly(etaRaw, sheetTimeZone),
        fechaArribo: formatDateOnly(fechaArriboRaw, sheetTimeZone),
        fechaIngreso: formatDateOnly(fechaIngresoRaw, sheetTimeZone),
        diasEstado: daysSince(fechaEstadoReal, now),
        unidades: 0,
        lineas: 0,
        cajas: 0,
        cbm: 0,
        observacion: "",
        ocProveedor: "",
        filas: [],
      });
    }

    const group = groups.get(key)!;
    if (group.estado !== estado) {
      errores.push({
        fila: rowNumber,
        orden,
        status: statusRaw,
        situacion,
        proveedor,
        motivo: `El mismo contenedor/agrupación tiene más de un STATUS (${group.estado} / ${estado}).`,
      });
    }

    if (fechaEstadoReal && (!group.fechaEstadoObj || fechaEstadoReal.getTime() > group.fechaEstadoObj.getTime())) {
      group.fechaEstadoObj = fechaEstadoReal;
      group.fechaEstado = formatDateOnly(fechaEstadoReal.toISOString(), sheetTimeZone);
      group.fechaEstadoFuente = "HISTORIAL_ESTADOS_LOGISTICA";
      group.diasEstado = daysSince(fechaEstadoReal, now);
    }

    if (orden && !group.ordenes.includes(orden)) group.ordenes.push(orden);
    if (packing && !group.packingLists.includes(packing)) group.packingLists.push(packing);
    if (proveedor && !group.proveedores.includes(proveedor)) group.proveedores.push(proveedor);
    group.unidades += unidades;
    group.lineas += lineas;
    group.filas.push(rowNumber);
    if (!group.fechaEmbarque && fechaEmbarqueRaw) group.fechaEmbarque = formatDateOnly(fechaEmbarqueRaw, sheetTimeZone);
    if (!group.eta && etaRaw) group.eta = formatDateOnly(etaRaw, sheetTimeZone);
    if (!group.fechaArribo && fechaArriboRaw) group.fechaArribo = formatDateOnly(fechaArriboRaw, sheetTimeZone);
    if (!group.fechaIngreso && fechaIngresoRaw) group.fechaIngreso = formatDateOnly(fechaIngresoRaw, sheetTimeZone);
  }

  const packingItemsByPl = new Map<string, SeguimientoMercaderia[]>();
  if (sheets.packingListDetalle.length > 1) {
    const detailColumn = columns(sheets.packingListDetalle[0]);
    const cId = detailColumn("ID_PL");
    const cOc = detailColumn("OC_PROVEEDOR", "OC");
    const cSku = detailColumn("SKU");
    const cDescripcion = detailColumn("DESCRIPCION");
    const cCantidad = detailColumn("CANTIDAD_PL");
    const cCajas = detailColumn("CAJAS");

    for (const row of sheets.packingListDetalle.slice(1)) {
      const idPl = text(value(row, cId));
      if (!idPl) continue;
      const items = packingItemsByPl.get(idPl) ?? [];
      items.push({
        ocProveedor: text(value(row, cOc)),
        sku: text(value(row, cSku)),
        descripcion: text(value(row, cDescripcion)),
        cantidadPl: dashboardNumber(value(row, cCantidad)),
        cajas: dashboardNumber(value(row, cCajas)),
        estado: "",
      });
      packingItemsByPl.set(idPl, items);
    }
  }

  function isDelayed(group: MutableGroup) {
    if (group.estado !== "EMBARCADO" && group.estado !== "A INGRESAR") return false;
    if (group.fechaIngreso) return false;
    const eta = parseDate(group.eta, sheetTimeZone);
    if (!eta) return false;
    return calendarDay(eta) < calendarDay(now);
  }

  const registros: SeguimientoRegistro[] = Array.from(groups.values()).map((group) => {
    const items = group.packingLists.flatMap((packing) => packingItemsByPl.get(packing) ?? [])
      .map((item) => ({ ...item, estado: group.estado }));
    const { fechaEstadoObj: _fechaEstadoObj, ...base } = group;
    return {
      ...base,
      pi: group.ordenes.join(", "),
      idPl: group.packingLists.join(", "),
      proveedor: group.proveedores.join(" / "),
      cantidadOrdenes: group.ordenes.length,
      cantidadPackingLists: group.packingLists.length,
      cantidadProveedores: group.proveedores.length,
      demora: isDelayed(group),
      items,
    };
  });

  const resumen: ComprasSeguimiento["resumen"] = {
    enSeguimiento: 0,
    activos: 0,
    enFabrica: 0,
    aEmbarcar: 0,
    embarcado: 0,
    aIngresar: 0,
    ingresado: 0,
    demorados: 0,
    errores: errores.length,
  };

  for (const registro of registros) {
    if (registro.estado !== "INGRESADO") {
      resumen.enSeguimiento++;
      resumen.activos++;
    }
    if (registro.estado === "EN FÁBRICA") resumen.enFabrica++;
    if (registro.estado === "A EMBARCAR") resumen.aEmbarcar++;
    if (registro.estado === "EMBARCADO") resumen.embarcado++;
    if (registro.estado === "A INGRESAR") resumen.aIngresar++;
    if (registro.estado === "INGRESADO") resumen.ingresado++;
    if (registro.demora) resumen.demorados++;
  }

  const proveedores = Array.from(new Set(registros.flatMap((registro) => registro.proveedores)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

  return {
    actualizado: formatDate(now),
    registros,
    errores,
    proveedores,
    resumen,
  };
}

export function filterSeguimiento(registros: SeguimientoRegistro[], filters: SeguimientoFilters) {
  const search = filters.texto.trim().toUpperCase();
  return registros.filter((registro) => {
    if (filters.proveedor && !registro.proveedores.includes(filters.proveedor)) return false;
    if (filters.estado && registro.estado !== filters.estado) return false;
    if (!search) return true;
    return [
      registro.numero,
      registro.idPl,
      registro.pi,
      registro.ordenes.join(" "),
      registro.proveedor,
      registro.situacion,
    ].join(" ").toUpperCase().includes(search);
  });
}
