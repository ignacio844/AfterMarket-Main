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

const { calculateComprasBandeja } = await import("../src/lib/compras-bandeja.ts");

test("Bandeja keeps approved SKU with positive quantity and joins the selected approved offer", () => {
  const result = calculateComprasBandeja({
    gestion: [
      ["SKU", "DESCRIPCION", "MARCA", "RIESGO", "COMPRA_SUGERIDA", "ESTADO_GESTION", "CANTIDAD_DECIDIDA", "RESPONSABLE", "OBSERVACION", "FECHA_DECISION"],
      ["B", "Item B", "Marca B", "SIN STOCK", 985, "APROBADO", 150, "EDU", "", ""],
      ["A", "Item A", "Marca A", "URGENTE", 5000, "APROBADO", 70, "EDU", "Cotización CT-1", ""],
      ["C", "Item C", "Marca C", "", 30, "COTIZAR", 30, "EDU", "", ""],
      ["D", "Item D", "Marca D", "", 40, "APROBADO", 0, "EDU", "", ""],
    ],
    cotizaciones: [
      ["NRO_COTIZACION", "SKU", "ESTADO_COTIZACION", "PROVEEDOR_SELECCIONADO"],
      ["CT-1", "A", "APROBADA", "Prov3"],
      ["CT-2", "B", "ABIERTA", "Prov2"],
    ],
    ofertas: [
      ["NRO_COTIZACION", "SKU", "PROVEEDOR", "CODIGO_PROVEEDOR"],
      ["CT-1", "A", "Prov1", "A-1"],
      ["CT-1", "A", "PROV3", "A-3"],
      ["CT-2", "B", "Prov2", "B-2"],
    ],
  });
  assert.deepEqual(result.registros.map((row) => row.sku), ["A", "B"]);
  assert.deepEqual(result.resumen, { sku: 2, unidades: 220, marcas: 2 });
  assert.deepEqual([result.registros[0].nroCotizacion, result.registros[0].proveedor, result.registros[0].codigoProveedor], ["CT-1", "PROV3", "A-3"]);
  assert.equal(result.registros[1].nroCotizacion, "");
});
