import "server-only";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/lib/supabase-admin";
import { wmsTrackerSeedTasks } from "@/lib/wms-tracker-seed";
import type {
  WmsTrackerProcess,
  WmsTrackerResponsible,
  WmsTrackerStatus,
  WmsTrackerTask,
  WmsTrackerTaskType,
} from "@/lib/wms-tracker-types";

export type WmsTrackerRow = {
  id: number;
  source_key: string;
  process: WmsTrackerProcess;
  task_date: string | null;
  title: string;
  task_type: WmsTrackerTaskType;
  description: string;
  priority: 1 | 2 | 3 | 4;
  responsible: WmsTrackerResponsible;
  status: WmsTrackerStatus;
  is_doing: boolean;
  is_completed: boolean;
  is_done: boolean;
  is_verified: boolean;
  response_date: string | null;
  response: string;
  position: number;
  updated_at: string;
  updated_by: string | null;
};

export function mapWmsTrackerRow(row: WmsTrackerRow): WmsTrackerTask {
  return {
    id: String(row.id),
    sourceKey: row.source_key,
    process: row.process,
    taskDate: row.task_date ?? "",
    title: row.title,
    taskType: row.task_type,
    description: row.description,
    priority: row.priority,
    responsible: row.responsible,
    status: row.status,
    isDoing: row.is_doing,
    isCompleted: row.is_completed,
    isDone: row.is_done,
    isVerified: row.is_verified,
    responseDate: row.response_date ?? "",
    response: row.response,
    position: row.position,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? undefined,
  };
}

export async function getWmsTrackerData(): Promise<{ tasks: WmsTrackerTask[]; connected: boolean }> {
  if (!hasSupabaseAdminConfig()) return { tasks: wmsTrackerSeedTasks, connected: false };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("wms_tracker_tasks")
    .select("id, source_key, process, task_date, title, task_type, description, priority, responsible, status, is_doing, is_completed, is_done, is_verified, response_date, response, position, updated_at, updated_by")
    .eq("is_active", true)
    .order("position");

  if (error) {
    if (error.code === "PGRST205") console.info("La migración del tracker WMS todavía no fue aplicada.");
    else console.error("No se pudo cargar el tracker WMS", error);
    return { tasks: wmsTrackerSeedTasks, connected: false };
  }

  return { tasks: ((data ?? []) as WmsTrackerRow[]).map(mapWmsTrackerRow), connected: true };
}
