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

const { calculateComprasHistorial, mergeGestionDecisionEvents } = await import("../src/lib/compras-historial.ts");

function serial(year, month, day, hour, minute) {
  return (Date.UTC(year, month - 1, day, hour, minute) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

function sheets(overrides = {}) {
  return {
    gestionActiva: [
      ["SKU", "DESCRIPCION", "MARCA", "STOCK_WARNES", "STOCK_ESCOBAR", "STOCK_TOTAL", "PROMEDIO_MENSUAL", "PENDIENTE_TOTAL", "COBERTURA_ACTUAL"],
      ["ABC", "Lámpara", "KOBO-LIGHT", 2, 3, 0, 2, 4, 0],
    ],
    config: [["MARCA", "COMPRA", "ORIGEN", "COBERTURA_OBJETIVO"], ["KOBO LIGHT", "SI", "IMPORTADO", 6]],
    alias: [["ALIAS", "MARCA CONFIGURADA", "ACTIVO"], ["KOBO-LIGHT", "KOBO LIGHT", "SI"]],
    gestionHistorial: [
      ["SKU", "FECHA_DECISION", "ESTADO_GESTION", "CANTIDAD_DECIDIDA", "RESPONSABLE", "OBSERVACION"],
      ["abc", serial(2026, 8, 12, 7, 15), "APROBADO", 100, "EDU", "TEST"],
    ],
    enviosCompra: [
      ["SKU", "FECHA_ENVIO", "CANTIDAD_DECIDIDA", "USUARIO_ENVIO", "OBSERVACION", "NRO_ENVIO", "DESCRIPCION", "MARCA"],
      ["ABC", serial(2026, 8, 13, 9, 0), 100, "EDU", "Enviado", "EC-1", "Otra desc", "Otra marca"],
      ["ABC", serial(2026, 8, 14, 10, 0), 40, "EDU", "", "EC-2", "", ""],
    ],
    procesoCompra: [
      ["SKU", "DESCRIPCION", "MARCA", "ESTADO_COMPRA", "CANTIDAD_SOLICITADA", "CANTIDAD_COMPRADA", "PROVEEDOR", "RESPONSABLE_COMPRA"],
      ["ABC", "", "", "COTIZANDO", 100, 0, "", "EDU"],
      ["ABC", "", "", "COMPRADO PARCIAL", 100, 30, "ACME", "ANA"],
    ],
    movimientosCompra: [
      ["SKU", "FECHA_MOVIMIENTO", "CANTIDAD_MOVIMIENTO", "CANTIDAD_ACUMULADA", "SALDO_RESULTANTE", "ESTADO_RESULTANTE", "USUARIO", "OBSERVACION", "NRO_MOVIMIENTO", "NRO_ENVIO", "PROVEEDOR"],
      ["ABC", serial(2026, 8, 15, 16, 30), 30, 30, 70, "PARCIAL", "ANA", "Primer lote", "MOV-1", "EC-1", "ACME"],
    ],
    ...overrides,
  };
}

test("ports situation, policy and chronologically sorted legacy events", () => {
  const result = calculateComprasHistorial(sheets(), " abc ", "America/Los_Angeles");
  assert.equal(result.sku, "abc");
  assert.equal(result.descripcion, "Lámpara");
  assert.equal(result.marca, "KOBO-LIGHT");
  assert.equal(result.origen, "IMPORTADO");
  assert.equal(result.compraHabilitada, true);
  assert.equal(result.coberturaObjetivo, 6);
  assert.equal(result.stockTotal, 5);
  assert.equal(result.coberturaActual, 2.5);
  assert.equal(result.estadoActual, "COMPRADO PARCIAL");
  assert.equal(result.cantidadSolicitada, 100);
  assert.equal(result.cantidadComprada, 30);
  assert.equal(result.saldoPendiente, 70);
  assert.deepEqual(result.eventos.map((e) => e.tipo), ["GESTION", "ENVIO", "ENVIO", "COMPRA"]);
  assert.equal(result.eventos[0].fecha, "12/08/2026 11:15");
  assert.equal(result.eventos[0].detalle, "Cantidad decidida: 100");
  assert.equal(result.eventos[3].referencia, "MOV-1 · EC-1");
  assert.equal(result.eventos[3].proveedor, "ACME");
});

test("appends Supabase decisions without duplicating the migrated Sheet baseline", () => {
  const baseline = calculateComprasHistorial(sheets(), "ABC", "America/Los_Angeles");
  const updated = mergeGestionDecisionEvents(baseline, [
    { tipo: "MIGRACION", estado_gestion: "APROBADO", cantidad_decidida: 100, observacion: "TEST", actor: "GESTION_COMPRAS", fecha_evento: "2026-09-17T12:00:00Z", version: 1 },
    { tipo: "DECISION", estado_gestion: "POSTERGAR", cantidad_decidida: 80, observacion: "Nueva decisión", actor: "editor@grupo-aftermarket.com", fecha_evento: "2026-09-17T15:00:00Z", version: 2 },
  ]);
  assert.equal(updated.eventos.filter((event) => event.tipo === "GESTION").length, 2);
  assert.equal(updated.eventos.at(-1).estado, "POSTERGAR");
  assert.match(updated.eventos.at(-1).referencia, /versión 2/);
  const conflict = mergeGestionDecisionEvents(baseline, [], true);
  assert.match(conflict.eventos[0].titulo, /sin conciliar/);
});

test("keeps historical policy timing and only reports the latest decision", () => {
  const data = sheets({
    gestionActiva: [["SKU", "MARCA"]],
    gestionHistorial: [
      ["SKU", "FECHA_DECISION", "ESTADO_GESTION", "CANTIDAD_DECIDIDA"],
      ["ABC", "", "POSTERGAR", 0],
      ["ABC", "", "APROBADO", 100],
    ],
  });
  const result = calculateComprasHistorial(data, "ABC");
  assert.equal(result.marca, "Otra marca");
  assert.equal(result.origen, "SIN CONFIGURAR");
  assert.equal(result.compraHabilitada, false);
  assert.equal(result.eventos.filter((e) => e.tipo === "GESTION").length, 1);
  assert.equal(result.eventos[0].estado, "POSTERGAR");
});

test("reports a missing SKU and accepts history from one optional source", () => {
  const data = sheets({
    gestionActiva: [], gestionHistorial: [], enviosCompra: [], procesoCompra: [],
    movimientosCompra: [["SKU", "FECHA_MOVIMIENTO", "CANTIDAD_MOVIMIENTO"], ["ONLY", "13/08/2026 12:30", 3]],
  });
  assert.throws(() => calculateComprasHistorial(data, " "), /Ingresá un SKU/);
  assert.throws(() => calculateComprasHistorial(data, "UNKNOWN"), /No se encontró historial/);
  const only = calculateComprasHistorial(data, "only");
  assert.equal(only.eventos.length, 1);
  assert.equal(only.eventos[0].fecha, "13/08/2026 12:30");
});

test("converts spreadsheet serials using its daylight-saving offset", () => {
  const data = sheets({
    gestionHistorial: [["SKU", "FECHA_DECISION", "ESTADO_GESTION"], ["ABC", serial(2026, 1, 12, 7, 15), "APROBADO"]],
    enviosCompra: [], movimientosCompra: [],
  });
  const result = calculateComprasHistorial(data, "ABC", "America/Los_Angeles");
  assert.equal(result.eventos[0].fecha, "12/01/2026 12:15");
});
