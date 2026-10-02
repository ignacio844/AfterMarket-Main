export const ETIQUETAS_MAX_FILE_SIZE = 4 * 1024 * 1024;

export type EtiquetaFile = {
  id: string;
  name: string;
  description: string;
  fileName: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  folderId: string | null;
};

export type EtiquetaFolder = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
};

export function getEtiquetaPreviewType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "json") return "json";
  if (["txt", "csv", "tsv", "md", "xml", "zpl"].includes(extension ?? "")) return "text";
  if (["png", "jpg", "jpeg", "gif", "webp", "avif"].includes(extension ?? "")) return "image";
  return "download";
}

export function formatEtiquetaSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
