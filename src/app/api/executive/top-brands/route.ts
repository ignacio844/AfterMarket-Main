import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isExecutiveViewer } from "@/lib/portal-auth";
import {
  buildTopBrandsResponse,
  type BrandLinesBridgeRow,
} from "@/lib/executive-brands";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function localDateText(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function lastThirtyDays() {
  const to = localDateText();
  const fromDate = new Date(`${to}T00:00:00.000Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - 29);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

function normalizeRows(value: unknown): BrandLinesBridgeRow[] {
  if (!Array.isArray(value)) throw new Error("BRIDGE_INVALID_RESPONSE");
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new Error("BRIDGE_INVALID_RESPONSE");
    const row = item as Record<string, unknown>;
    const fecha = String(row.fecha ?? "");
    const desc_familia = String(row.desc_familia ?? "").trim();
    const renglones = Number(row.renglones);
    if (!ISO_DATE.test(fecha) || !desc_familia || !Number.isFinite(renglones) || renglones <= 0) {
      throw new Error("BRIDGE_INVALID_RESPONSE");
    }
    return { fecha, desc_familia, renglones };
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });
  }
  if (!isExecutiveViewer(session.user.email)) {
    return NextResponse.json({ error: "No tenés acceso a la información ejecutiva." }, { status: 403 });
  }

  try {
    const range = lastThirtyDays();
    const bridgeUrl = process.env.EXECUTIVE_BRIDGE_URL;
    const bridgeToken = process.env.EXECUTIVE_BRIDGE_TOKEN;
    if (!bridgeUrl || !bridgeToken) throw new Error("BRIDGE_NOT_CONFIGURED");

    const url = new URL(`${bridgeUrl.replace(/\/$/, "")}/executive/brand-lines`);
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
    return NextResponse.json(buildTopBrandsResponse(normalizeRows(payload.rows), range, updatedAt), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "BRIDGE_ERROR";
    if (code === "BRIDGE_NOT_CONFIGURED") {
      return NextResponse.json({ error: "La conexión con SQL todavía no está configurada." }, { status: 503 });
    }
    if (code === "BRIDGE_INSECURE_URL") {
      return NextResponse.json({ error: "El bridge remoto debe utilizar HTTPS." }, { status: 503 });
    }
    console.error("Error consultando el ranking de marcas:", cause);
    return NextResponse.json({ error: "No se pudo consultar el ranking de marcas en este momento." }, { status: 502 });
  }
}
