import { auth } from "@/auth";
import { WmsHero } from "@/components/wms-hero";
import { WmsWorkspace } from "@/components/wms-workspace";
import { isPortalEditor } from "@/lib/portal-auth";
import { getWmsData } from "@/lib/wms-data";
import { getWmsTrackerData } from "@/lib/wms-tracker-data";

export const dynamic = "force-dynamic";

export default async function WmsPage({ searchParams }: { searchParams: Promise<{ vista?: string | string[] }> }) {
  const [session, wmsData, trackerData, query] = await Promise.all([auth(), getWmsData(), getWmsTrackerData(), searchParams]);
  const editorEmail = session?.user?.email;
  const isEditor = isPortalEditor(editorEmail);
  const requestedView = Array.isArray(query.vista) ? query.vista[0] : query.vista;

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10 lg:py-10">
        <WmsHero />
        <WmsWorkspace
          initialView={requestedView === "tracker" ? "tracker" : "resources"}
          initialModules={wmsData.modules}
          initialTasks={trackerData.tasks}
          resourcesConnected={wmsData.connected}
          trackerConnected={trackerData.connected}
          canManageResources={isEditor}
          canManageTracker={isEditor}
          editorEmail={editorEmail ?? undefined}
        />
      </main>
    </div>
  );
}
