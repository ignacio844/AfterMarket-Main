import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isPortalUserAllowed } from "@/lib/portal-auth";
import {
  createVentasSyncRequest,
  getActiveVentasSyncRequest,
  getVentasSyncRequest,
} from "@/lib/compras-ventas-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorizedEmail() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  return email && isPortalUserAllowed(email) ? email : null;
}

export async function POST() {
  const email = await authorizedEmail();
  if (!email) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const { request, created } = await createVentasSyncRequest(email);
    return NextResponse.json(
      { ok: true, alreadyRunning: !created, request },
      { status: created ? 202 : 200 },
    );
  } catch (cause) {
    const message = cause instanceof Error
      ? cause.message
      : "No se pudo iniciar la actualización de Ventas.";
    console.error("POST /api/compras/sync-ventas:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const email = await authorizedEmail();
  if (!email) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const idRaw = new URL(request.url).searchParams.get("id");
    if (!idRaw) {
      return NextResponse.json({ ok: true, request: await getActiveVentasSyncRequest() });
    }

    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "request_id inválido." }, { status: 400 });
    }

    const syncRequest = await getVentasSyncRequest(id);
    if (!syncRequest) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, request: syncRequest });
  } catch (cause) {
    const message = cause instanceof Error
      ? cause.message
      : "No se pudo consultar la actualización de Ventas.";
    console.error("GET /api/compras/sync-ventas:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
