import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeGestionChanges } from "@/lib/compras-gestion";
import { saveGestionChanges } from "@/lib/compras-gestion-supabase";
import { isPortalEditor, isPortalUserAllowed } from "@/lib/portal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const email = (await auth())?.user?.email?.trim().toLowerCase();
  if (!email || !isPortalUserAllowed(email)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!isPortalEditor(email)) return NextResponse.json({ error: "No tenés permisos de edición." }, { status: 403 });
  if (process.env.COMPRAS_GESTION_SOURCE !== "SUPABASE") {
    return NextResponse.json({ error: "El guardado de Gestión aún no está habilitado." }, { status: 503 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  }
  try {
    const payload = await request.json();
    const changes = normalizeGestionChanges(payload?.changes);
    const saved = await saveGestionChanges(changes, email);
    return NextResponse.json({ ok: true, saved });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "No se pudo guardar Gestión.";
    const status = /inválid|Seleccioná/.test(message) ? 400 : /cambió|Recargá|SKU no migrado/.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
