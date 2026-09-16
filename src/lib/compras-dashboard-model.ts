import type { SheetRows, SheetValue } from "./compras-dashboard.ts";
import { columns, dashboardNumber, value } from "./compras-dashboard.ts";

const MAP_COLUMNS = [
  "CODIGO_NUEVO", "CODIGO_VIEJO", "BASE_OCTOSIS", "BASE_SISFACTURA",
  "BASE_MELIKOBO", "BASE_TORETTOS", "BASE_WARNES",
];

function code(input: SheetValue | undefined) {
  return String(input ?? "").trim().toUpperCase();
}

function normalizedText(input: SheetValue | undefined) {
  return code(input).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function importQuantity(input: SheetValue | undefined) {
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  const numericText = String(input ?? "").trim().replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  return dashboardNumber(numericText);
}

function required(rows: SheetRows, headerRow: number, name: string) {
  const index = columns(rows[headerRow] ?? [])(name);
  if (index < 0) throw new Error(`Falta ${name} para recalcular el Dashboard de Compras.`);
  return index;
}

function legacySkuMap(mapaSku: SheetRows, pendientesEquivalencia: SheetRows) {
  const newSku = required(mapaSku, 0, "CODIGO_NUEVO");
  const indexes = MAP_COLUMNS.map((name) => columns(mapaSku[0] ?? [])(name)).filter((index) => index >= 0);
  const result = new Map<string, string>();
  for (const row of mapaSku.slice(1)) {
    const target = code(value(row, newSku));
    if (!target) continue;
    // B12A: each canonical SKU overwrites an earlier alias of the same text.
    result.set(target, target);
    for (const index of indexes) {
      const source = code(value(row, index));
      if (source && !result.has(source)) result.set(source, target);
    }
  }
  if (pendientesEquivalencia.length > 1) {
    const item = required(pendientesEquivalencia, 0, "ITEM");
    const sku = required(pendientesEquivalencia, 0, "SKU_CANONICO");
    for (const row of pendientesEquivalencia.slice(1)) {
      const source = code(value(row, item));
      const target = code(value(row, sku));
      if (source && target && !result.has(source)) result.set(source, target);
    }
  }
  return result;
}

function legacyPending(detalle: SheetRows, equivalencias: Map<string, string>) {
  const item = required(detalle, 0, "ITEM");
  const quantity = required(detalle, 0, "CANTIDAD");
  const status = required(detalle, 0, "STATUS_LINEA");
  const result = new Map<string, { embarcado: number; fabrica: number }>();
  for (const row of detalle.slice(1)) {
    const source = code(value(row, item));
    if (!source) continue;
    const sku = equivalencias.get(source);
    if (!sku) continue;
    const state = normalizedText(value(row, status));
    if (state !== "EMBARCADO" && state !== "EN FABRICA") continue;
    const entry = result.get(sku) ?? { embarcado: 0, fabrica: 0 };
    const amount = importQuantity(value(row, quantity));
    if (state === "EMBARCADO") entry.embarcado += amount;
    else entry.fabrica += amount;
    result.set(sku, entry);
  }
  return result;
}

function parameters(rows: SheetRows) {
  const type = required(rows, 0, "TIPO");
  const key = required(rows, 0, "CLAVE");
  const amount = required(rows, 0, "VALOR");
  const active = columns(rows[0] ?? [])("ACTIVO");
  const generalB13 = new Map<string, number>();
  const generalB14 = new Map<string, number>();
  const brand = new Map<string, number>();
  for (const row of rows.slice(1)) {
    const kind = normalizedText(value(row, type));
    const name = normalizedText(value(row, key));
    const enabled = active < 0 ? "" : normalizedText(value(row, active));
    const number = dashboardNumber(value(row, amount));
    if (kind === "GENERAL" && name) {
      if (enabled === "SI") generalB13.set(name, number);
      if (!enabled || enabled === "SI") generalB14.set(name, number);
    }
    if (kind === "MARCA" && enabled === "SI" && name && name !== "DEFAULT" && number > 0) brand.set(name, number);
  }
  return { generalB13, generalB14, brand };
}

function brandCoverage(rows: SheetRows) {
  const brand = required(rows, 0, "MARCA");
  const months = required(rows, 0, "OBJETIVO_STOCK_MESES");
  const active = required(rows, 0, "ACTIVA");
  const result = new Map<string, number>();
  for (const row of rows.slice(1)) {
    if (normalizedText(value(row, active)) !== "SI") continue;
    const name = normalizedText(value(row, brand));
    const amount = dashboardNumber(value(row, months));
    if (name && amount > 0) result.set(name, amount);
  }
  return result;
}

/** B12B -> B13 (Dashboard-relevant columns) -> B14, on a private in-memory copy. */
export function applyLegacyComprasMetricsToDashboardModel(input: {
  modelo: SheetRows;
  detalle: SheetRows;
  mapaSku: SheetRows;
  pendientesEquivalencia: SheetRows;
  parametros: SheetRows;
  marcas: SheetRows;
}): SheetRows {
  const { modelo, detalle, mapaSku, pendientesEquivalencia, parametros, marcas } = input;
  if (modelo.length < 2) throw new Error("MODELO_COMPRAS no contiene encabezados.");
  const result = modelo.map((row) => [...row]);
  const sku = required(result, 1, "SKU");
  const brand = required(result, 1, "MARCA");
  const average = required(result, 1, "PROMEDIO_MENSUAL");
  const stock = required(result, 1, "STOCK_TOTAL");
  const pending = required(result, 1, "PENDIENTE_TOTAL");
  const shipped = required(result, 1, "EMBARCADO");
  const factory = required(result, 1, "EN_FABRICA");
  const objective = required(result, 1, "COBERTURA_OBJETIVO");
  const currentCoverage = required(result, 1, "COBERTURA_ACTUAL");
  const futureCoverage = required(result, 1, "COBERTURA_FUTURA");
  const purchase = required(result, 1, "COMPRA_SUGERIDA");
  const risk = required(result, 1, "RIESGO");
  const priority = required(result, 1, "PRIORIDAD");

  const importations = legacyPending(detalle, legacySkuMap(mapaSku, pendientesEquivalencia));
  const config = parameters(parametros);
  const coverageByBrand = brandCoverage(marcas);
  const defaultCoverage = config.generalB13.get("COBERTURA_DEFAULT_MESES") || 4;
  const urgentThreshold = config.generalB14.get("COBERTURA_URGENTE_MESES") ?? 1;
  const buyThreshold = config.generalB14.get("COBERTURA_COMPRAR_MESES") ?? 2;
  const priorities = {
    "SIN STOCK": config.generalB14.get("PRIORIDAD_SIN_STOCK") ?? 100,
    URGENTE: config.generalB14.get("PRIORIDAD_URGENTE") ?? 90,
    COMPRAR: config.generalB14.get("PRIORIDAD_COMPRAR") ?? 80,
    REVISAR: config.generalB14.get("PRIORIDAD_REVISAR") ?? 40,
    OK: config.generalB14.get("PRIORIDAD_OK") ?? 0,
  };

  for (const row of result.slice(2)) {
    const key = code(value(row, sku));
    if (!key) continue;
    const detail = importations.get(key);
    const embarcado = detail?.embarcado ?? 0;
    const enFabrica = detail?.fabrica ?? 0;
    row[shipped] = embarcado;
    row[factory] = enFabrica;
    row[pending] = embarcado + enFabrica;

    const brandKey = normalizedText(value(row, brand));
    const target = config.brand.get(brandKey) ?? coverageByBrand.get(brandKey) ?? defaultCoverage;
    row[objective] = target;

    const demand = dashboardNumber(value(row, average));
    if (demand <= 0) {
      row[currentCoverage] = "";
      row[futureCoverage] = "";
      row[purchase] = 0;
      row[risk] = "SIN CONSUMO";
      row[priority] = priorities.OK;
      continue;
    }

    const physical = Math.max(0, dashboardNumber(value(row, stock)));
    const onOrder = Math.max(0, dashboardNumber(value(row, pending)));
    const current = physical / demand;
    const future = (physical + onOrder) / demand;
    row[currentCoverage] = current;
    row[futureCoverage] = future;
    row[purchase] = Math.ceil(Math.max(0, demand * target - physical - onOrder));

    const category = physical <= 0 && future < urgentThreshold ? "SIN STOCK"
      : future < urgentThreshold ? "URGENTE"
      : future < buyThreshold ? "COMPRAR"
      : future < target ? "REVISAR" : "OK";
    row[risk] = category;
    row[priority] = priorities[category];
  }
  return result;
}
