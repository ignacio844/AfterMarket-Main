import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/compras-dashboard") return nextResolve(new URL("../src/lib/compras-dashboard.ts", import.meta.url).href, context);
    if (specifier === "@/lib/compras-dates") return nextResolve(new URL("../src/lib/compras-dates.ts", import.meta.url).href, context);
    return nextResolve(specifier, context);
  },
});

const { calculateComprasCotizaciones, rankingPrecio } = await import("../src/lib/compras-cotizaciones.ts");

test("keeps imported COTIZAR eligibility, open-CT exclusion, offer grouping and currency ranking", () => {
  const result = calculateComprasCotizaciones({
    gestion: [
      ["SKU", "DESCRIPCION", "MARCA", "ORIGEN", "RIESGO", "COMPRA_SUGERIDA", "ESTADO_GESTION", "CANTIDAD_DECIDIDA", "RESPONSABLE", "OBSERVACION"],
      ["A", "Item A", "MARCA A", "IMPORTADO", "SIN STOCK", 120, "COTIZAR", 100, "EDU", ""],
      ["B", "Item B", "MARCA B", "IMPORTADO", "SIN STOCK", 30, "COTIZAR", 20, "EDU", ""],
      ["C", "Item C", "MARCA C", "NACIONAL", "SIN STOCK", 30, "COTIZAR", 30, "EDU", ""],
      ["D", "Item D", "MARCA D", "IMPORTADO", "SIN STOCK", 30, "COTIZAR", 0, "EDU", ""],
    ],
    cotizaciones: [
      ["NRO_COTIZACION", "FECHA_COTIZACION", "ESTADO_COTIZACION", "SKU", "DESCRIPCION", "MARCA", "CANTIDAD", "PROVEEDOR_SELECCIONADO"],
      ["CT-2", "", "ABIERTA", "B", "Item B", "MARCA B", 20, ""],
      ["CT-1", "", "APROBADA", "X", "Item X", "MARCA X", 140, "P2"],
    ],
    ofertas: [
      ["NRO_COTIZACION", "PROVEEDOR", "SKU", "PRECIO", "MONEDA", "CODIGO_PROVEEDOR"],
      ["CT-1", "P1", "X", 3, "USD", "XP1"],
      ["CT-1", "P2", "X", 2.9, "USD", "XP2"],
      ["CT-1", "P3", "X", 2.85, "USD", "XP3"],
      ["CT-1", "P4", "X", 2.85, "EUR", "XP4"],
    ],
    config: [], alias: [],
  });
  assert.deepEqual(result.pendientes.map((row) => row.sku), ["A"]);
  assert.deepEqual(result.resumen, { sku: 1, unidades: 100, marcas: 1 });
  assert.deepEqual(result.cotizaciones.map((lote) => lote.nroCotizacion), ["CT-2", "CT-1"]);
  const lote = result.cotizaciones[1];
  assert.equal(lote.ofertas[0].total, 420);
  assert.equal(lote.ofertas[1].items[0].codigoProveedor, "XP2");
  assert.equal(rankingPrecio(lote, lote.ofertas[0], "X"), "OFERTA");
  assert.equal(rankingPrecio(lote, lote.ofertas[1], "X"), "2° PRECIO");
  assert.equal(rankingPrecio(lote, lote.ofertas[2], "X"), "MEJOR PRECIO");
  assert.equal(rankingPrecio(lote, lote.ofertas[3], "X"), "MEJOR PRECIO");
});
