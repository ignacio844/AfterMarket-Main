import "server-only";

import { JWT } from "google-auth-library";
import { auth } from "@/auth";
import { isPortalUserAllowed } from "@/lib/portal-auth";
import { calculateComprasDashboard, type ComprasDashboard, type DashboardSheets, type SheetRows } from "@/lib/compras-dashboard";

const READ_ONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const SHEET_NAMES = {
  modelo: "MODELO_COMPRAS",
  config: "CONFIG_MARCAS_COMPRA",
  alias: "ALIAS_MARCAS_COMPRA",
  controlStock: "CONTROL_IMPORTACIONES_STOCK",
  ventas: "VENTAS",
  logImportaciones: "LOG_IMPORTACIONES",
} as const;

type SheetMetadata = { sheets?: Array<{ properties?: { title?: string } }> };
type ValuesResponse = { valueRanges?: Array<{ values?: SheetRows }> };

function settings() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!spreadsheetId || !email || !key) {
    throw new Error("Falta configurar el acceso de solo lectura a Google Sheets.");
  }
  return { spreadsheetId, email, key };
}

async function googleGet<T>(url: URL, accessToken: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    throw new Error("No se pudo conectar con Google Sheets.");
  }
  if (!response.ok) {
    throw new Error(`No se pudo leer Google Sheets (HTTP ${response.status}). Verificá el ID, la API y el acceso de la cuenta de servicio.`);
  }
  return (await response.json()) as T;
}

async function readDashboardSheets(): Promise<DashboardSheets> {
  const { spreadsheetId, email, key } = settings();
  const client = new JWT({ email, key, scopes: [READ_ONLY_SCOPE] });
  let token: string | null | undefined;
  try {
    ({ token } = await client.getAccessToken());
  } catch {
    throw new Error("No se pudo autenticar la cuenta de servicio de Google.");
  }
  if (!token) throw new Error("No se pudo autenticar la cuenta de servicio de Google.");

  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
  const metadataUrl = new URL(base);
  metadataUrl.searchParams.set("fields", "sheets(properties(title))");
  const metadata = await googleGet<SheetMetadata>(metadataUrl, token);
  const available = new Set(metadata.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean));
  if (!available.has(SHEET_NAMES.modelo)) throw new Error("No existe la hoja MODELO_COMPRAS.");

  const keys = Object.keys(SHEET_NAMES) as Array<keyof typeof SHEET_NAMES>;
  const present = keys.filter((keyName) => available.has(SHEET_NAMES[keyName]));
  const valuesUrl = new URL(`${base}/values:batchGet`);
  valuesUrl.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  valuesUrl.searchParams.set("dateTimeRenderOption", "SERIAL_NUMBER");
  for (const keyName of present) {
    const sheetRange = `'${SHEET_NAMES[keyName]}'${keyName === "ventas" ? "!1:2" : ""}`;
    valuesUrl.searchParams.append("ranges", sheetRange);
  }
  const response = await googleGet<ValuesResponse>(valuesUrl, token);
  const result = Object.fromEntries(keys.map((keyName) => [keyName, [] as SheetRows])) as DashboardSheets;
  present.forEach((keyName, index) => {
    result[keyName] = response.valueRanges?.[index]?.values ?? [];
  });
  return result;
}

export async function getComprasDashboard(): Promise<ComprasDashboard> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isPortalUserAllowed(email)) throw new Error("No autorizado.");
  return calculateComprasDashboard(await readDashboardSheets(), email);
}
