export type DailyLinesClass = "A" | "B" | "C";

export type DailyLinesMetric = {
  date: string;
  lines: number;
  orders: number;
  ratio: number;
  classification: DailyLinesClass;
};

export type DailyLinesResponse = {
  range: { from: string; to: string };
  updatedAt: string;
  averageLines: number;
  days: DailyLinesMetric[];
};

export type DailyLinesBridgeRow = {
  fecha: string;
  renglones: number;
  pedidos: number;
};

export function classifyDailyLines(lines: number, average: number): DailyLinesClass {
  if (average <= 0) return "B";
  const ratio = lines / average;
  if (ratio >= 1.1) return "A";
  if (ratio >= 0.8) return "B";
  return "C";
}

export function buildDailyLinesResponse(
  rows: DailyLinesBridgeRow[],
  range: DailyLinesResponse["range"],
  updatedAt: string,
): DailyLinesResponse {
  const validRows = rows.filter(
    (row) => /^\d{4}-\d{2}-\d{2}$/.test(row.fecha) && Number.isFinite(row.renglones) && row.renglones > 0,
  );
  const averageLines = validRows.length
    ? validRows.reduce((total, row) => total + row.renglones, 0) / validRows.length
    : 0;

  return {
    range,
    updatedAt,
    averageLines: Math.round(averageLines * 10) / 10,
    days: validRows.map((row) => ({
      date: row.fecha,
      lines: Math.round(row.renglones),
      orders: Math.max(0, Math.round(row.pedidos)),
      ratio: averageLines > 0 ? Math.round((row.renglones / averageLines) * 100) / 100 : 0,
      classification: classifyDailyLines(row.renglones, averageLines),
    })),
  };
}
