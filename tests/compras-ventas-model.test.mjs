import assert from "node:assert/strict";
import test from "node:test";
import {
  applyVentasDemandToDashboardModel,
  canonicalizeVentasDemand,
  normalizeVentasSku,
} from "../src/lib/compras-ventas-model.ts";

test("reemplaza sólo consumo y promedio con la normalización SKU del legacy", () => {
  const modelo = [
    [],
    [
      "SKU",
      "STOCK_TOTAL",
      "RIESGO",
      "PENDIENTE_TOTAL",
      "CONSUMO_12_MESES",
      "PROMEDIO_MENSUAL",
      "COMPRA_SUGERIDA",
    ],
    [" ab-12 / ñ ", 7, "URGENTE", 3, 999, 999, 5],
    ["SIN-VENTAS", 9, "COMPRAR", 4, 888, 888, 6],
  ];
  const original = structuredClone(modelo);
  const demanda = new Map([
    [normalizeVentasSku("AB12N"), { consumo12Meses: 120, promedioMensual: 10 }],
  ]);

  const result = applyVentasDemandToDashboardModel(modelo, demanda);

  assert.deepEqual(result[2], [" ab-12 / ñ ", 7, "URGENTE", 3, 120, 10, 5]);
  assert.deepEqual(result[3], ["SIN-VENTAS", 9, "COMPRAR", 4, 0, 0, 6]);
  assert.deepEqual(modelo, original);
});

test("canoniza y suma COD_BAM con MAPA_SKU igual que el legacy", () => {
  const demanda = new Map([
    ["VIEJO1", { consumo12Meses: 12, promedioMensual: 1 }],
    ["BASEW", { consumo12Meses: 24, promedioMensual: 2 }],
    ["NUEVO", { consumo12Meses: 36, promedioMensual: 3 }],
    ["SINMAPA", { consumo12Meses: 48, promedioMensual: 4 }],
  ]);
  const mapa = [
    ["CODIGO_NUEVO", "CODIGO_VIEJO", "BASE_WARNES"],
    ["NUEVO", "VIEJO-1", "BASE W"],
  ];

  const result = canonicalizeVentasDemand(demanda, mapa);

  assert.deepEqual(result.get("NUEVO"), { consumo12Meses: 72, promedioMensual: 6 });
  assert.deepEqual(result.get("SINMAPA"), { consumo12Meses: 48, promedioMensual: 4 });
  assert.equal(result.size, 2);
  assert.throws(() => canonicalizeVentasDemand(demanda, []), /MAPA_SKU/);
});

test("acepta el alias CONSUMO_12M y exige ambas columnas de demanda", () => {
  const demanda = new Map([
    ["A", { consumo12Meses: 24, promedioMensual: 2 }],
  ]);
  const result = applyVentasDemandToDashboardModel(
    [[], ["SKU", "CONSUMO_12M", "PROMEDIO_MENSUAL"], ["A", 0, 0]],
    demanda,
  );
  assert.deepEqual(result[2], ["A", 24, 2]);

  assert.throws(
    () => applyVentasDemandToDashboardModel([[], ["SKU"], ["A"]], demanda),
    /CONSUMO_12_MESES y PROMEDIO_MENSUAL/,
  );
});
