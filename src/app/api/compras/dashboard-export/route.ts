import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { getComprasDashboard } from "@/lib/compras-sheets";
import type { DashboardBrand } from "@/lib/compras-dashboard";
import { isPortalUserAllowed } from "@/lib/portal-auth";

export const dynamic = "force-dynamic";

const headers = [
  "MARCA", "SIN STOCK", "URGENTE", "COMPRAR", "COMPRA SUGERIDA",
  "CONSUMO TRIM. PROM.", "COBERTURA ACTUAL", "OBJETIVO",
];

function addBrandsSheet(workbook: ExcelJS.Workbook, title: string, brands: DashboardBrand[]) {
  const sheet = workbook.addWorksheet(title);
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E2841" } };
  sheet.columns = [
    { width: 26 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 20 }, { width: 23 }, { width: 21 }, { width: 14 },
  ];
  for (const brand of brands.slice(0, 30)) {
    sheet.addRow([
      brand.marca, brand.sinStock, brand.urgente, brand.comprar, brand.compra,
      Math.round(brand.consumoTrimestralPromedio),
      Number(brand.coberturaPromedio.toFixed(2)), Number(brand.coberturaObjetivo.toFixed(1)),
    ]);
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: `H${Math.max(1, sheet.rowCount)}` };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !isPortalUserAllowed(session.user.email)) {
    return Response.json({ error: "No autorizado." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const dashboard = await getComprasDashboard();
    const workbook = new ExcelJS.Workbook();
    addBrandsSheet(workbook, "Marcas Importadas", dashboard.marcasImportadas);
    addBrandsSheet(workbook, "Marcas Nacionales", dashboard.marcasNacionales);
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Dashboard_Compras.xlsx"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "No se pudo generar el archivo. Revisá el acceso de Google Sheets y volvé a intentar." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
