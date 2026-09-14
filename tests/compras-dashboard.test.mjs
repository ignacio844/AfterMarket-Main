import assert from "node:assert/strict";
import test from "node:test";
import { calculateComprasDashboard, dashboardNumber } from "../src/lib/compras-dashboard.ts";

const now = new Date("2026-09-14T15:00:00.000Z");

function sheets(overrides = {}) {
  return {
    modelo: [
      [],
      ["SKU", "MARCA", "RIESGO", "STOCK_TOTAL", "PENDIENTE_TOTAL", "PROMEDIO_MENSUAL", "CONSUMO_12_MESES", "COMPRA_SUGERIDA"],
      ["A", "HID-XENON", "SIN STOCK", 0, 4, 2, 24, 8],
      ["B", "HID-XENON", "URGENTE", 6, 2, 3, 36, 5],
      ["C", "LOCAL", "COMPRAR", 10, 1, 5, 60, 2],
      ["D", "EXCLUIDA", "SIN STOCK", 100, 20, 10, 120, 99],
      ["", "LOCAL", "URGENTE", 10, 5, 2, 24, 7],
    ],
    config: [
      ["MARCA", "COMPRA", "ORIGEN", "COBERTURA_OBJETIVO"],
      ["HID XENON", "SI", "IMPORTADO", 6],
      ["LOCAL", "SI", "NACIONAL", "1,5"],
    ],
    alias: [
      ["ALIAS", "MARCA CONFIGURADA", "ACTIVO"],
      ["HID-XENON", "HID XENON", "SI"],
    ],
    controlStock: [
      ["DEPOSITO", "ULTIMA_IMPORTACION"],
      ["Stock Warnes", "13/09/2026 12:00"],
      ["Escobar", "10/09/2026 12:00"],
    ],
    ventas: [["FECHA_IMPORTACION"], ["14/09/2026 12:00"]],
    logImportaciones: [
      ["FECHA", "USUARIO", "TIPO", "ARCHIVO", "ESTADO"],
      ["12/09/2026 12:00", "a", "ORDENES", "foo", "OK"],
    ],
    ...overrides,
  };
}

test("reproduce risk gating, physical totals, weighted coverage and brand groups", () => {
  const result = calculateComprasDashboard(sheets(), "usuario@grupo-aftermarket.com", now);
  assert.equal(result.totalSku, 4);
  assert.deepEqual([result.sinStock, result.urgente, result.comprar, result.revisar], [1, 1, 1, 0]);
  assert.deepEqual([result.stock, result.pendiente, result.compraSugerida], [116, 27, 15]);
  assert.equal(result.coberturaPromedio, 16 / 10);
  assert.equal(result.marcasImportadas[0].marca, "HID-XENON");
  assert.equal(result.marcasImportadas[0].consumoTrimestralPromedio, 15);
  assert.equal(result.marcasImportadas[0].coberturaPromedio, 6 / 5);
  assert.equal(result.marcasNacionales[0].coberturaObjetivo, 1.5);
  assert.equal(result.marcasNoCompra.length, 1);
  assert.equal(result.marcas.length, 2);
});

test("preserves freshness thresholds and both order log formats", () => {
  const result = calculateComprasDashboard(sheets(), "u", now);
  assert.deepEqual([
    result.fuentes.stockWarnes.icono,
    result.fuentes.stockEscobar.icono,
    result.fuentes.ventas.icono,
    result.fuentes.ordenes.icono,
  ], ["🟢", "🔴", "🟢", "🟡"]);
  assert.equal(result.fuentes.stockWarnes.fecha, "13/09/2026 12:00");

  const oldLog = sheets({ logImportaciones: [["FECHA", "TIPO", "ARCHIVO", "", "", "RESULTADO"], ["14/09/2026 10:00", "ORDENES", "old.xlsx", "", "", "COMPLETADA"]] });
  assert.equal(calculateComprasDashboard(oldLog, "u", now).fuentes.ordenes.icono, "🟢");
});

test("keeps legacy column aliases, number formats and zero-purchase fallback", () => {
  assert.equal(dashboardNumber("1.234,5"), 1234.5);
  assert.equal(dashboardNumber("1,234.5"), 1234.5);
  assert.equal(dashboardNumber("n/a"), 0);
  const input = sheets({
    modelo: [[], ["SKU", "MARCA", "RIESGO", "PENDIENTE_RECIBIR", "PROMEDIO_MENSUAL", "CANTIDAD_SUGERIDA"], ["X", "LOCAL", "REVISAR", "1.234,5", "2,5", "3,5"]],
    config: [],
  });
  const result = calculateComprasDashboard(input, "u", now);
  assert.equal(result.totalSku, 1);
  assert.equal(result.pendiente, 1234.5);
  assert.equal(result.compraSugerida, 0);
  assert.equal(result.revisar, 0);
  assert.equal(result.marcasNoCompra.length, 1);
});

test("rejects malformed required model and alias headers", () => {
  assert.throws(() => calculateComprasDashboard(sheets({ modelo: [[], ["SKU"], ["X"]] }), "u", now), /SKU, MARCA, RIESGO/);
  assert.throws(() => calculateComprasDashboard(sheets({ alias: [["OTRA", "MARCA CONFIGURADA"], ["X", "Y"]] }), "u", now), /ALIAS_MARCAS_COMPRA/);
});
