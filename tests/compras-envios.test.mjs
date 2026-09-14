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

const { calculateComprasEnvios, filterEnvios, summarizeEnvios } = await import("../src/lib/compras-envios.ts");
const serial = (year, month, day, hour, minute) =>
  (Date.UTC(year, month - 1, day, hour, minute) - Date.UTC(1899, 11, 30)) / 86_400_000;

test("groups shipment rows, assigns existing OCs and keeps read-only filter totals", () => {
  const result = calculateComprasEnvios({
    enviosCompra: [
      ["NRO_ENVIO", "FECHA_ENVIO", "USUARIO_ENVIO", "SKU", "DESCRIPCION", "MARCA", "RIESGO", "COMPRA_SUGERIDA", "CANTIDAD_DECIDIDA", "RESPONSABLE_DECISION", "OBSERVACION", "FECHA_DECISION"],
      ["EC-2", serial(2026, 8, 13, 7, 15), "EDU", "A", "LED A", "KOBO", "SIN STOCK", 100, 10, "EDU", "Prueba", serial(2026, 8, 12, 7, 15)],
      ["EC-2", serial(2026, 8, 13, 7, 15), "EDU", "B", "LED B", "KOBO", "URGENTE", 200, 20, "EDU", "", serial(2026, 8, 12, 7, 15)],
      ["EC-1", serial(2026, 8, 11, 7, 15), "ANA", "C", "Filtro", "OTRA", "", 0, 3, "ANA", "", ""],
    ],
    ordenesCompra: [
      ["NRO_ENVIO", "NRO_OC", "PROVEEDOR", "SKU"],
      ["EC-2", "OC-1", "Proveedor", "A"],
      ["EC-2", "OC-1", "Proveedor", "B"],
    ],
    procesoCompra: [["PROVEEDOR"], ["Otro"], ["PROVEEDOR"]],
  }, "America/Los_Angeles");
  assert.deepEqual(result.resumen, { envios: 2, sku: 3, unidades: 33 });
  assert.equal(result.envios[0].nroEnvio, "EC-2");
  assert.equal(result.envios[0].fechaEnvio, "13/08/2026 11:15");
  assert.equal(result.envios[0].marcas, 1);
  assert.equal(result.envios[0].ocs.length, 1);
  assert.equal(result.envios[0].detalle[0].oc, "OC-1");
  assert.equal(result.envios[0].detalle[0].fechaDecision, "12/08/2026 11:15");
  assert.deepEqual(result.proveedores, ["Otro", "Proveedor"]);
  const visible = filterEnvios(result.envios, { texto: "LED B", desde: "2026-08-12", hasta: "", marca: "KOBO" });
  assert.deepEqual(summarizeEnvios(visible), { envios: 1, sku: 2, unidades: 30 });
});
