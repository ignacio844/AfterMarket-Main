import type { SheetRows, SheetValue } from "./compras-dashboard.ts";
import { columns, dashboardNumber, value } from "./compras-dashboard.ts";
import { normalizeVentasSku } from "./compras-ventas-model.ts";

type PendingState = "EN FABRICA" | "A EMBARCAR" | "EMBARCADO" | "A INGRESAR";
type Totals = Record<PendingState, number>;

const STATES: PendingState[] = ["EN FABRICA", "A EMBARCAR", "EMBARCADO", "A INGRESAR"];

function emptyTotals(): Totals {
  return { "EN FABRICA": 0, "A EMBARCAR": 0, EMBARCADO: 0, "A INGRESAR": 0 };
}

function text(input: SheetValue | undefined) {
  return String(input ?? "").trim();
}

function legacyKey(input: SheetValue | undefined) {
  return text(input).toUpperCase();
}

function providerKey(input: SheetValue | undefined) {
  return text(input).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/\s+/g, " ");
}

function orderKey(input: SheetValue | undefined) {
  return normalizeVentasSku(input);
}

function state(input: SheetValue | undefined): PendingState | null {
  const normalized = text(input).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/_/g, " ").replace(/\s+/g, " ");
  if (["EN FABRICA", "EN FABRICACION", "FABRICACION"].includes(normalized)) return "EN FABRICA";
  if (["A EMBARCAR", "PENDIENTE DE EMBARQUE", "PENDIENTE EMBARQUE"].includes(normalized)) return "A EMBARCAR";
  if (["EMBARCADO", "EMBARCADA", "EN TRANSITO"].includes(normalized)) return "EMBARCADO";
  if (["A INGRESAR", "PENDIENTE DE INGRESO", "PENDIENTE INGRESO"].includes(normalized)) return "A INGRESAR";
  return null;
}

function legacyState(input: SheetValue | undefined) {
  return text(input).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/\s+/g, " ");
}

function requireColumn(rows: SheetRows, headerRow: number, name: string) {
  const index = columns(rows[headerRow] ?? [])(name);
  if (index < 0) throw new Error(`Falta la columna ${name} en la conciliación de pendiente.`);
  return index;
}

function addMapping(map: Map<string, string>, conflicts: Set<string>, source: string, target: string) {
  if (!source || !target || conflicts.has(source)) return;
  const existing = map.get(source);
  if (existing && existing !== target) {
    map.delete(source);
    conflicts.add(source);
  } else {
    map.set(source, target);
  }
}

export type PendingReconciliation = {
  rule: string;
  rows: { model: number; detail: number; eligible: number; mapped: number; unresolved: number };
  model: { pendingTotal: number; duplicateNormalizedKeys: number };
  legacyB12B: { mappedTotal: number; unresolvedTotal: number; differenceFromModel: number };
  pendingQuantityPreview: {
    byState: Totals;
    mappedTotal: number;
    unresolvedTotal: number;
    twoStateTotal: number;
    fourStateTotal: number;
    differenceFromModel: number;
  };
  mapping: {
    conflictingKeys: number;
    conflictsBySource: { skuMap: number; validatedItem: number; supplierItem: number; uniqueItem: number };
    ambiguousModelRows: number;
    byMethod: Record<"directSku" | "directSkuMapped" | "supplierItem" | "uniqueItem" | "validatedItem" | "itemAsSku" | "skuMap", number>;
  };
  unresolved: {
    byReason: Record<"noMapping" | "outsideModel" | "modelCollision" | "mappingConflict", { rows: number; units: number }>;
    byState: Totals;
    largestLines: Array<{ item: string; order: string; status: PendingState; units: number; reason: string }>;
  };
  legacyParity: { matchingSku: number; differingSku: number; modelOnlySku: number; calculatedOnlySku: number; nonzeroModelOnlySku: number; nonzeroDifferingSku: number };
  allocationDisagreements: {
    rows: number;
    twoStateUnits: number;
    fourStateUnits: number;
    largestLines: Array<{ item: string; resolvedSku: string; legacySku: string; order: string; status: PendingState; units: number }>;
  };
  largestDifferences: Array<{ sku: string; model: number; twoStates: number; fourStates: number }>;
};

