import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isPortalUserAllowed } from "@/lib/portal-auth";
import {
  createWarnesSyncRequest,
  dispatchWarnesSyncWorkflow,
  getActiveWarnesSyncRequest,
  getWarnesSyncRequest,
  markWarnesSyncRequestError,
} from "@/lib/compras-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorizedEmail() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email || !isPortalUserAllowed(email)) return null;
  return email;
}

export async function POST() {
  const email = await authorizedEmail();

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "No autorizado." },
      { status: 401 },
    );
  }

  try {
    const { request, created } = await createWarnesSyncRequest(email);

    // Si ya existe una actualización en curso, no disparamos otra.
    if (!created) {
      return NextResponse.json(
        {
          ok: true,
          alreadyRunning: true,
          request,
        },
        { status: 200 },
      );
    }

    try {
      await dispatchWarnesSyncWorkflow(request.id);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "No se pudo disparar GitHub Actions.";

      await markWarnesSyncRequestError(request.id, message);
      throw cause;
    }

    return NextResponse.json(
      {
        ok: true,
        alreadyRunning: false,
        request,
      },
      { status: 202 },
    );
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "No se pudo iniciar la actualización de Stock Warnes.";

    console.error("POST /api/compras/sync-warnes:", message);

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const email = await authorizedEmail();

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "No autorizado." },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const idRaw = searchParams.get("id");

    if (!idRaw) {
      const active = await getActiveWarnesSyncRequest();

      return NextResponse.json({
        ok: true,
        request: active,
      });
    }

    const id = Number(idRaw);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { ok: false, error: "request_id inválido." },
        { status: 400 },
      );
    }

    const syncRequest = await getWarnesSyncRequest(id);

    if (!syncRequest) {
      return NextResponse.json(
        { ok: false, error: "Solicitud no encontrada." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      request: syncRequest,
    });
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "No se pudo consultar la actualización de Stock Warnes.";

    console.error("GET /api/compras/sync-warnes:", message);

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
