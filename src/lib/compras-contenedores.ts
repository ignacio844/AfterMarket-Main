// Read-only port of obtenerContenedoresPortal().
// Creating/editing containers and associating Packing Lists are intentionally
// excluded because those legacy actions write to Google Sheets.
import { columns, dashboardNumber, formatDate, text, value, type SheetRows, type SheetValue } from "@/lib/compras-dashboard";
import { sheetSerialDate } from "@/lib/compras-dates";

export type Contenedor = {
  numero: string;
  fechaEmbarque: string;
  eta: string;
  estado: string;
  observacion: string;
  fechaCarga: string;
  usuarioCarga: string;
};

export type ContenedorAsociacion = {
  numero: string;
  idPl: string;
  pi: string;
  proveedor: string;
  unidades: number;
  cajas: number;
  cbm: number;
  fechaAsociacion: string;
  usuario: string;
};

export type ContenedorRegistro = Contenedor & {
  idPl: string;
  pi: string;
  proveedor: string;
  unidades: number;
  cajas: number;
  cbm: number;
};

export type PackingDisponible = {
  idPl: string;
  pi: string;
  proveedor: string;
  unidades: number;
  cajas: number;
  cbm: number;
};

export type ComprasContenedores = {
  actualizado: string;
  contenedores: Contenedor[];
  asociaciones: ContenedorAsociacion[];
  registros: ContenedorRegistro[];
  packingDisponibles: PackingDisponible[];
  proveedores: string[];
  estados: string[];
  resumen: {
    contenedores: number;
    packingLists: number;
    cajas: number;
    cbm: number;
    packingDisponibles: number;
  };
};

export type ContenedoresFilters = {
  texto: string;
  proveedor: string;
  estado: string;
};

function portalDate(input: SheetValue, timeZone: string) {
  if (!input) return "";
  const date = typeof input === "number" ? sheetSerialDate(input, timeZone) : new Date(String(input));
  return Number.isNaN(date.getTime()) ? String(input) : formatDate(date);
}

