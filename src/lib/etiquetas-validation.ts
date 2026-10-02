import { ETIQUETAS_MAX_FILE_SIZE } from "@/lib/etiquetas-types";

export class EtiquetaValidationError extends Error {}

export function validateEtiquetaId(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new EtiquetaValidationError("El identificador no es válido.");
  }
  return value;
}

export function validateEtiquetaDetails(name: unknown, description: unknown) {
  if (typeof name !== "string" || !name.trim() || name.trim().length > 180) {
    throw new EtiquetaValidationError("Ingresá un nombre de hasta 180 caracteres.");
  }
  if (typeof description !== "string" || description.trim().length > 500) {
    throw new EtiquetaValidationError("La descripción admite hasta 500 caracteres.");
  }
  return { name: name.trim(), description: description.trim() };
}

export function validateEtiquetaFolderId(value: unknown) {
  return value === null || value === undefined || value === "" ? null : validateEtiquetaId(value);
}

export function validateEtiquetaMetadata(form: FormData) {
  const file = form.get("file");
  const name = form.get("name");
  const description = form.get("description") ?? "";
  if (!(file instanceof File)) throw new EtiquetaValidationError("Seleccioná un archivo.");
  if (file.size === 0) throw new EtiquetaValidationError("El archivo está vacío.");
  if (file.size > ETIQUETAS_MAX_FILE_SIZE) throw new EtiquetaValidationError("El archivo supera el máximo de 4 MB.");
  const details = validateEtiquetaDetails(name, description);
  const folderId = validateEtiquetaFolderId(form.get("folderId"));
  const fileName = file.name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!fileName || fileName.length > 240) throw new EtiquetaValidationError("El nombre del archivo no es válido (máximo 240 caracteres).");
  return { file, fileName, ...details, folderId };
}

export async function validateEtiquetaJson(file: File, fileName: string) {
  if (!fileName.toLowerCase().endsWith(".json")) return;
  try {
    JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
  } catch {
    throw new EtiquetaValidationError("El archivo JSON no es válido. Revisá su contenido antes de publicarlo.");
  }
}

export function etiquetaContentType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    json: "application/json; charset=utf-8", txt: "text/plain; charset=utf-8",
    csv: "text/plain; charset=utf-8", tsv: "text/plain; charset=utf-8",
    md: "text/plain; charset=utf-8", xml: "text/plain; charset=utf-8", zpl: "text/plain; charset=utf-8",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", avif: "image/avif", pdf: "application/pdf",
  };
  return types[extension ?? ""] ?? "application/octet-stream";
}

export function etiquetaContentDisposition(fileName: string, download: boolean) {
  const fallback = fileName.replace(/[^a-zA-Z0-9._ -]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
