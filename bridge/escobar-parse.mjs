import { createHash } from "node:crypto";
import ExcelJS from "exceljs";

const EXCLUDED_DEPOSITOS = /EXT|REV|INV|TEP/i;

export function includeEscobarDeposito(value) {
  const deposito = String(value ?? "").trim();
  return deposito.length > 0 && !EXCLUDED_DEPOSITOS.test(deposito);
}

function text(value) {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
}

function header(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function sku(value) {
  return text(value).replace(/\s+/g, "").toUpperCase();
}

export async function parseEscobarWorkbook(input, fileName, { ignoredRows = [] } = {}) {
  const buffer = Buffer.from(input);
  if (!/\.xlsx$/i.test(fileName) || buffer.length < 1000 || buffer.length > 20_000_000) {
    throw new Error("El inventario Escobar debe ser un XLSX válido de hasta 20 MB.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("El XLSX de Escobar no contiene hojas.");

  const headers = [1, 2, 3, 4].map((column) => header(sheet.getRow(1).getCell(column).value));
  if (!headers[0].includes("CODIGO") || headers[1] !== "SALDO" || headers[3] !== "DEPOSITO") {
    throw new Error("El XLSX de Escobar debe tener Código, Saldo y Deposito en las columnas A, B y D.");
  }

  const stockBySku = new Map();
  const categoryRows = {};
  let sourceRows = 0;
  let includedRows = 0;
  let excludedRows = 0;
  let duplicateRows = 0;
  const ignoredRowsApplied = [];
  const ignoredByNumber = new Map(ignoredRows.map((row) => [row.rowNumber, row]));
  if (ignoredByNumber.size !== ignoredRows.length) throw new Error("Hay filas de Escobar duplicadas para excluir.");

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (!row.hasValues) continue;
    sourceRows += 1;
    const deposito = text(row.getCell(4).value).toUpperCase();
    if (!deposito) throw new Error(`Fila ${rowNumber}: falta Deposito.`);
    categoryRows[deposito] = (categoryRows[deposito] ?? 0) + 1;
    if (!includeEscobarDeposito(deposito)) {
      excludedRows += 1;
      continue;
    }

    const code = sku(row.getCell(1).value);
    const saldo = row.getCell(2).value;
    const ignored = ignoredByNumber.get(rowNumber);
    if (ignored) {
      if (code !== ignored.code || saldo !== ignored.saldo || deposito !== ignored.deposito) {
        throw new Error(`Fila ${rowNumber}: la exclusión confirmada no coincide con el archivo.`);
      }
      ignoredRowsApplied.push({ rowNumber, code, saldo, deposito });
      continue;
    }
    if (!code || typeof saldo !== "number" || !Number.isFinite(saldo) || saldo < 0) {
      throw new Error(`Fila ${rowNumber}: Código o Saldo inválido en depósito incluido.`);
    }
    includedRows += 1;
    if (stockBySku.has(code)) duplicateRows += 1;
    stockBySku.set(code, (stockBySku.get(code) ?? 0) + saldo);
  }
  if (ignoredRowsApplied.length !== ignoredRows.length) throw new Error("No se encontró la fila confirmada para excluir de Escobar.");

  const items = [...stockBySku].map(([code, saldo]) => ({
    sku: code,
    stock: Number(saldo.toFixed(3)),
    source_row_number: null,
  })).sort((a, b) => a.sku.localeCompare(b.sku));
  const totalStock = Number(items.reduce((sum, item) => sum + item.stock, 0).toFixed(3));
  if (items.length < 10_000 || includedRows < 15_000 || totalStock <= 0) {
    throw new Error(`Inventario Escobar incompleto: ${items.length} SKU, ${includedRows} filas incluidas, ${totalStock} unidades.`);
  }

  return {
    fileName,
    fileSha256: createHash("sha256").update(buffer).digest("hex"),
    worksheet: sheet.name,
    sourceRows,
    includedRows,
    excludedRows,
    ignoredRows: ignoredRowsApplied,
    duplicateRows,
    uniqueSkus: items.length,
    totalStock,
    categoryRows,
    items,
  };
}
