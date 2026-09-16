import { createHash } from "node:crypto";
import XLSX from "xlsx";

export const ORDERS_SHEET = "STATUS ORDENES IMPORTADAS";
const REQUIRED = ["ORDENES", "MARCA", "CANTIDAD", "SITUACION", "STATUS", "FECHA", "PROVEEDOR"];
const STATUSES = new Set(["EN FABRICA", "A EMBARCAR", "EMBARCADO", "A INGRESAR", "INGRESADO"]);

function clean(value) { return String(value ?? "").trim(); }
function normalize(value) { return clean(value).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " "); }
function dateValue(value) {
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    return date ? `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}` : null;
  }
  const text = clean(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function parseOrdenesWorkbook(bytes) {
  const workbook = XLSX.read(bytes, { type: "buffer", sheets: ORDERS_SHEET, cellDates: false });
  const sheet = workbook.Sheets[ORDERS_SHEET];
  if (!sheet) throw new Error(`El Excel no contiene la pestaña ${ORDERS_SHEET}.`);
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  const headers = rows[0]?.map(normalize) ?? [];
  for (const field of REQUIRED) if (!headers.includes(field)) throw new Error(`Órdenes: falta la columna ${field}.`);
  const index = (field) => headers.indexOf(field);
  const items = [];
  const invalidRows = [];
  const statuses = {};
  const orders = new Set();
  let totalUnits = 0;
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const orden = clean(row[index("ORDENES")]);
    const item = clean(row[2]); // Encabezado vacío en el archivo actual.
    const status = normalize(row[index("STATUS")]);
    const quantity = Number(row[index("CANTIDAD")]);
    if (!orden && !item && !status) continue;
    if (!orden || !item || !STATUSES.has(status) || !Number.isFinite(quantity) || quantity < 0) {
      invalidRows.push({ rowNumber: rowIndex + 1, reason: !STATUSES.has(status) ? "STATUS_INVALIDO" : "ORDEN_ITEM_CANTIDAD_INVALIDOS" });
      continue;
    }
    const precioOriginal = clean(row[index("PRECIO")]);
    const precioNumero = precioOriginal.replace(/^(?:US\$|\$)\s*/i, "");
    const rowItem = {
      fila_origen: rowIndex + 1,
      orden,
      marca: clean(row[index("MARCA")]),
      item,
      cantidad: quantity,
      status,
      situacion: clean(row[index("SITUACION")]),
      packing_list: clean(row[index("PACKING LIST")]),
      prueba: clean(row[index("PRUEBA")]),
      precio: precioOriginal === "" ? null : Number(precioNumero),
      precio_original: precioOriginal,
      moneda: clean(row[index("MONEDA")]),
      fecha: dateValue(row[index("FECHA")]),
      proveedor: clean(row[index("PROVEEDOR")]),
      fecha_deposito: clean(row[index("FECHA DEPOSITO")]),
      fecha_entrega: clean(row[index("FECHA ENTREGA")]),
    };
    if (rowItem.precio !== null && !Number.isFinite(rowItem.precio)) {
      invalidRows.push({ rowNumber: rowIndex + 1, reason: "PRECIO_INVALIDO" });
      continue;
    }
    items.push(rowItem);
    orders.add(orden);
    statuses[status] = (statuses[status] ?? 0) + 1;
    totalUnits += quantity;
  }
  if (items.length < 2500 || orders.size < 100) throw new Error(`Órdenes incompletas: ${items.length} filas, ${orders.size} órdenes.`);
  if (invalidRows.length > Math.max(10, rows.length * 0.01)) throw new Error(`Demasiadas filas inválidas: ${invalidRows.length}.`);
  const hash = createHash("sha256");
  for (const item of items) hash.update(JSON.stringify(item) + "\n");
  return { items, invalidRows, sourceRows: rows.length - 1, orderCount: orders.size, totalUnits, statuses, datasetHash: hash.digest("hex") };
}
