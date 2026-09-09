import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isPortalEditor } from "@/lib/portal-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getWmsTrackerData } from "@/lib/wms-tracker-data";
import {
  WMS_TRACKER_PROCESSES,
  WMS_TRACKER_RESPONSIBLES,
  WMS_TRACKER_TASK_TYPES,
  type WmsTrackerProcess,
  type WmsTrackerResponsible,
  type WmsTrackerTaskType,
} from "@/lib/wms-tracker-types";

type TrackerMutation = Record<string, unknown> & { action?: string };

function requiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} es obligatorio.`);
  return value.trim().slice(0, maxLength);
}

function optionalText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function oneOf<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (!values.includes(value as T)) throw new Error(`${label} no es válido.`);
  return value as T;
}

function priority(value: unknown): 1 | 2 | 3 | 4 {
  const parsed = Number(value);
  if (![1, 2, 3, 4].includes(parsed)) throw new Error("La prioridad no es válida.");
  return parsed as 1 | 2 | 3 | 4;
}

function taskId(value: unknown) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error("La tarea no es válida.");
  return parsed;
}

function optionalDate(value: unknown, label: string) {
  if (value === "" || value == null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} no es válida.`);
  }
  return value;
}

function taskValues(body: TrackerMutation) {
  return {
    process: oneOf(body.process, WMS_TRACKER_PROCESSES, "El proceso") as WmsTrackerProcess,
    task_date: optionalDate(body.taskDate, "La fecha"),
    title: requiredText(body.title, "El título", 240),
    task_type: oneOf(body.taskType, WMS_TRACKER_TASK_TYPES, "El tipo") as WmsTrackerTaskType,
    description: optionalText(body.description, 4_000),
    priority: priority(body.priority),
    responsible: oneOf(body.responsible, WMS_TRACKER_RESPONSIBLES, "El responsable") as WmsTrackerResponsible,
    is_doing: Boolean(body.isDoing),
    is_completed: Boolean(body.isCompleted),
    is_done: Boolean(body.isDone),
    is_verified: Boolean(body.isVerified),
    response_date: optionalDate(body.responseDate, "La fecha de respuesta"),
    response: optionalText(body.response, 4_000),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });

  const tracker = await getWmsTrackerData();
  return NextResponse.json(tracker, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });
  if (!isPortalEditor(session.user.email)) return NextResponse.json({ error: "No tenés permisos de edición." }, { status: 403 });

  try {
    const body = (await request.json()) as TrackerMutation;
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    if (body.action === "task.create") {
      const { data: lastTask, error: positionError } = await supabase
        .from("wms_tracker_tasks")
        .select("position")
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (positionError) throw positionError;

      const { error } = await supabase.from("wms_tracker_tasks").insert({
        ...taskValues(body),
        source_key: `portal-${crypto.randomUUID()}`,
        position: (lastTask?.position ?? -1) + 1,
        created_by: session.user.email.toLowerCase(),
        updated_by: session.user.email.toLowerCase(),
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "task.update") {
      const { error } = await supabase
        .from("wms_tracker_tasks")
        .update({ ...taskValues(body), updated_at: now, updated_by: session.user.email.toLowerCase() })
        .eq("id", taskId(body.id))
        .eq("is_active", true);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "task.archive") {
      const { error } = await supabase
        .from("wms_tracker_tasks")
        .update({ is_active: false, updated_at: now, updated_by: session.user.email.toLowerCase() })
        .eq("id", taskId(body.id))
        .eq("is_active", true);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el cambio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
