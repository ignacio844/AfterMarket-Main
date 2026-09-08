import { executiveBrandManifest } from "./executive-brand-manifest";

export type BrandLinesBridgeRow = {
  fecha: string;
  desc_familia: string;
  renglones: number;
};

export type TopBrandMetric = {
  rank: number;
  name: string;
  logo: string | null;
  lines: number;
  share: number;
};

export type TopBrandsResponse = {
  range: { from: string; to: string };
  updatedAt: string;
  totalLines: number;
  brands: TopBrandMetric[];
};

function normalizeBrandText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function resolveExecutiveBrand(family: string): {
  key: string;
  name: string;
  logo: string | null;
} | null {
  const normalizedFamily = normalizeBrandText(family);
  if (!normalizedFamily) return null;
  const searchableFamily = ` ${normalizedFamily} `;
  const definition = executiveBrandManifest.find(({ matchTerms }) =>
    matchTerms.some((term) => searchableFamily.includes(` ${normalizeBrandText(term)} `)),
  );
  return {
    key: definition?.name ?? normalizedFamily,
    name: definition?.name ?? family.trim().replace(/\s+/g, " "),
    logo: definition?.logo ?? null,
  };
}

export function buildTopBrandsResponse(
  rows: BrandLinesBridgeRow[],
  range: TopBrandsResponse["range"],
  updatedAt: string,
  limit = 5,
): TopBrandsResponse {
  const totals = new Map<string, { name: string; logo: string | null; lines: number }>();

  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.fecha) || !Number.isFinite(row.renglones) || row.renglones <= 0) continue;
    const brand = resolveExecutiveBrand(row.desc_familia);
    if (!brand) continue;
    const current = totals.get(brand.key);
    totals.set(brand.key, {
      name: current?.name ?? brand.name,
      logo: current?.logo ?? brand.logo,
      lines: (current?.lines ?? 0) + Math.round(row.renglones),
    });
  }

  const totalLines = [...totals.values()].reduce((total, brand) => total + brand.lines, 0);
  const brands = [...totals.values()]
    .sort((a, b) => b.lines - a.lines || a.name.localeCompare(b.name, "es"))
    .slice(0, Math.max(0, limit))
    .map((brand, index) => ({
      rank: index + 1,
      name: brand.name,
      logo: brand.logo,
      lines: brand.lines,
      share: totalLines ? Math.round((brand.lines / totalLines) * 1_000) / 10 : 0,
    }));

  return { range, updatedAt, totalLines, brands };
}
