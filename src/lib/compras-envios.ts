// Read-only port of obtenerEnviosCompraPortal() and its client-side filters.
import { columns, dashboardNumber, formatDate, text, value, type SheetRows, type SheetValue } from "@/lib/compras-dashboard";
import { sheetSerialDate } from "@/lib/compras-dates";

export type EnvioDetalle = {
  sku: string;
  descripcion: string;
  marca: string;
  riesgo: string;
  compraSugerida: number;
  cantidadDecidida: number;
  responsableDecision: string;
  observacion: string;
  fechaDecision: string;
  oc: string;
};

export type EnvioCompra = {
  nroEnvio: string;
  fechaEnvio: string;
  usuarioEnvio: string;
  sku: number;
  unidades: number;
  marcas: number;
  detalle: EnvioDetalle[];
  ocs: Array<{ nroOc: string; proveedor: string }>;
};

export type ComprasEnvios = {
  envios: EnvioCompra[];
  resumen: { envios: number; sku: number; unidades: number };
  proveedores: string[];
};

export type EnviosFilters = { texto: string; desde: string; hasta: string; marca: string };

function fechaPortal(input: SheetValue, timeZone: string) {
  if (!input) return "";
  const date = typeof input === "number" ? sheetSerialDate(input, timeZone) : new Date(String(input));
  return Number.isNaN(date.getTime()) ? String(input) : formatDate(date);
}

export function calculateComprasEnvios(
  sheets: { enviosCompra: SheetRows; ordenesCompra: SheetRows; procesoCompra?: SheetRows },
  sheetTimeZone = "America/Argentina/Buenos_Aires",
): ComprasEnvios {
  const grupos = new Map<string, EnvioCompra & { marcasSet: Set<string> }>();
  const rows = sheets.enviosCompra;
  if (rows.length >= 2) {
    const column = columns(rows[0]);
    if (column("NRO_ENVIO") < 0) throw new Error("ENVIOS_COMPRA no contiene NRO_ENVIO.");
    for (const row of rows.slice(1)) {
      const get = (name: string) => value(row, column(name));
      const nroEnvio = text(get("NRO_ENVIO"));
      if (!nroEnvio) continue;
      let grupo = grupos.get(nroEnvio);
      if (!grupo) {
        grupo = {
          nroEnvio,
          fechaEnvio: fechaPortal(get("FECHA_ENVIO"), sheetTimeZone),
          usuarioEnvio: String(get("USUARIO_ENVIO") || ""),
          sku: 0, unidades: 0, marcas: 0, marcasSet: new Set<string>(), detalle: [], ocs: [],
        };
        grupos.set(nroEnvio, grupo);
      }
      const cantidad = dashboardNumber(get("CANTIDAD_DECIDIDA"));
      const marca = text(get("MARCA") || "SIN MARCA") || "SIN MARCA";
      grupo.sku++;
      grupo.unidades += cantidad;
      grupo.marcasSet.add(marca);
      grupo.detalle.push({
        sku: String(get("SKU") || ""),
        descripcion: String(get("DESCRIPCION") || ""),
        marca,
        riesgo: String(get("RIESGO") || ""),
        compraSugerida: dashboardNumber(get("COMPRA_SUGERIDA")),
        cantidadDecidida: cantidad,
        responsableDecision: String(get("RESPONSABLE_DECISION") || ""),
        observacion: String(get("OBSERVACION") || ""),
        fechaDecision: fechaPortal(get("FECHA_DECISION"), sheetTimeZone),
        oc: "",
      });
    }
  }

  const ocRows = sheets.ordenesCompra;
  const ocPorSku = new Map<string, string>();
  if (ocRows.length >= 2) {
    const column = columns(ocRows[0]);
    const vistos = new Set<string>();
    for (const row of ocRows.slice(1)) {
      const nroEnvio = text(value(row, column("NRO_ENVIO")));
      const nroOc = text(value(row, column("NRO_OC")));
      const proveedor = text(value(row, column("PROVEEDOR")));
      const grupo = grupos.get(nroEnvio);
      if (!nroEnvio || !nroOc || !grupo) continue;
      const clave = `${nroEnvio}|${nroOc}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      grupo.ocs.push({ nroOc, proveedor });
    }
    for (const row of ocRows.slice(1)) {
      const nroEnvio = text(value(row, column("NRO_ENVIO")));
      const sku = text(value(row, column("SKU"))).toUpperCase();
      const nroOc = text(value(row, column("NRO_OC")));
      if (nroEnvio && sku && nroOc) ocPorSku.set(`${nroEnvio}|${sku}`, nroOc);
    }
  }

  const envios = Array.from(grupos.values()).map((grupo): EnvioCompra => ({
    nroEnvio: grupo.nroEnvio, fechaEnvio: grupo.fechaEnvio, usuarioEnvio: grupo.usuarioEnvio,
    sku: grupo.sku, unidades: grupo.unidades, marcas: grupo.marcasSet.size,
    detalle: grupo.detalle.map((row) => ({
      ...row, oc: ocPorSku.get(`${grupo.nroEnvio}|${row.sku.trim().toUpperCase()}`) || "",
    })),
    ocs: grupo.ocs.sort((a, b) => a.nroOc.localeCompare(b.nroOc)),
  })).sort((a, b) => b.nroEnvio.localeCompare(a.nroEnvio));
  // obtenerProveedoresOcPortal(): distinct names, case-insensitive, from
  // COMPRAS_EN_PROCESO and ORDENES_COMPRA_PORTAL, in that order.
  const proveedores = new Map<string, string>();
  for (const source of [sheets.procesoCompra ?? [], sheets.ordenesCompra]) {
    if (source.length < 2) continue;
    const proveedorColumn = columns(source[0])("PROVEEDOR");
    if (proveedorColumn < 0) continue;
    for (const row of source.slice(1)) {
      const proveedor = text(value(row, proveedorColumn));
      if (proveedor) proveedores.set(proveedor.toUpperCase(), proveedor);
    }
  }
  return {
    envios,
    resumen: summarizeEnvios(envios),
    proveedores: Array.from(proveedores.keys()).sort().map((key) => proveedores.get(key) || ""),
  };
}

export function summarizeEnvios(envios: EnvioCompra[]) {
  return {
    envios: envios.length,
    sku: envios.reduce((total, envio) => total + envio.sku, 0),
    unidades: envios.reduce((total, envio) => total + envio.unidades, 0),
  };
}

function fechaISO(fecha: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(fecha);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

export function filterEnvios(envios: EnvioCompra[], filters: EnviosFilters) {
  const texto = filters.texto.trim().toUpperCase();
  return envios.filter((envio) => {
    const fecha = fechaISO(envio.fechaEnvio);
    if (filters.desde && fecha && fecha < filters.desde) return false;
    if (filters.hasta && fecha && fecha > filters.hasta) return false;
    if (filters.marca && !envio.detalle.some((row) => row.marca === filters.marca)) return false;
    if (!texto) return true;
    const cabecera = `${envio.nroEnvio} ${envio.usuarioEnvio}`.toUpperCase();
    return cabecera.includes(texto) || envio.detalle.some((row) =>
      `${row.sku} ${row.descripcion} ${row.marca} ${row.observacion}`.toUpperCase().includes(texto));
  });
}
