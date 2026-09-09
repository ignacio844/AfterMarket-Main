export const WMS_TRACKER_PROCESSES = [
  "GENERALES",
  "RECEPCIÓN",
  "GUARDADO / STOCK",
  "PICKING",
  "ISLA DE CONTROL",
  "EXPEDICIÓN",
  "AUDITORIAS",
] as const;

export const WMS_TRACKER_TASK_TYPES = ["Funcion SGL", "LayOut", "Herramientas", "Pruebas", "Entrenamiento"] as const;
export const WMS_TRACKER_RESPONSIBLES = ["Equipo SGL", "Logistica"] as const;
export const WMS_TRACKER_STATUSES = ["No Realizado", "Realizando", "Realizado", "Hecho", "Verificado"] as const;

export type WmsTrackerProcess = (typeof WMS_TRACKER_PROCESSES)[number];
export type WmsTrackerTaskType = (typeof WMS_TRACKER_TASK_TYPES)[number];
export type WmsTrackerResponsible = (typeof WMS_TRACKER_RESPONSIBLES)[number];
export type WmsTrackerStatus = (typeof WMS_TRACKER_STATUSES)[number];

export type WmsTrackerTask = {
  id: string;
  sourceKey: string;
  process: WmsTrackerProcess;
  taskDate: string;
  title: string;
  taskType: WmsTrackerTaskType;
  description: string;
  priority: 1 | 2 | 3 | 4;
  responsible: WmsTrackerResponsible;
  status: WmsTrackerStatus;
  isDoing: boolean;
  isCompleted: boolean;
  isDone: boolean;
  isVerified: boolean;
  responseDate: string;
  response: string;
  position: number;
  updatedAt?: string;
  updatedBy?: string;
};

export type WmsTrackerSummary = {
  total: number;
  byStatus: Record<WmsTrackerStatus, number>;
  byResponsible: Record<WmsTrackerResponsible, number>;
};

export function getWmsTrackerStatus(task: Pick<WmsTrackerTask, "isDoing" | "isCompleted" | "isDone" | "isVerified">): WmsTrackerStatus {
  if (task.isVerified) return "Verificado";
  if (task.isDone) return "Hecho";
  if (task.isCompleted) return "Realizado";
  if (task.isDoing) return "Realizando";
  return "No Realizado";
}

export function getWmsTrackerSummary(tasks: WmsTrackerTask[]): WmsTrackerSummary {
  const byStatus = Object.fromEntries(WMS_TRACKER_STATUSES.map((status) => [status, 0])) as Record<WmsTrackerStatus, number>;
  const byResponsible = Object.fromEntries(WMS_TRACKER_RESPONSIBLES.map((responsible) => [responsible, 0])) as Record<WmsTrackerResponsible, number>;

  for (const task of tasks) {
    byStatus[task.status] += 1;
    byResponsible[task.responsible] += 1;
  }

  return { total: tasks.length, byStatus, byResponsible };
}
