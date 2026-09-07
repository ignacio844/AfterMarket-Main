import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  buildDailyLinesResponse,
  type DailyLinesBridgeRow,
} from "@/lib/executive-lines";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 93;

function resolveDateRange(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) throw new Error("INVALID_DATE");

  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  const days = (toDate.getTime() - fromDate.getTime()) / 86_400_000;
  if (days < 0 || days > MAX_RANGE_DAYS) throw new Error("INVALID_RANGE");
  return { from, to };
}

function normalizeRows(value: unknown): DailyLinesBridgeRow[] {
  if (!Array.isArray(value)) throw new Error("BRIDGE_INVALID_RESPONSE");
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new Error("BRIDGE_INVALID_RESPONSE");
    const row = item as Record<string, unknown>;
    const fecha = String(row.fecha ?? "");
    const renglones = Number(row.renglones);
    const pedidos = Number(row.pedidos);
    if (!ISO_DATE.test(fecha) || !Number.isFinite(renglones) || !Number.isFinite(pedidos)) {
      throw new Error("BRIDGE_INVALID_RESPONSE");
    }
    return { fecha, renglones, pedidos };
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });
  }

  try {
    const range = resolveDateRange(request);
    const bridgeUrl = process.env.EXECUTIVE_BRIDGE_URL;
    const bridgeToken = process.env.EXECUTIVE_BRIDGE_TOKEN;
    if (!bridgeUrl || !bridgeToken) throw new Error("BRIDGE_NOT_CONFIGURED");

    const url = new URL(`${bridgeUrl.replace(/\/$/, "")}/executive/daily-lines`);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      throw new Error("BRIDGE_INSECURE_URL");
    }
    url.searchParams.set("from", range.from);
    url.searchParams.set("to", range.to);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${bridgeToken}`,
        "ngrok-skip-browser-warning": "portal-aftermarket",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
    if (!response.ok) throw new Error(`BRIDGE_${response.status}`);

    const payload = await response.json() as { rows?: unknown; updatedAt?: unknown };
    const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : "";
    if (!updatedAt || Number.isNaN(Date.parse(updatedAt))) throw new Error("BRIDGE_INVALID_RESPONSE");
    const result = buildDailyLinesResponse(normalizeRows(payload.rows), range, updatedAt);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "BRIDGE_ERROR";
    if (code === "INVALID_DATE" || code === "INVALID_RANGE") {
      return NextResponse.json({ error: "El rango de fechas solicitado no es válido." }, { status: 400 });
    }
    if (code === "BRIDGE_NOT_CONFIGURED") {
      return NextResponse.json({ error: "La conexión con SQL todavía no está configurada." }, { status: 503 });
    }
    if (code === "BRIDGE_INSECURE_URL") {
      return NextResponse.json({ error: "El bridge remoto debe utilizar HTTPS." }, { status: 503 });
    }
    console.error("Error consultando indicadores ejecutivos:", cause);
    return NextResponse.json({ error: "No se pudieron consultar los renglones en este momento." }, { status: 502 });
  }
}
