import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isPortalEditor, isPortalUserAllowed } from "@/lib/portal-auth";
import { getEtiquetasData } from "@/lib/etiquetas-data";
import { saveEtiquetaUpload } from "@/lib/etiquetas-files";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });
  if (!isPortalUserAllowed(session.user.email)) return NextResponse.json({ error: "No tenés acceso al portal." }, { status: 403 });
  const data = await getEtiquetasData();
  return NextResponse.json(data, { status: data.connected ? 200 : 503, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });
  if (!isPortalUserAllowed(session.user.email) || !isPortalEditor(session.user.email)) {
    return NextResponse.json({ error: "Sólo los administradores pueden cargar archivos." }, { status: 403 });
  }
  return saveEtiquetaUpload(request, session.user.email);
}