export function calculateComprasContenedores(
  sheets: { contenedores: SheetRows; contenedorPacking: SheetRows; packingList: SheetRows },
  now = new Date(),
  sheetTimeZone = "America/Argentina/Buenos_Aires",
): ComprasContenedores {
  const contenedores: Contenedor[] = [];
  const asociaciones: ContenedorAsociacion[] = [];
  const packingMap = new Map<string, PackingDisponible>();
  const usados = new Set<string>();
  const proveedores = new Set<string>();
  const estados = new Set<string>(["EMBARCADO", "A INGRESAR", "INGRESADO"]);

  if (sheets.packingList.length > 0) {
    const column = columns(sheets.packingList[0]);
    const cId = column("ID_PL");
    if (cId < 0) throw new Error("PACKING_LIST no contiene la columna ID_PL.");

    for (const row of sheets.packingList.slice(1)) {
      const get = (name: string) => value(row, column(name));
      const idPl = text(value(row, cId));
      if (!idPl) continue;
      const item: PackingDisponible = {
        idPl,
        pi: text(get("PI")),
        proveedor: text(get("PROVEEDOR")),
        unidades: dashboardNumber(get("TOTAL_UNIDADES")),
        cajas: dashboardNumber(get("TOTAL_CAJAS")),
        cbm: dashboardNumber(get("CBM_TOTAL")),
      };
      packingMap.set(idPl, item);
    }
  }

  if (sheets.contenedores.length > 0) {
    const column = columns(sheets.contenedores[0]);
    const cNumero = column("NRO_CONTENEDOR");
    if (cNumero < 0) throw new Error("CONTENEDORES no contiene la columna NRO_CONTENEDOR.");

    for (const row of sheets.contenedores.slice(1)) {
      const get = (name: string) => value(row, column(name));
      const numero = text(value(row, cNumero));
      if (!numero) continue;
      const estado = text(get("ESTADO")).toUpperCase();
      if (estado) estados.add(estado);
      contenedores.push({
        numero,
        fechaEmbarque: portalDate(get("FECHA_EMBARQUE"), sheetTimeZone),
        eta: portalDate(get("ETA"), sheetTimeZone),
        estado,
        observacion: text(get("OBSERVACION")),
        fechaCarga: portalDate(get("FECHA_CARGA"), sheetTimeZone),
        usuarioCarga: text(get("USUARIO_CARGA")),
      });
    }
  }

  if (sheets.contenedorPacking.length > 0) {
    const column = columns(sheets.contenedorPacking[0]);
    const cNumero = column("NRO_CONTENEDOR");
    const cId = column("ID_PL");
    if (cNumero < 0 || cId < 0) throw new Error("CONTENEDOR_PACKING_LIST debe contener NRO_CONTENEDOR e ID_PL.");

    for (const row of sheets.contenedorPacking.slice(1)) {
      const get = (name: string) => value(row, column(name));
      const numero = text(value(row, cNumero));
      const idPl = text(value(row, cId));
      if (!numero || !idPl) continue;
      usados.add(idPl);
      const packing = packingMap.get(idPl);
      const proveedor = packing?.proveedor || "";
      if (proveedor) proveedores.add(proveedor);
      asociaciones.push({
        numero,
        idPl,
        pi: packing?.pi || "",
        proveedor,
        unidades: packing?.unidades || 0,
        cajas: packing?.cajas || 0,
        cbm: packing?.cbm || 0,
        fechaAsociacion: portalDate(get("FECHA_ASOCIACION"), sheetTimeZone),
        usuario: text(get("USUARIO")),
      });
    }
  }

  const asociacionesPorNumero = new Map<string, ContenedorAsociacion[]>();
  for (const asociacion of asociaciones) {
    const actual = asociacionesPorNumero.get(asociacion.numero) ?? [];
    actual.push(asociacion);
    asociacionesPorNumero.set(asociacion.numero, actual);
  }

  const registros: ContenedorRegistro[] = [];
  for (const contenedor of contenedores) {
    const relacionadas = asociacionesPorNumero.get(contenedor.numero) ?? [];
    if (relacionadas.length === 0) {
      registros.push({ ...contenedor, idPl: "", pi: "", proveedor: "", unidades: 0, cajas: 0, cbm: 0 });
      continue;
    }
    for (const asociacion of relacionadas) {
      registros.push({
        ...contenedor,
        idPl: asociacion.idPl,
        pi: asociacion.pi,
        proveedor: asociacion.proveedor,
        unidades: asociacion.unidades,
        cajas: asociacion.cajas,
        cbm: asociacion.cbm,
      });
    }
  }

  const packingDisponibles = Array.from(packingMap.values())
    .filter((packing) => !usados.has(packing.idPl))
    .sort((a, b) => a.idPl.localeCompare(b.idPl, "es"));

  let cajas = 0;
  let cbm = 0;
  for (const asociacion of asociaciones) {
    cajas += asociacion.cajas;
    cbm += asociacion.cbm;
  }

  return {
    actualizado: formatDate(now),
    contenedores,
    asociaciones,
    registros,
    packingDisponibles,
    proveedores: Array.from(proveedores).sort((a, b) => a.localeCompare(b, "es")),
    estados: Array.from(estados),
    resumen: {
      contenedores: contenedores.length,
      packingLists: asociaciones.length,
      cajas,
      cbm,
      packingDisponibles: packingDisponibles.length,
    },
  };
}

export function filterContenedores(registros: ContenedorRegistro[], filters: ContenedoresFilters) {
  const search = filters.texto.trim().toUpperCase();
  return registros.filter((registro) => {
    if (filters.proveedor && registro.proveedor !== filters.proveedor) return false;
    if (filters.estado && registro.estado !== filters.estado) return false;
    if (!search) return true;
    return `${registro.numero} ${registro.idPl} ${registro.pi} ${registro.proveedor} ${registro.estado} ${registro.observacion}`
      .toUpperCase()
      .includes(search);
  });
}
