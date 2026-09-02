import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isPortalEditor } from "@/lib/portal-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { WMS_RESOURCE_TYPES, type WmsResourceType } from "@/lib/wms-types";

type AdminAction =
  | { action: "module.create"; name: string; description: string; iconKey: string }
  | { action: "module.update"; id: string; name: string; description: string; iconKey: string }
  | { action: "module.archive"; id: string }
  | { action: "resource.create"; moduleId: string; name: string; href: string; type: WmsResourceType; isPrimary: boolean }
  | { action: "resource.update"; id: string; moduleId: string; name: string; href: string; type: WmsResourceType; isPrimary: boolean }
  | { action: "resource.archive"; id: string };

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

function requiredText(value: unknown, label: string, maxLength = 180) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} es obligatorio.`);
  return value.trim().slice(0, maxLength);
}

function databaseId(value: unknown) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("El identificador no es válido.");
  return id;
}

function validUrl(value: unknown) {
  const href = requiredText(value, "El enlace", 2_000);
  const url = new URL(href);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("El enlace debe comenzar con http:// o https://.");
  return url.toString();
}

function resourceType(value: unknown): WmsResourceType {
  if (!WMS_RESOURCE_TYPES.includes(value as WmsResourceType)) throw new Error("El tipo de recurso no es válido.");
  return value as WmsResourceType;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });
  if (!isPortalEditor(session.user.email)) return NextResponse.json({ error: "No tenés permisos de edición." }, { status: 403 });

  try {
    const body = (await request.json()) as AdminAction;
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    if (body.action === "module.create") {
      const name = requiredText(body.name, "El nombre");
      const { data: lastModule } = await supabase.from("wms_modules").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await supabase
        .from("wms_modules")
        .insert({
          slug: `${slugify(name) || "modulo"}-${Date.now().toString(36)}`,
          name,
          description: (body.description ?? "").trim().slice(0, 500),
          icon_key: requiredText(body.iconKey || "folder", "El ícono", 40),
          position: (lastModule?.position ?? -1) + 1,
        })
        .select("id")
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, module: { id: String(data.id) } });
    }

    if (body.action === "module.update") {
      const { error } = await supabase
        .from("wms_modules")
        .update({
          name: requiredText(body.name, "El nombre"),
          description: (body.description ?? "").trim().slice(0, 500),
          icon_key: requiredText(body.iconKey || "folder", "El ícono", 40),
          updated_at: now,
        })
        .eq("id", databaseId(body.id));
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "module.archive") {
      const { error } = await supabase.from("wms_modules").update({ is_active: false, updated_at: now }).eq("id", databaseId(body.id));
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "resource.create") {
      const moduleId = databaseId(body.moduleId);
      if (body.isPrimary) {
        const { error } = await supabase.from("wms_resources").update({ is_primary: false, updated_at: now }).eq("module_id", moduleId).eq("is_active", true);
        if (error) throw error;
      }
      const { data: lastResource } = await supabase.from("wms_resources").select("position").eq("module_id", moduleId).order("position", { ascending: false }).limit(1).maybeSingle();
      const name = requiredText(body.name, "El nombre");
      const { data, error } = await supabase
        .from("wms_resources")
        .insert({
          module_id: moduleId,
          slug: `${slugify(name) || "recurso"}-${Date.now().toString(36)}`,
          name,
          url: validUrl(body.href),
          resource_type: resourceType(body.type),
          is_primary: Boolean(body.isPrimary),
          position: (lastResource?.position ?? -1) + 1,
        })
        .select("id")
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, resource: { id: String(data.id) } });
    }

    if (body.action === "resource.update") {
      const moduleId = databaseId(body.moduleId);
      const id = databaseId(body.id);
      if (body.isPrimary) {
        const { error } = await supabase.from("wms_resources").update({ is_primary: false, updated_at: now }).eq("module_id", moduleId).neq("id", id).eq("is_active", true);
        if (error) throw error;
      }
      const { error } = await supabase
        .from("wms_resources")
        .update({
          name: requiredText(body.name, "El nombre"),
          url: validUrl(body.href),
          resource_type: resourceType(body.type),
          is_primary: Boolean(body.isPrimary),
          updated_at: now,
        })
        .eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "resource.archive") {
      const { error } = await supabase.from("wms_resources").update({ is_active: false, updated_at: now }).eq("id", databaseId(body.id));
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el cambio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
