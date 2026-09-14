import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/compras-dashboard") {
      return nextResolve(new URL("../src/lib/compras-dashboard.ts", import.meta.url).href, context);
    }
    if (specifier === "@/lib/compras-dates") {
      return nextResolve(new URL("../src/lib/compras-dates.ts", import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { calculateComprasGestion, filterGestion, summarizeGestion } = await import("../src/lib/compras-gestion.ts");
const now = new Date("2026-09-14T15:00:00.000Z");

function sheets(overrides = {}) {
  return {
    gestion: [
      ["SKU", "DESCRIPCIÓN", "MARCA", "RIESGO", "COMPRA_SUGERIDA", "COBERTURA_ACTUAL", "ESTADO_GESTION", "CANTIDAD_DECIDIDA", "RESPONSABLE", "OBSERVACION", "FECHA_DECISION"],
      ["A", "Filtro A", "HID-XENON", "sin stock", 12.5, 0, "", 0, "", "", 46300.5],
      ["B", "Filtro B", "LOCAL", "COMPRAR", "1.234,5", 2.25, "APROBADO", 4, "Ana", "En curso", "13/09/2026"],
      ["C", "Otro", "", "URGENTE", 2, "", "POSTERGAR", 0, "", "", ""],
      ["", "Ignorado", "LOCAL", "URGENTE", 99, 0, "PENDIENTE"],
    ],
    config: [
      ["MARCA", "COMPRA", "ORIGEN", "COBERTURA_OBJETIVO"],
      ["HID XENON", "SI", "IMPORTADO", 6],
      ["LOCAL", "SI", "NACIONAL", "1,5"],
    ],
    alias: [["ALIAS", "MARCA CONFIGURADA", "ACTIVO"], ["HID-XENON", "HID XENON", "SI"]],
    ...overrides,
  };
}

test("ports Gestion row mapping, alias policy, numeric values, dates and option sets", () => {
  const result = calculateComprasGestion(sheets(), now);
  assert.equal(result.actualizado, "14/09/2026 12:00");
  assert.equal(result.total, 3);
  assert.deepEqual(result.riesgos, ["COMPRAR", "SIN STOCK", "URGENTE"]);
  assert.deepEqual(result.marcas, ["HID-XENON", "LOCAL", "SIN MARCA"]);
  assert.equal(result.registros[0].origen, "IMPORTADO");
  assert.equal(result.registros[0].compraHabilitada, true);
  assert.equal(result.registros[0].estadoGestion, "PENDIENTE");
  assert.equal(result.registros[0].compraSugerida, 12.5);
  assert.equal(result.registros[1].compraSugerida, 1234.5);
  assert.equal(result.registros[1].coberturaObjetivo, 1.5);
  assert.equal(result.registros[1].fechaDecision, "13/09/2026");
  assert.equal(result.registros[2].compraHabilitada, false);
  assert.equal(result.registros[2].origen, "SIN CONFIGURAR");
});

test("keeps legacy filter and summary semantics over the filtered rows", () => {
  const records = calculateComprasGestion(sheets(), now).registros;
  const blank = { texto: "", riesgo: "", estado: "", marca: "", politica: "" };
  assert.deepEqual(summarizeGestion(records), { total: 3, pendientes: 1, conDecision: 2, compraSugerida: 1249 });
  assert.deepEqual(filterGestion(records, { ...blank, texto: " filtro " }).map((r) => r.sku), ["A", "B"]);
  assert.deepEqual(filterGestion(records, { ...blank, marca: "LOCAL", estado: "APROBADO", politica: "COMPRAR" }).map((r) => r.sku), ["B"]);
  assert.deepEqual(filterGestion(records, { ...blank, politica: "NO COMPRAR" }).map((r) => r.sku), ["C"]);
  assert.deepEqual(summarizeGestion(filterGestion(records, { ...blank, riesgo: "SIN STOCK" })), { total: 1, pendientes: 1, conDecision: 0, compraSugerida: 12.5 });
});

test("handles empty Gestion and rejects missing required columns", () => {
  const empty = calculateComprasGestion(sheets({ gestion: [["SKU"]] }), now);
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.registros, []);
  assert.throws(() => calculateComprasGestion(sheets({ gestion: [["SKU"], ["A"]] }), now), /columnas requeridas/);
});
