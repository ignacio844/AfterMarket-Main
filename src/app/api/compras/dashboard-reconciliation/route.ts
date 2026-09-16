import { auth } from "@/auth";
import { isPortalUserAllowed } from "@/lib/portal-auth";
import { getComprasPendingReconciliation } from "@/lib/compras-sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const email = (await auth())?.user?.email;
  if (!email || !isPortalUserAllowed(email)) {
    return Response.json({ error: "No autorizado." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    return Response.json(await getComprasPendingReconciliation(), {
      headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return Response.json({ error: "No se pudo conciliar el pendiente. Revisá las hojas fuente y volvé a intentar." }, {
      status: 503, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
