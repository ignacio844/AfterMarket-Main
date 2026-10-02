import { auth } from "@/auth";
import { EtiquetasWorkspace } from "@/components/etiquetas-workspace";
import { isPortalEditor, isPortalUserAllowed } from "@/lib/portal-auth";
import { getEtiquetasData } from "@/lib/etiquetas-data";

export const dynamic = "force-dynamic";

export default async function EtiquetasPage() {
  const session = await auth();
  if (!isPortalUserAllowed(session?.user?.email)) return null;
  const data = await getEtiquetasData();
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10 lg:py-10">
        <EtiquetasWorkspace initialFiles={data.files} initialFolders={data.folders} initialConnected={data.connected} canUpload={isPortalEditor(session?.user?.email)} />
      </main>
    </div>
  );
}
