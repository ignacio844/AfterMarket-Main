import "server-only";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/lib/supabase-admin";
import { wmsSeedModules } from "@/lib/wms-seed";
import type { WmsModule, WmsResourceType } from "@/lib/wms-types";

type ModuleRow = {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon_key: string;
  position: number;
};

type ResourceRow = {
  id: number;
  module_id: number;
  slug: string;
  name: string;
  url: string;
  resource_type: WmsResourceType;
  is_primary: boolean;
  position: number;
};

export async function getWmsData(): Promise<{ modules: WmsModule[]; connected: boolean }> {
  if (!hasSupabaseAdminConfig()) return { modules: wmsSeedModules, connected: false };

  const supabase = getSupabaseAdmin();
  const [{ data: moduleRows, error: moduleError }, { data: resourceRows, error: resourceError }] = await Promise.all([
    supabase.from("wms_modules").select("id, slug, name, description, icon_key, position").eq("is_active", true).order("position"),
    supabase.from("wms_resources").select("id, module_id, slug, name, url, resource_type, is_primary, position").eq("is_active", true).order("position"),
  ]);

  if (moduleError || resourceError) {
    console.error("No se pudieron cargar los recursos WMS", moduleError ?? resourceError);
    return { modules: wmsSeedModules, connected: false };
  }

  const resources = (resourceRows ?? []) as ResourceRow[];
  const modules = ((moduleRows ?? []) as ModuleRow[]).map((module) => ({
    id: String(module.id),
    slug: module.slug,
    name: module.name,
    description: module.description,
    iconKey: module.icon_key,
    position: module.position,
    resources: resources
      .filter((resource) => resource.module_id === module.id)
      .map((resource) => ({
        id: String(resource.id),
        slug: resource.slug,
        name: resource.name,
        href: resource.url,
        type: resource.resource_type,
        isPrimary: resource.is_primary,
        position: resource.position,
      })),
  }));

  return { modules, connected: true };
}
