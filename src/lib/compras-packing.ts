// Read-only port of obtenerPackingListPortal().
// Importing XLSX files and changing logistic states are intentionally excluded
// because those legacy actions write to Google Sheets.
import { columns, dashboardNumber, formatDate, text, value, type SheetRows, type SheetValue } from "@/lib/compras-dashboard";
import { sheetSerialDate } from "@/lib/compras-dates";

export const PACKING_ESTADOS = [
  "EN FÁBRICA",
  "A EMBARCAR",
  "EMBARCADO",
  "A INGRESAR",
  "INGRESADO",
] as const;

export type PackingCabecera = {
  idPl: string;
  pi: string;
  proveedor: string;
  fechaPl: string;
  estadoLogistico: string;
  totalSku: number;
  totalUnidades: number;
  totalCajas: number;
  pesoBrutoTotal: number;
  pesoNetoTotal: number;
  cbmTotal: number;
  archivoOrigen: string;
  observacion: string;
};

export type PackingRegistro = {
  idPl: string;
  pi: string;
  nroEnvio: string;
  ocProveedor: string;
  ocInterna: string;
  proveedor: string;
  estadoPl: string;
  estadoItem: string;
  sku: string;
  descripcion: string;
  cantidadComprada: number;
  cantidadPl: number;
  diferencia: number;
  unidad: string;
  qtyCaja: number;
  cajas: number;
  rangoCajas: string;
  pesoBruto: number;
  pesoNeto: number;
  cbmCaja: number;
  cbmTotal: number;
  observacion: string;
  fechaEstado: string;
  responsableEstado: string;
  observacionEstado: string;
};

export type ComprasPacking = {
  actualizado: string;
  cabeceras: PackingCabecera[];
  registros: PackingRegistro[];
  proveedores: string[];
  estados: string[];
  resumen: {
    packingLists: number;
    lineasSku: number;
    unidadesPl: number;
    diferencias: number;
  };
};

export type PackingFilters = {
  texto: string;
  proveedor: string;
  estado: string;
};

function portalDate(input: SheetValue, timeZone: string) {
  if (!input) return "";
  const date = typeof input === "number" ? sheetSerialDate(input, timeZone) : new Date(String(input));
  return Number.isNaN(date.getTime()) ? String(input) : formatDate(date);
}

