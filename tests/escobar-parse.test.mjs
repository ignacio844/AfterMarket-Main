import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { includeEscobarDeposito, parseEscobarWorkbook } from "../bridge/escobar-parse.mjs";

test("incluye sólo las categorías Escobar no bloqueadas", () => {
  for (const deposito of ["DISTRIMAR B", "DISTRIMAR N", "JUNIMAR B", "ALEMAR B", "N"]) {
    assert.equal(includeEscobarDeposito(deposito), true, deposito);
  }
  for (const deposito of ["DISTRIMAR EXT", "JUNIMAR REV", "ALEMAR INV", "ALEMAR TEP", ""]) {
    assert.equal(includeEscobarDeposito(deposito), false, deposito);
  }
});

test("excluye sólo una fila confirmada, conserva el resto y registra la omisión", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inventario");
  sheet.addRow(["Código", "Saldo", "Otro", "Deposito"]);
  for (let row = 2; row <= 15002; row += 1) {
    sheet.addRow([row === 9520 ? "MB_211" : `SKU_${row}`, row === 9520 ? -24 : 1, "", "DISTRIMAR B"]);
  }
  const bytes = await workbook.xlsx.writeBuffer();
  const confirmed = [{ rowNumber: 9520, code: "MB_211", saldo: -24, deposito: "DISTRIMAR B" }];

  await assert.rejects(parseEscobarWorkbook(bytes, "17-09 INV GRAL.xlsx"), /Fila 9520: Código o Saldo inválido/);
  await assert.rejects(
    parseEscobarWorkbook(bytes, "17-09 INV GRAL.xlsx", { ignoredRows: [{ ...confirmed[0], saldo: -25 }] }),
    /la exclusión confirmada no coincide/,
  );
  const parsed = await parseEscobarWorkbook(bytes, "17-09 INV GRAL.xlsx", { ignoredRows: confirmed });
  assert.deepEqual(parsed.ignoredRows, confirmed);
  assert.equal(parsed.sourceRows, 15001);
  assert.equal(parsed.includedRows, 15000);
  assert.equal(parsed.uniqueSkus, 15000);
  assert.equal(parsed.totalStock, 15000);
  assert.equal(parsed.items.some((item) => item.sku === "MB_211"), false);
});
