import assert from "node:assert/strict";
import test from "node:test";
import { applyLegacyComprasMetricsToDashboardModel } from "../src/lib/compras-dashboard-model.ts";
import { calculateComprasDashboard } from "../src/lib/compras-dashboard.ts";

const headers = [
  "SKU", "MARCA", "PROMEDIO_MENSUAL", "STOCK_TOTAL", "PENDIENTE_TOTAL",
  "EMBARCADO", "EN_FABRICA", "COBERTURA_OBJETIVO", "COBERTURA_ACTUAL",
  "COBERTURA_FUTURA", "COMPRA_SUGERIDA", "RIESGO", "PRIORIDAD",
];

function input() {
  return {
    modelo: [[], headers,
      ["LED", "LUX", 10, 0, 999, 999, 999, 0, 0, 0, 0, "OK", 0],
      ["KLILED", "LUX", 10, 0, 999, 999, 999, 0, 0, 0, 0, "OK", 0],
      ["ZERO", "LUX", 0, 4, 999, 999, 999, 0, 9, 9, 9, "OK", 9],
    ],
    ordenes: [
      { item: "LED", cantidad: 5, status: "EMBARCADO" },
      { item: "LED", cantidad: 5, status: "EN FABRICA" },
      { item: "LED", cantidad: 7, status: "A EMBARCAR" },
    ],
    mapaSku: [["CODIGO_NUEVO", "CODIGO_VIEJO"], ["LED", "OLDLED"], ["KLILED", ""]],
    pendientesEquivalencia: [["ITEM", "SKU_CANONICO"]],
    parametros: [["TIPO", "CLAVE", "VALOR", "ACTIVO"],
      ["GENERAL", "COBERTURA_DEFAULT_MESES", 4, "SI"],
      ["GENERAL", "COBERTURA_URGENTE_MESES", 1, "SI"],
      ["GENERAL", "COBERTURA_COMPRAR_MESES", 2, "SI"],
      ["MARCA", "LUX", 5, "SI"],
    ],
    marcas: [["MARCA", "OBJETIVO_STOCK_MESES", "ACTIVA"], ["LUX", 3, "SI"]],
  };
}

test("recalcula B12B, B13 y B14 desde el snapshot original de órdenes", () => {
  const source = input();
  const result = applyLegacyComprasMetricsToDashboardModel(source);
  assert.deepEqual(result[2].slice(4), [10, 5, 5, 5, 0, 1, 40, "COMPRAR", 80]);
  assert.deepEqual(result[3].slice(4), [0, 0, 0, 5, 0, 0, 50, "SIN STOCK", 100]);
  assert.deepEqual(result[4].slice(4), [0, 0, 0, 5, "", "", 0, "SIN CONSUMO", 0]);
  assert.equal(source.modelo[2][4], 999);
  const dashboard = calculateComprasDashboard({
    modelo: result,
    config: [["MARCA", "COMPRA", "ORIGEN", "COBERTURA_OBJETIVO"], ["LUX", "SI", "IMPORTADO", 5]],
    alias: [], controlStock: [], ventas: [], logImportaciones: [],
  }, "test@example.com");
  assert.equal(dashboard.pendiente, 10);
  assert.equal(dashboard.compraSugerida, 90);
  assert.equal(dashboard.sinStock, 1);
  assert.equal(dashboard.comprar, 1);
});

test("usa equivalencia validada sólo cuando MAPA_SKU no resuelve ITEM", () => {
  const source = input();
  source.ordenes[0].item = "MANUAL";
  source.pendientesEquivalencia.push(["MANUAL", "KLILED"]);
  const result = applyLegacyComprasMetricsToDashboardModel(source);
  assert.equal(result[2][4], 5);
  assert.equal(result[3][4], 5);
});

test("una orden ausente del snapshot deja de contar como pendiente", () => {
  const source = input();
  source.ordenes = [];
  const result = applyLegacyComprasMetricsToDashboardModel(source);
  assert.equal(result[2][4], 0);
  assert.equal(result[2][5], 0);
  assert.equal(result[2][6], 0);
  assert.equal(source.modelo[2][4], 999);
});

test("INGRESADO y A INGRESAR dejan de contar aun si aparecían antes como EMBARCADO", () => {
  const source = input();
  source.ordenes[0].status = "INGRESADO";
  source.ordenes[1].status = "A INGRESAR";
  const result = applyLegacyComprasMetricsToDashboardModel(source);
  assert.equal(result[2][4], 0);
});
