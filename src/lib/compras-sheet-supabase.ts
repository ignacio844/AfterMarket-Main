import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SheetRows, SheetValue } from "@/lib/compras-dashboard";

type CurrentImport = { batch_id: number; import_id: number; sheet_name: string; row_count: number; time_zone: string };

export async function readComprasMirroredSheets<K extends string>(
  names: Record<K, string>,
  keys: readonly K[],
  required: K | null,
): Promise<{ sheets: Record<K, SheetRows>; timeZone: string; batchId: number }> {
  const db = getSupabaseAdmin();
  const requestedNames = keys.map((key) => names[key]);
  const { data, error } = await db.from("compras_sheet_actual_import")
    .select("batch_id,import_id,sheet_name,row_count,time_zone")
    .eq("spreadsheet_id", process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? "")
    .in("sheet_name", requestedNames);
  if (error) throw new Error(`No se pudo leer el espejo de Compras: ${error.message}`);

  const current = new Map<string, CurrentImport>((data ?? []).map((row) => [row.sheet_name, row]));
  if (required && !current.has(names[required])) {
    throw new Error(`Supabase no contiene un snapshot validado de ${names[required]}.`);
  }
  for (const name of requestedNames) {
    if (!current.has(name)) throw new Error(`Supabase no contiene un snapshot validado de ${name}.`);
  }
  const batchIds = new Set([...current.values()].map((entry) => Number(entry.batch_id)));
  if (batchIds.size !== 1) throw new Error("El espejo de Compras no tiene un lote consistente.");

  const sheets = Object.fromEntries(keys.map((key) => [key, [] as SheetRows])) as Record<K, SheetRows>;
  await Promise.all(keys.map(async (key) => {
    const importInfo = current.get(names[key]);
    if (!importInfo) return;
    const rows: SheetRows = [];
    const pageSize = 1_000;
    for (let first = 0; first < importInfo.row_count; first += pageSize) {
      const { data: page, error: pageError } = await db.from("compras_sheet_import_rows")
        .select("row_index,row_values").eq("import_id", importInfo.import_id)
        .order("row_index").range(first, first + pageSize - 1);
      if (pageError) throw new Error(`No se pudo leer ${names[key]} desde Supabase: ${pageError.message}`);
      for (const entry of page ?? []) {
        if (entry.row_index !== rows.length || !Array.isArray(entry.row_values)) {
          throw new Error(`Snapshot incompleto o desordenado de ${names[key]}.`);
        }
        rows.push(entry.row_values as SheetValue[]);
      }
    }
    if (rows.length !== importInfo.row_count) throw new Error(`Snapshot incompleto de ${names[key]}.`);
    sheets[key] = rows;
  }));

  const { data: after, error: afterError } = await db.from("compras_sheet_actual_import")
    .select("batch_id,import_id,sheet_name")
    .eq("spreadsheet_id", process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? "")
    .in("sheet_name", requestedNames);
  if (afterError) throw new Error(`No se pudo confirmar el espejo de Compras: ${afterError.message}`);
  for (const row of after ?? []) {
    if (Number(row.import_id) !== Number(current.get(row.sheet_name)?.import_id) ||
        Number(row.batch_id) !== Number(current.get(row.sheet_name)?.batch_id)) {
      throw new Error("El espejo de Compras cambió durante la lectura. Reintentá.");
    }
  }
  if (after?.length !== keys.length) throw new Error("El espejo de Compras cambió durante la lectura. Reintentá.");
  return {
    sheets,
    timeZone: current.get(names[required ?? keys[0]])?.time_zone ?? "America/Argentina/Buenos_Aires",
    batchId: [...batchIds][0],
  };
}
