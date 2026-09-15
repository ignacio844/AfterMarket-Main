import type { SheetRows, SheetValue } from "@/lib/compras-dashboard";

export type ComprasVentasDemanda = {
  consumo12Meses: number;
  promedioMensual: number;
};

const MAPA_SKU_COLUMNS = [
  "CODIGO_NUEVO",
  "CODIGO_VIEJO",
  "BASE_OCTOSIS",
  "BASE_SISFACTURA",
  "BASE_MELIKOBO",
  "BASE_TORETTOS",
  "BASE_WARNES",
] as const;

export function normalizeVentasSku(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeHeader(value: SheetValue | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function canonicalizeVentasDemand(
  demandaBySku: Map<string, ComprasVentasDemanda>,
  mapaSku: SheetRows,
) {
  if (!mapaSku.length) {
    throw new Error("No existe la hoja MAPA_SKU requerida por la lógica legacy de Ventas.");
  }

  const headers = mapaSku[0].map(normalizeHeader);
  const newSkuIndex = headers.indexOf("CODIGO_NUEVO");
  if (newSkuIndex < 0) {
    throw new Error("MAPA_SKU debe contener la columna CODIGO_NUEVO.");
  }

  const mappingIndexes = MAPA_SKU_COLUMNS
    .map((column) => headers.indexOf(column))
    .filter((index) => index >= 0);
  const equivalencias = new Map<string, string>();

  for (const row of mapaSku.slice(1)) {
    const newSku = normalizeVentasSku(row[newSkuIndex]);
    if (!newSku) continue;

    equivalencias.set(newSku, newSku);
    for (const index of mappingIndexes) {
      const sourceSku = normalizeVentasSku(row[index]);
      if (sourceSku && !equivalencias.has(sourceSku)) {
        equivalencias.set(sourceSku, newSku);
      }
    }
  }

  const result = new Map<string, ComprasVentasDemanda>();
  for (const [sourceSku, demanda] of demandaBySku) {
    const canonicalSku = equivalencias.get(sourceSku) ?? sourceSku;
    const current = result.get(canonicalSku)?.consumo12Meses ?? 0;
    const consumo12Meses = current + demanda.consumo12Meses;
    result.set(canonicalSku, {
      consumo12Meses,
      promedioMensual: consumo12Meses / 12,
    });
  }

  return result;
}

export function applyVentasDemandToDashboardModel(
  modelo: SheetRows,
  demandaBySku: Map<string, ComprasVentasDemanda>,
): SheetRows {
  if (modelo.length < 2) return modelo;

  const result = modelo.map((row) => [...row]);
  const headers = result[1].map(normalizeHeader);
  const skuIndex = headers.indexOf("SKU");
  const consumoIndex = Math.max(
    headers.indexOf("CONSUMO_12_MESES"),
    headers.indexOf("CONSUMO_12M"),
  );
  const promedioIndex = headers.indexOf("PROMEDIO_MENSUAL");

  if (skuIndex < 0) {
    throw new Error("MODELO_COMPRAS debe contener la columna SKU.");
  }
  if (consumoIndex < 0 || promedioIndex < 0) {
    throw new Error(
      "MODELO_COMPRAS debe contener CONSUMO_12_MESES y PROMEDIO_MENSUAL para reemplazarlos por Ventas de Supabase.",
    );
  }

  for (let rowIndex = 2; rowIndex < result.length; rowIndex += 1) {
    const row = result[rowIndex];
    const skuKey = normalizeVentasSku(row[skuIndex]);
    if (!skuKey) continue;

    // El snapshot es completo para la ventana legacy. La ausencia de un SKU
    // equivale a cero unidades vendidas durante esos doce meses.
    const demanda = demandaBySku.get(skuKey);
    row[consumoIndex] = demanda?.consumo12Meses ?? 0;
    row[promedioIndex] = demanda?.promedioMensual ?? 0;
  }

  return result;
}
