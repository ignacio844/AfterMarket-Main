import { auth } from "@/auth";
import { WmsResourceExplorer } from "@/components/wms-resource-explorer";
import { WmsHero } from "@/components/wms-hero";
import { isPortalEditor } from "@/lib/portal-auth";
import { getWmsData } from "@/lib/wms-data";

export const dynamic = "force-dynamic";

export default async function WmsPage() {
  const [session, wmsData] = await Promise.all([auth(), getWmsData()]);
  const editorEmail = session?.user?.email;
  const canManage = wmsData.connected && isPortalEditor(editorEmail);

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10 lg:py-10">
        <WmsHero />
        <WmsResourceExplorer initialModules={wmsData.modules} canManage={canManage} editorEmail={editorEmail ?? undefined} />
      </main>
    </div>
  );
}
