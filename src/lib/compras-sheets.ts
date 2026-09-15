import "server-only";

import { JWT } from "google-auth-library";
import { auth } from "@/auth";
import { isPortalUserAllowed } from "@/lib/portal-auth";
import { calculateComprasDashboard, type ComprasDashboard, type SheetRows } from "@/lib/compras-dashboard";
import { calculateComprasGestion, type ComprasGestion } from "@/lib/compras-gestion";
import { calculateComprasHistorial, type ComprasHistorial } from "@/lib/compras-historial";
import { calculateComprasEnvios, type ComprasEnvios } from "@/lib/compras-envios";
import { calculateComprasCotizaciones, type ComprasCotizaciones } from "@/lib/compras-cotizaciones";
import { calculateComprasBandeja, type ComprasBandeja } from "@/lib/compras-bandeja";
import { calculateComprasProceso, type ComprasProceso } from "@/lib/compras-proceso";
import { calculateComprasPacking, type ComprasPacking } from "@/lib/compras-packing";
import { calculateComprasContenedores, type ComprasContenedores } from "@/lib/compras-contenedores";
import { calculateComprasSeguimiento, type ComprasSeguimiento } from "@/lib/compras-seguimiento";
import { calculateComprasRecepciones, type ComprasRecepciones } from "@/lib/compras-recepciones";
import { calculateComprasTransferencias, type ComprasTransferencias } from "@/lib/compras-transferencias";
import {
  applyWarnesImportDateToControlStock,
  applyWarnesStockToDashboardModel,
  getComprasStockWarnesActual,
} from "@/lib/compras-stock-supabase";
import {
  getComprasVentasActual,
  ventasFreshnessRows,
} from "@/lib/compras-ventas-supabase";

const READ_ONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const SHEET_NAMES = {
  modelo: "MODELO_COMPRAS",
  config: "CONFIG_MARCAS_COMPRA",
  alias: "ALIAS_MARCAS_COMPRA",
  controlStock: "CONTROL_IMPORTACIONES_STOCK",
  ventas: "VENTAS",
  logImportaciones: "LOG_IMPORTACIONES",
  gestion: "GESTION_COMPRAS_ACTIVA",
  gestionHistorial: "GESTION_COMPRAS",
  enviosCompra: "ENVIOS_COMPRA",
  procesoCompra: "COMPRAS_EN_PROCESO",
  movimientosCompra: "MOVIMIENTOS_COMPRA",
  ordenesCompra: "ORDENES_COMPRA_PORTAL",
  cotizaciones: "COTIZACIONES_COMPRA",
  ofertas: "COTIZACIONES_OFERTAS",
  packingList: "PACKING_LIST",
  packingListDetalle: "PACKING_LIST_DETALLE",
  contenedores: "CONTENEDORES",
  contenedorPacking: "CONTENEDOR_PACKING_LIST",
  ordenes: "ORDENES",
  historialLogistica: "HISTORIAL_ESTADOS_LOGISTICA",
  detalleImportaciones: "DETALLE_IMPORTACIONES",
} as const;

type SheetMetadata = { properties?: { timeZone?: string }; sheets?: Array<{ properties?: { title?: string } }> };
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

type SheetKey = keyof typeof SHEET_NAMES;

async function readSheets<const K extends SheetKey>(keys: readonly K[], required: K | null): Promise<{ sheets: Record<K, SheetRows>; timeZone: string }> {
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
  metadataUrl.searchParams.set("fields", "properties(timeZone),sheets(properties(title))");
  const metadata = await googleGet<SheetMetadata>(metadataUrl, token);
  const available = new Set(metadata.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean));
  if (required && !available.has(SHEET_NAMES[required])) throw new Error(`No existe la hoja ${SHEET_NAMES[required]}.`);

  const present = keys.filter((keyName) => available.has(SHEET_NAMES[keyName]));
  const result = Object.fromEntries(keys.map((keyName) => [keyName, [] as SheetRows])) as Record<K, SheetRows>;
  if (present.length === 0) {
    return { sheets: result, timeZone: metadata.properties?.timeZone || "America/Argentina/Buenos_Aires" };
  }
  const valuesUrl = new URL(`${base}/values:batchGet`);
  valuesUrl.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  valuesUrl.searchParams.set("dateTimeRenderOption", "SERIAL_NUMBER");
  for (const keyName of present) {
    const sheetRange = `'${SHEET_NAMES[keyName]}'${keyName === "ventas" ? "!1:2" : ""}`;
    valuesUrl.searchParams.append("ranges", sheetRange);
  }
  const response = await googleGet<ValuesResponse>(valuesUrl, token);
  present.forEach((keyName, index) => {
    result[keyName] = response.valueRanges?.[index]?.values ?? [];
  });
  return { sheets: result, timeZone: metadata.properties?.timeZone || "America/Argentina/Buenos_Aires" };
}