/** Read-only comparison. No value produced here is applied to the Dashboard. */
export function reconcileComprasPending(input: {
  modelo: SheetRows;
  detalle: SheetRows;
  mapaSku: SheetRows;
  pendientesEquivalencia: SheetRows;
  equivalenciasSku: SheetRows;
  ordenes: SheetRows;
}): PendingReconciliation {
  const { modelo, detalle, mapaSku, pendientesEquivalencia, equivalenciasSku, ordenes } = input;
  const modelSku = requireColumn(modelo, 1, "SKU");
  const modelPending = requireColumn(modelo, 1, "PENDIENTE_TOTAL");
  const detailItem = requireColumn(detalle, 0, "ITEM");
  const detailStatus = requireColumn(detalle, 0, "STATUS_LINEA");
  const detailQuantity = requireColumn(detalle, 0, "CANTIDAD");
  const detailRemaining = requireColumn(detalle, 0, "CANTIDAD_PENDIENTE");
  const detailSku = columns(detalle[0] ?? [])("SKU");
  const detailOrder = requireColumn(detalle, 0, "ID_ORDEN");
  const newSku = requireColumn(mapaSku, 0, "CODIGO_NUEVO");
  if (!pendientesEquivalencia.length) throw new Error("Falta PENDIENTES_EQUIVALENCIA_IMPORT para conciliar los ITEM.");
  const equivSku = requireColumn(equivalenciasSku, 0, "SKU");
  const equivSupplier = requireColumn(equivalenciasSku, 0, "PROVEEDOR");
  const equivItem = requireColumn(equivalenciasSku, 0, "ITEM_PROVEEDOR");
  const orderId = requireColumn(ordenes, 0, "ID_ORDEN");
  const orderSupplier = requireColumn(ordenes, 0, "PROVEEDOR");
  const mapColumns = ["CODIGO_NUEVO", "CODIGO_VIEJO", "BASE_OCTOSIS", "BASE_SISFACTURA", "BASE_MELIKOBO", "BASE_TORETTOS", "BASE_WARNES"]
    .map((name) => columns(mapaSku[0] ?? [])(name)).filter((index) => index >= 0);

  const map = new Map<string, string>();
  const conflicts = new Set<string>();
  const legacyMap = new Map<string, string>();
  for (const row of mapaSku.slice(1)) {
    const target = normalizeVentasSku(value(row, newSku));
    const legacyTarget = legacyKey(value(row, newSku));
    if (legacyTarget) legacyMap.set(legacyTarget, legacyTarget);
    for (const index of mapColumns) {
      addMapping(map, conflicts, normalizeVentasSku(value(row, index)), target);
      const source = legacyKey(value(row, index));
      if (source && legacyTarget && !legacyMap.has(source)) legacyMap.set(source, legacyTarget);
    }
  }

  // The validated ITEM -> SKU register is a fallback, as in B12B. It does not
  // override MAPA_SKU and is not treated as a substitute for supplier mapping.
  const validatedMap = new Map<string, string>();
  const validatedConflicts = new Set<string>();
  const itemColumn = requireColumn(pendientesEquivalencia, 0, "ITEM");
  const skuColumn = requireColumn(pendientesEquivalencia, 0, "SKU_CANONICO");
  for (const row of pendientesEquivalencia.slice(1)) {
    const item = normalizeVentasSku(value(row, itemColumn));
    const validatedSku = normalizeVentasSku(value(row, skuColumn));
    addMapping(validatedMap, validatedConflicts, item, map.get(validatedSku) ?? validatedSku);
    const legacyItem = legacyKey(value(row, itemColumn));
    const legacyTarget = legacyKey(value(row, skuColumn));
    if (legacyItem && legacyTarget && !legacyMap.has(legacyItem)) legacyMap.set(legacyItem, legacyTarget);
  }

  const supplierByOrder = new Map<string, string>();
  for (const row of ordenes.slice(1)) {
    const id = orderKey(value(row, orderId));
    const supplier = providerKey(value(row, orderSupplier));
    if (id && supplier) supplierByOrder.set(id, supplier);
  }
  const bySupplierItem = new Map<string, string>();
  const supplierConflicts = new Set<string>();
  const byItem = new Map<string, string>();
  const itemConflicts = new Set<string>();
  for (const row of equivalenciasSku.slice(1)) {
    const item = normalizeVentasSku(value(row, equivItem));
    const supplier = providerKey(value(row, equivSupplier));
    const sourceSku = normalizeVentasSku(value(row, equivSku));
    const sku = map.get(sourceSku) ?? sourceSku;
    if (!item || !sku) continue;
    addMapping(bySupplierItem, supplierConflicts, `${supplier}|${item}`, sku);
    addMapping(byItem, itemConflicts, item, sku);
  }

  const modelByKey = new Map<string, { sku: string; pending: number; count: number }>();
  const modelLegacyKeys = new Set<string>();
  const modelByLegacyKey = new Map<string, number>();
  let modelPendingTotal = 0;
  for (const row of modelo.slice(2)) {
    const sku = text(value(row, modelSku));
    const key = normalizeVentasSku(sku);
    if (!key) continue;
    modelLegacyKeys.add(legacyKey(sku));
    const pending = dashboardNumber(value(row, modelPending));
    modelPendingTotal += pending;
    modelByLegacyKey.set(legacyKey(sku), pending);
    const previous = modelByKey.get(key);
    modelByKey.set(key, { sku: previous?.sku ?? sku, pending: (previous?.pending ?? 0) + pending, count: (previous?.count ?? 0) + 1 });
  }

  const legacyByKey = new Map<string, number>();
  const currentByKey = new Map<string, Totals>();
  const byState = emptyTotals();
  let eligible = 0;
  let mapped = 0;
  let unresolved = 0;
  let ambiguousModelRows = 0;
  let legacyUnresolvedTotal = 0;
  let currentUnresolvedTotal = 0;
  const byMethod = { directSku: 0, directSkuMapped: 0, supplierItem: 0, uniqueItem: 0, validatedItem: 0, itemAsSku: 0, skuMap: 0 };
  const unresolvedByReason = {
    noMapping: { rows: 0, units: 0 },
    outsideModel: { rows: 0, units: 0 },
    modelCollision: { rows: 0, units: 0 },
    mappingConflict: { rows: 0, units: 0 },
  };
  const unresolvedByState = emptyTotals();
  const largestUnresolved: PendingReconciliation["unresolved"]["largestLines"] = [];
  const allocationDisagreements: PendingReconciliation["allocationDisagreements"] = {
    rows: 0, twoStateUnits: 0, fourStateUnits: 0, largestLines: [],
  };

  for (const row of detalle.slice(1)) {
    const status = state(value(row, detailStatus));
    if (!status) continue;
    const original = dashboardNumber(value(row, detailQuantity));
    const remaining = Math.max(0, dashboardNumber(value(row, detailRemaining)));
    if (original === 0 && remaining === 0) continue;
    eligible += 1;
    const item = normalizeVentasSku(value(row, detailItem));
    const direct = normalizeVentasSku(value(row, detailSku));
    const legacyTarget = legacyMap.get(legacyKey(value(row, detailItem)));
    if (["EN FABRICA", "EMBARCADO"].includes(legacyState(value(row, detailStatus)))) {
      if (legacyTarget && modelLegacyKeys.has(legacyTarget)) {
        legacyByKey.set(legacyTarget, (legacyByKey.get(legacyTarget) ?? 0) + original);
      } else {
        legacyUnresolvedTotal += original;
      }
    }

    // El SKU directo prevalece. Sin él se usa proveedor de la orden concreta,
    // equivalencia única, validación manual y por último MAPA_SKU.
    const supplier = supplierByOrder.get(orderKey(value(row, detailOrder))) ?? "";
    const supplierItem = `${supplier}|${item}`;
    const candidates = [
      ["directSku", direct && modelByKey.has(direct) ? direct : undefined] as const,
      ["directSkuMapped", direct ? map.get(direct) : undefined] as const,
      ["supplierItem", bySupplierItem.get(supplierItem)] as const,
      ["uniqueItem", byItem.get(item)] as const,
      ["validatedItem", validatedMap.get(item)] as const,
      ["itemAsSku", modelByKey.has(item) ? item : undefined] as const,
      ["skuMap", map.get(item)] as const,
    ];
    const choice = candidates.find(([, sku]) => sku && modelByKey.get(sku)?.count === 1) ??
      candidates.find(([, sku]) => sku);
    const target = choice?.[1];
    const modelMatch = target ? modelByKey.get(target) : undefined;
    const mappingConflict = (choice?.[0] === "directSkuMapped" && conflicts.has(direct)) ||
      (choice?.[0] === "supplierItem" && supplierConflicts.has(supplierItem)) ||
      (choice?.[0] === "uniqueItem" && itemConflicts.has(item)) ||
      (choice?.[0] === "validatedItem" && validatedConflicts.has(item)) ||
      (choice?.[0] === "skuMap" && conflicts.has(item));
    if (!choice || !target || !modelMatch || modelMatch.count !== 1 || mappingConflict) {
      unresolved += 1;
      currentUnresolvedTotal += remaining;
      unresolvedByState[status] += remaining;
      const reason = mappingConflict ? "mappingConflict" :
        !choice || !target ? "noMapping" : !modelMatch ? "outsideModel" : "modelCollision";
      unresolvedByReason[reason].rows += 1;
      unresolvedByReason[reason].units += remaining;
      largestUnresolved.push({
        item: text(value(row, detailItem)),
        order: text(value(row, detailOrder)),
        status,
        units: remaining,
        reason,
      });
      if (modelMatch && modelMatch.count !== 1) ambiguousModelRows += 1;
      continue;
    }
    byMethod[choice[0]] += 1;
    mapped += 1;
    byState[status] += remaining;
    if (legacyTarget && modelLegacyKeys.has(legacyTarget) &&
        normalizeVentasSku(legacyTarget) !== target) {
      allocationDisagreements.rows += 1;
      allocationDisagreements.fourStateUnits += remaining;
      if (status === "EN FABRICA" || status === "EMBARCADO") {
        allocationDisagreements.twoStateUnits += remaining;
      }
      allocationDisagreements.largestLines.push({
        item: text(value(row, detailItem)),
        resolvedSku: modelMatch.sku,
        legacySku: legacyTarget,
        order: text(value(row, detailOrder)),
        status,
        units: remaining,
      });
    }
    const totals = currentByKey.get(target) ?? emptyTotals();
    totals[status] += remaining;
    currentByKey.set(target, totals);
  }

  const twoStates = (totals: Totals) => totals["EN FABRICA"] + totals.EMBARCADO;
  const fourStates = (totals: Totals) => STATES.reduce((sum, status) => sum + totals[status], 0);
  const legacyMappedTotal = [...legacyByKey.values()].reduce((sum, amount) => sum + amount, 0);
  const largestDifferences = [...modelByKey.entries()]
    .filter(([, modelRow]) => modelRow.count === 1)
    .map(([key, modelRow]) => ({ sku: modelRow.sku, model: modelRow.pending, twoStates: twoStates(currentByKey.get(key) ?? emptyTotals()), fourStates: fourStates(currentByKey.get(key) ?? emptyTotals()) }))
    .filter((entry) => entry.model !== entry.twoStates)
    .sort((a, b) => Math.abs(b.twoStates - b.model) - Math.abs(a.twoStates - a.model))
    .slice(0, 30);
  const currentTwoTotal = twoStates(byState);
  const currentFourTotal = fourStates(byState);
  let matchingSku = 0;
  let differingSku = 0;
  let modelOnlySku = 0;
  let nonzeroModelOnlySku = 0;
  let nonzeroDifferingSku = 0;
  for (const [sku, pending] of modelByLegacyKey) {
    const calculated = legacyByKey.get(sku);
    if (calculated === undefined) {
      modelOnlySku += 1;
      if (pending !== 0) nonzeroModelOnlySku += 1;
    }
    else if (calculated === pending) matchingSku += 1;
    else {
      differingSku += 1;
      if (pending !== 0 || calculated !== 0) nonzeroDifferingSku += 1;
    }
  }
  const calculatedOnlySku = [...legacyByKey.keys()].filter((sku) => !modelByLegacyKey.has(sku)).length;

  return {
    rule: "El Dashboard reproduce B12B: CANTIDAD, ITEM canonizado y sólo EN FABRICA/EMBARCADO. El escenario de CANTIDAD_PENDIENTE y cuatro estados es únicamente diagnóstico.",
    rows: { model: modelo.length - 2, detail: detalle.length - 1, eligible, mapped, unresolved },
    model: { pendingTotal: modelPendingTotal, duplicateNormalizedKeys: [...modelByKey.values()].filter((row) => row.count > 1).length },
    legacyB12B: { mappedTotal: legacyMappedTotal, unresolvedTotal: legacyUnresolvedTotal, differenceFromModel: legacyMappedTotal - modelPendingTotal },
    pendingQuantityPreview: { byState, mappedTotal: currentFourTotal, unresolvedTotal: currentUnresolvedTotal, twoStateTotal: currentTwoTotal, fourStateTotal: currentFourTotal, differenceFromModel: currentTwoTotal - modelPendingTotal },
    mapping: {
      conflictingKeys: conflicts.size + validatedConflicts.size + supplierConflicts.size + itemConflicts.size,
      conflictsBySource: {
        skuMap: conflicts.size,
        validatedItem: validatedConflicts.size,
        supplierItem: supplierConflicts.size,
        uniqueItem: itemConflicts.size,
      },
      ambiguousModelRows,
      byMethod,
    },
    unresolved: {
      byReason: unresolvedByReason,
      byState: unresolvedByState,
      largestLines: largestUnresolved.sort((a, b) => b.units - a.units).slice(0, 20),
    },
    legacyParity: { matchingSku, differingSku, modelOnlySku, calculatedOnlySku, nonzeroModelOnlySku, nonzeroDifferingSku },
    allocationDisagreements: {
      ...allocationDisagreements,
      largestLines: allocationDisagreements.largestLines.sort((a, b) => b.units - a.units).slice(0, 20),
    },
    largestDifferences,
  };
}