export function calculateComprasPacking(
  sheets: { packingList: SheetRows; packingListDetalle: SheetRows },
  now = new Date(),
  sheetTimeZone = "America/Argentina/Buenos_Aires",
): ComprasPacking {
  const cabeceras: PackingCabecera[] = [];
  const registros: PackingRegistro[] = [];
  const proveedores = new Set<string>();
  const estados = new Set<string>(PACKING_ESTADOS);
  const cabPorId = new Map<string, PackingCabecera>();

  if (sheets.packingList.length > 0) {
    const column = columns(sheets.packingList[0]);
    const cId = column("ID_PL");
    if (cId < 0) throw new Error("PACKING_LIST no contiene la columna ID_PL.");

    for (const row of sheets.packingList.slice(1)) {
      const get = (name: string) => value(row, column(name));
      const idPl = text(get("ID_PL"));
      if (!idPl) continue;
      const proveedor = text(get("PROVEEDOR"));
      const estadoLogistico = (text(get("ESTADO_LOGISTICO")) || "EN FÁBRICA").toUpperCase();
      const cabecera: PackingCabecera = {
        idPl,
        pi: text(get("PI")),
        proveedor,
        fechaPl: portalDate(get("FECHA_PL"), sheetTimeZone),
        estadoLogistico,
        totalSku: dashboardNumber(get("TOTAL_SKU")),
        totalUnidades: dashboardNumber(get("TOTAL_UNIDADES")),
        totalCajas: dashboardNumber(get("TOTAL_CAJAS")),
        pesoBrutoTotal: dashboardNumber(get("PESO_BRUTO_TOTAL")),
        pesoNetoTotal: dashboardNumber(get("PESO_NETO_TOTAL")),
        cbmTotal: dashboardNumber(get("CBM_TOTAL")),
        archivoOrigen: text(get("ARCHIVO_ORIGEN")),
        observacion: text(get("OBSERVACION")),
      };
      cabeceras.push(cabecera);
      cabPorId.set(idPl, cabecera);
      if (proveedor) proveedores.add(proveedor);
      if (estadoLogistico) estados.add(estadoLogistico);
    }
  }

  if (sheets.packingListDetalle.length > 0) {
    const column = columns(sheets.packingListDetalle[0]);
    const cId = column("ID_PL");
    const cSku = column("SKU");
    if (cId < 0 || cSku < 0) throw new Error("PACKING_LIST_DETALLE debe contener ID_PL y SKU.");
    const cOcProveedor = column("OC_PROVEEDOR", "OC");
    const cOcInterna = column("OC_INTERNA");

    for (const row of sheets.packingListDetalle.slice(1)) {
      const get = (name: string) => value(row, column(name));
      const idPl = text(value(row, cId));
      const sku = text(value(row, cSku));
      if (!idPl || !sku) continue;
      const cabecera = cabPorId.get(idPl);
      const estadoPl = cabecera?.estadoLogistico || "EN FÁBRICA";
      const estadoItem = (text(get("ESTADO_ITEM")) || estadoPl).toUpperCase();
      if (estadoItem) estados.add(estadoItem);

      registros.push({
        idPl,
        pi: text(get("PI")) || cabecera?.pi || "",
        nroEnvio: text(get("NRO_ENVIO")),
        ocProveedor: text(value(row, cOcProveedor)),
        ocInterna: text(value(row, cOcInterna)),
        proveedor: cabecera?.proveedor || "",
        estadoPl,
        estadoItem,
        sku,
        descripcion: text(get("DESCRIPCION")),
        cantidadComprada: dashboardNumber(get("CANTIDAD_COMPRADA")),
        cantidadPl: dashboardNumber(get("CANTIDAD_PL")),
        diferencia: dashboardNumber(get("DIFERENCIA")),
        unidad: text(get("UNIDAD")),
        qtyCaja: dashboardNumber(get("QTY_CAJA")),
        cajas: dashboardNumber(get("CAJAS")),
        rangoCajas: text(get("RANGO_CAJAS")),
        pesoBruto: dashboardNumber(get("PESO_BRUTO")),
        pesoNeto: dashboardNumber(get("PESO_NETO")),
        cbmCaja: dashboardNumber(get("CBM_CAJA")),
        cbmTotal: dashboardNumber(get("CBM_TOTAL")),
        observacion: text(get("OBSERVACION")),
        fechaEstado: portalDate(get("FECHA_ESTADO"), sheetTimeZone),
        responsableEstado: text(get("RESPONSABLE_ESTADO")),
        observacionEstado: text(get("OBSERVACION_ESTADO")),
      });
    }
  }

  let unidadesPl = 0;
  let diferencias = 0;
  for (const registro of registros) {
    unidadesPl += registro.cantidadPl;
    diferencias += registro.diferencia;
  }

  return {
    actualizado: formatDate(now),
    cabeceras,
    registros,
    proveedores: Array.from(proveedores).sort((a, b) => a.localeCompare(b, "es")),
    estados: Array.from(estados),
    resumen: {
      packingLists: cabeceras.length,
      lineasSku: registros.length,
      unidadesPl,
      diferencias,
    },
  };
}

export function filterPacking(registros: PackingRegistro[], filters: PackingFilters) {
  const search = filters.texto.trim().toUpperCase();
  return registros.filter((registro) => {
    if (filters.proveedor && registro.proveedor !== filters.proveedor) return false;
    if (filters.estado && registro.estadoItem !== filters.estado) return false;
    if (!search) return true;
    return `${registro.idPl} ${registro.pi} ${registro.ocProveedor} ${registro.ocInterna} ${registro.sku} ${registro.descripcion} ${registro.proveedor}`
      .toUpperCase()
      .includes(search);
  });
}