export async function getComprasDashboard(): Promise<ComprasDashboard> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isPortalUserAllowed(email)) throw new Error("No autorizado.");

  const [{ sheets }, warnes, ventas] = await Promise.all([
    readSheets(
      ["modelo", "config", "alias", "controlStock", "logImportaciones"],
      "modelo",
    ),
    getComprasStockWarnesActual(),
    getComprasVentasActual(),
  ]);

  const dashboardSheets = {
    ...sheets,
    modelo: applyWarnesStockToDashboardModel(sheets.modelo, warnes.stockBySku),
    controlStock: applyWarnesImportDateToControlStock(
      sheets.controlStock,
      warnes.fechaImportacion,
    ),
    ventas: ventasFreshnessRows(ventas.fechaImportacion),
  };

  return calculateComprasDashboard(dashboardSheets, email);
}

export async function getComprasGestion(): Promise<ComprasGestion> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isPortalUserAllowed(email)) throw new Error("No autorizado.");
  const { sheets, timeZone } = await readSheets(["gestion", "config", "alias"], "gestion");
  return calculateComprasGestion(sheets, new Date(), timeZone);
}

export async function getComprasHistorial(sku: string): Promise<ComprasHistorial> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isPortalUserAllowed(email)) throw new Error("No autorizado.");
  if (!sku.trim() || sku.length > 100) throw new Error("Ingresá un SKU válido.");
  const { sheets, timeZone } = await readSheets(
    ["gestion", "config", "alias", "gestionHistorial", "enviosCompra", "procesoCompra", "movimientosCompra"],
    null,
  );
  return calculateComprasHistorial({ gestionActiva: sheets.gestion, ...sheets }, sku, timeZone);
}

export async function getComprasEnvios(): Promise<ComprasEnvios> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isPortalUserAllowed(email)) throw new Error("No autorizado.");
  const { sheets, timeZone } = await readSheets(["enviosCompra", "ordenesCompra", "procesoCompra"], "enviosCompra");
  return calculateComprasEnvios(sheets, timeZone);
}

export async function getComprasCotizaciones(): Promise<ComprasCotizaciones> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isPortalUserAllowed(email)) throw new Error("No autorizado.");
  const { sheets, timeZone } = await readSheets(
    ["gestion", "cotizaciones", "ofertas", "config", "alias"],
    "gestion",
  );
  return calculateComprasCotizaciones(sheets, timeZone);
}

export async function getComprasBandeja(): Promise<ComprasBandeja> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isPortalUserAllowed(email)) throw new Error("No autorizado.");
  const { sheets, timeZone } = await readSheets(["gestion", "cotizaciones", "ofertas"], "gestion");
  return calculateComprasBandeja(sheets, timeZone);
}

export async function getComprasProceso(): Promise<ComprasProceso> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isPortalUserAllowed(email)) throw new Error("No autorizado.");
  const { sheets, timeZone } = await readSheets(["procesoCompra", "enviosCompra", "movimientosCompra"], "enviosCompra");
  return calculateComprasProceso(sheets, new Date(), timeZone);
}


export async function getComprasPacking(): Promise<ComprasPacking> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isPortalUserAllowed(email)) throw new Error("No autorizado.");
  const { sheets, timeZone } = await readSheets(["packingList", "packingListDetalle"], "packingList");
  return calculateComprasPacking(sheets, new Date(), timeZone);
}


export async function getComprasContenedores(): Promise<ComprasContenedores> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isPortalUserAllowed(email)) throw new Error("No autorizado.");
  const { sheets, timeZone } = await readSheets(["contenedores", "contenedorPacking", "packingList"], "contenedores");
  return calculateComprasContenedores(sheets, new Date(), timeZone);
}


export async function getComprasSeguimiento(): Promise<ComprasSeguimiento> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isPortalUserAllowed(email)) throw new Error("No autorizado.");
  const { sheets, timeZone } = await readSheets(["ordenes", "historialLogistica", "packingListDetalle"], "ordenes");
  return calculateComprasSeguimiento(sheets, new Date(), timeZone);
}


export async function getComprasRecepciones(): Promise<ComprasRecepciones> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isPortalUserAllowed(email)) throw new Error("No autorizado.");
  const { sheets } = await readSheets(["ordenes", "detalleImportaciones"], "ordenes");
  return calculateComprasRecepciones(sheets, new Date());
}


export async function getComprasTransferencias(): Promise<ComprasTransferencias> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isPortalUserAllowed(email)) throw new Error("No autorizado.");
  const { sheets } = await readSheets(["gestion"], "gestion");
  return calculateComprasTransferencias(sheets, new Date());
}
